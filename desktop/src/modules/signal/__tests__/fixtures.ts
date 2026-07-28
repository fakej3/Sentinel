/**
 * Shared fixtures for the signal layer.
 *
 * Two decisions worth stating, because both are load-bearing for what the tests
 * can conclude:
 *
 *   1. `makeInput` calls the REAL indicator, market-structure and S/R modules.
 *      Hand-built stubs would let a feature pass its test while disagreeing
 *      with the contract it actually consumes — which is how a field like
 *      `BollingerResult.bandwidth` came to be read as a percentage when it was
 *      a price. These tests fail if those contracts change.
 *
 *   2. Every generator is a seeded LCG. No `Math.random`. A test that is only
 *      usually true is not a test, and the whole layer's contract is
 *      determinism.
 */
import type { Candle, Timeframe } from '../../market/types'
import { computeIndicators } from '../../indicators'
import { computeMarketStructure } from '../../market-structure'
import { computeSupportResistance } from '../../support-resistance'
import type { SignalInput } from '../index'

export const HOUR = 3_600_000

/** Deterministic LCG + Box–Muller. */
export function gauss(seed: number): () => number {
  let s = seed >>> 0
  const u = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  let spare: number | null = null
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v }
    let a = 0, b = 0, q = 0
    do { a = u() * 2 - 1; b = u() * 2 - 1; q = a * a + b * b } while (q === 0 || q >= 1)
    const f = Math.sqrt(-2 * Math.log(q) / q)
    spare = b * f
    return a * f
  }
}

/** Deterministic uniform in [0, 1). */
export function uniform(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export interface SeriesOptions {
  readonly n: number
  readonly seed: number
  /** Per-bar log drift. */
  readonly drift?: number
  /** Per-bar log volatility. */
  readonly sigma?: number
  readonly start?: number
  readonly startTime?: number
  readonly step?: number
}

/**
 * Geometric random walk with optional drift.
 *
 * Wicks are placed in LOG space (`× exp(±w)`), not linearly. A linear wick
 * `× (1 − w)` drives `low` to zero or below once w ≥ 1, which produced
 * impossible candles at high volatility in an earlier generator; the log form
 * cannot, for any w.
 */
export function makeSeries(options: SeriesOptions): Candle[] {
  const { n, seed, drift = 0, sigma = 0.01, start = 100, startTime = 0, step = HOUR } = options
  const z = gauss(seed)
  const u = uniform(seed ^ 0x5f3759df)
  const out: Candle[] = []
  let p = start
  for (let i = 0; i < n; i++) {
    const open = p
    p = p * Math.exp(drift + sigma * z())
    const w = sigma * (0.2 + 0.8 * u())
    const high = Math.max(open, p) * Math.exp(w)
    const low = Math.min(open, p) * Math.exp(-w)
    const volume = 1000 * (0.5 + u())
    out.push({
      openTime: startTime + i * step,
      closeTime: startTime + i * step + step - 1,
      open, high, low, close: p,
      volume,
      quoteVolume: volume * p,
      trades: 10 + Math.floor(u() * 90),
      takerBuyVolume: volume / 2,
      takerSellVolume: volume / 2,
    })
  }
  return out
}

/** Multiplies every price by `k`, leaving volume and timestamps alone. */
export function rescale(candles: readonly Candle[], k: number): Candle[] {
  return candles.map(c => ({
    ...c,
    open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k,
    quoteVolume: c.quoteVolume * k,
  }))
}

/** Builds a full `SignalInput` by running the real upstream modules. */
export function makeInput(candles: readonly Candle[], timeframe: Timeframe = '1h'): SignalInput {
  const cs = [...candles]
  const indicators = computeIndicators(cs)
  const marketStructure = computeMarketStructure(cs)
  const supportResistance = computeSupportResistance(cs, marketStructure, undefined, indicators.atr)
  return { candles, timeframe, indicators, marketStructure, supportResistance }
}

/**
 * Expanding windows over a series: window i ends at bar i.
 *
 * This is how a live engine sees the market — everything up to and including
 * the decision bar, nothing after — so driving the tests this way means a
 * look-ahead bug shows up as a failing assertion rather than as an optimistic
 * number.
 */
export function* expandingWindows(
  candles: readonly Candle[],
  from: number,
): Generator<readonly Candle[]> {
  for (let i = from; i < candles.length; i++) yield candles.slice(0, i + 1)
}
