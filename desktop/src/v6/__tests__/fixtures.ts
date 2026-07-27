import type { Candle, Timeframe } from '../../modules/market/types'
import type { TimeframeInput } from '../context/multi-timeframe'

export const HOUR = 3_600_000
export const DAY = 86_400_000

/** Deterministic LCG — every V6 test must be reproducible run to run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

export function bar(
  openTime: number, dur: number, o: number, h: number, l: number, c: number, v: number,
  takerBuyShare = 0.5,
): Candle {
  return {
    openTime, closeTime: openTime + dur - 1,
    open: o, high: h, low: l, close: c,
    volume: v, quoteVolume: c * v, trades: 1,
    takerBuyVolume: v * takerBuyShare, takerSellVolume: v * (1 - takerBuyShare),
  }
}

/** Candles from a close-price path; OHLC derived so H ≥ max(O,C), L ≤ min(O,C). */
export function fromPath(
  path: readonly number[],
  dur = HOUR,
  volumeAt: (i: number) => number = () => 1000,
  start = DAY * 100,
): Candle[] {
  return path.map((c, i) => {
    const o = i === 0 ? c : path[i - 1]
    return bar(start + i * dur, dur, o, Math.max(o, c) * 1.002, Math.min(o, c) * 0.998, c, volumeAt(i))
  })
}

/** Multiply every price by k. Volume and timestamps untouched. */
export function scalePrices(candles: readonly Candle[], k: number): Candle[] {
  return candles.map(c => ({
    ...c,
    open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k,
    quoteVolume: c.quoteVolume * k,
  }))
}

export function randomWalk(seed: number, n: number, start = 100, vol = 0.02): number[] {
  const r = rng(seed)
  let p = start
  return Array.from({ length: n }, () => (p = Math.max(1e-9, p * (1 + (r() - 0.5) * vol))))
}

export function input(candles: readonly Candle[], timeframe: Timeframe = '1h'): TimeframeInput {
  return { timeframe, candles }
}
