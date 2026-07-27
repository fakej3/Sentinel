import { describe, it, expect } from 'vitest'
import { computeIndicators } from '../../indicators/index'
import { computeMarketStructure } from '../../market-structure/index'
import { computeSupportResistance } from '../../support-resistance/index'
import { computeVolumeAnalysis } from '../../volume-analysis/index'
import { computeAnalysis } from '../../analysis/index'
import { computeConfidence } from '../../confidence/index'
import { validateAnalysis } from '../../validation/index'
import type { Candle, MarketData, Timeframe } from '../../market/types'

/**
 * Whole-pipeline invariants.
 *
 * The per-module suites check that each stage computes the right number. These
 * check the properties the SYSTEM must hold regardless of what any individual
 * number is, across a spread of market regimes:
 *
 *   NaN/Infinity safety — one non-finite leaf anywhere poisons every
 *     comparison downstream, including grade switches and sort comparators,
 *     and does so silently.
 *   Determinism — identical input must give byte-identical output, or replay
 *     and historical validation are measuring noise.
 *   Prefix stability / no repainting — running on candles[0..m] must return
 *     exactly the swings the full run marks as confirmed at or before m. This
 *     is the property that makes backtests honest: if it fails, the engine is
 *     using information from the future.
 *
 * These are cheap to hold and expensive to lose, and nothing else in the suite
 * asserts them end-to-end.
 */

const HOUR = 3_600_000

/** Deterministic LCG — the sweep must be reproducible run to run. */
function makeRng(seed: number): () => number {
  let s = seed
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
}

function market(drift: number, vol: number, n: number, seed: number): Candle[] {
  const rnd = makeRng(seed)
  let p = 100
  return Array.from({ length: n }, (_, i) => {
    p *= 1 + drift + (rnd() - 0.5) * vol
    const openTime = i * HOUR
    const h = p * (1 + rnd() * vol)
    const l = p * (1 - rnd() * vol)
    return {
      openTime, closeTime: openTime + HOUR - 1,
      open: p, high: Math.max(h, p), low: Math.min(l, p), close: p,
      volume: 1000 * (0.5 + rnd()), quoteVolume: p * 1000,
      trades: 100, takerBuyVolume: 550, takerSellVolume: 450,
    }
  })
}

function marketData(candles: Candle[]): MarketData {
  const last = candles[candles.length - 1]
  return {
    symbol: 'TESTUSDT', timeframe: '1h' as Timeframe, fetchedAt: 0, candles,
    ticker: {
      symbol: 'TESTUSDT', priceChange: 0, priceChangePercent: 0, weightedAvgPrice: last.close,
      lastPrice: last.close, bidPrice: last.close, askPrice: last.close, openPrice: candles[0].close,
      highPrice: last.high, lowPrice: last.low, volume: 1e6, quoteVolume: 1e8,
      openTime: candles[0].openTime, closeTime: last.closeTime, tradeCount: 1000,
    },
    fundingRate: null, openInterest: null,
  } as MarketData
}

function runPipeline(candles: Candle[]) {
  const indicators = computeIndicators(candles)
  const marketStructure = computeMarketStructure(candles)
  const supportResistance = computeSupportResistance(candles, marketStructure, undefined, indicators.atr)
  const volumeAnalysis = computeVolumeAnalysis(candles, indicators, marketStructure, supportResistance)
  const analysis = computeAnalysis(marketData(candles), indicators, marketStructure, supportResistance, volumeAnalysis)
  const validation = validateAnalysis(analysis)
  const confidence = computeConfidence(analysis, validation)
  return { indicators, marketStructure, supportResistance, volumeAnalysis, analysis, validation, confidence }
}

/** Every non-finite numeric leaf, with its path, so a failure names the field. */
function nonFiniteLeaves(value: unknown, path = '', out: string[] = []): string[] {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path} = ${value}`)
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => nonFiniteLeaves(v, `${path}[${i}]`, out))
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) nonFiniteLeaves(v, path ? `${path}.${k}` : k, out)
  }
  return out
}

// Regimes: strong down → flat → strong up, across three volatility levels and
// three history depths (just past warmup, mid, full).
const REGIMES: Array<[number, number, number]> = []
for (const drift of [-0.004, -0.001, 0, 0.001, 0.004]) {
  for (const vol of [0.003, 0.012, 0.03]) {
    for (const n of [60, 150, 400]) REGIMES.push([drift, vol, n])
  }
}

describe('pipeline invariants — NaN and Infinity safety', () => {
  it.each(REGIMES)('emits only finite numbers (drift=%s vol=%s n=%s)', (drift, vol, n) => {
    const result = runPipeline(market(drift, vol, n, 999))
    expect(nonFiniteLeaves(result)).toEqual([])
  })
})

describe('pipeline invariants — determinism', () => {
  it.each(REGIMES)('identical input gives identical output (drift=%s vol=%s n=%s)', (drift, vol, n) => {
    const candles = market(drift, vol, n, 999)
    // Fresh object identities, same values — nothing may depend on reference
    // identity, insertion order, or wall-clock time.
    const a = runPipeline(candles)
    const b = runPipeline(candles.map(c => ({ ...c })))
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })
})

describe('pipeline invariants — prefix stability (no repainting, no look-ahead)', () => {
  const deep = REGIMES.filter(([, , n]) => n >= 150)

  it.each(deep)('swings confirmed by bar m are identical when only bars 0..m are visible (drift=%s vol=%s n=%s)',
    (drift, vol, n) => {
      const candles = market(drift, vol, n, 999)
      const full = computeMarketStructure(candles)

      for (const fraction of [0.5, 0.7, 0.9]) {
        const m = Math.floor(n * fraction)
        const prefix = computeMarketStructure(candles.slice(0, m + 1))
        const expected = full.swings.filter(s => s.confirmedIndex <= m)
        expect(prefix.swings).toEqual(expected)
      }
    })

  it('confirmedIndex is never before the swing it confirms, and never in the future', () => {
    const candles = market(0.002, 0.012, 400, 999)
    const { swings } = computeMarketStructure(candles)
    expect(swings.length).toBeGreaterThan(0)
    for (const s of swings) {
      expect(s.confirmedIndex).toBeGreaterThanOrEqual(s.index)
      expect(s.confirmedIndex).toBeLessThan(candles.length)
    }
  })
})

describe('pipeline invariants — swing structural properties', () => {
  // Phase 2 replaced fixed-lookback pivots with ATR-thresholded zigzag detection
  // and claimed strict alternation and index ordering held "by construction".
  // Claiming is not proving; these assert them over the regime sweep.
  it.each(REGIMES)('swings strictly alternate high/low and advance in index (drift=%s vol=%s n=%s)',
    (drift, vol, n) => {
      const { swings } = computeMarketStructure(market(drift, vol, n, 8080))
      for (let i = 1; i < swings.length; i++) {
        expect(swings[i].type, `swing ${i} repeats type ${swings[i].type}`)
          .not.toBe(swings[i - 1].type)
        expect(swings[i].index).toBeGreaterThan(swings[i - 1].index)
      }
    })

  it.each(REGIMES)('every swing reports its own bar\'s extreme and timestamp (drift=%s vol=%s n=%s)',
    (drift, vol, n) => {
      const candles = market(drift, vol, n, 8080)
      const { swings } = computeMarketStructure(candles)
      for (const s of swings) {
        const bar = candles[s.index]
        expect(s.price).toBe(s.type === 'high' ? bar.high : bar.low)
        expect(s.timestamp).toBe(bar.openTime)
      }
    })
})

describe('pipeline invariants — boundedness of 0–10 scores', () => {
  it.each(REGIMES)('every published score stays within its declared range (drift=%s vol=%s n=%s)',
    (drift, vol, n) => {
      const r = runPipeline(market(drift, vol, n, 999))
      const inRange = (v: number, label: string) => {
        expect(v, `${label} below 0`).toBeGreaterThanOrEqual(0)
        expect(v, `${label} above 10`).toBeLessThanOrEqual(10)
      }
      inRange(r.marketStructure.confidence, 'marketStructure.confidence')
      inRange(r.volumeAnalysis.overallStrength, 'volumeAnalysis.overallStrength')
      inRange(r.confidence.score, 'confidence.score')
      inRange(r.confidence.bullishConfidence, 'confidence.bullishConfidence')
      inRange(r.confidence.bearishConfidence, 'confidence.bearishConfidence')
      for (const z of r.supportResistance.zones) {
        inRange(z.strength, `zone ${z.id} strength`)
        inRange(z.confidence, `zone ${z.id} confidence`)
      }
    })
})
