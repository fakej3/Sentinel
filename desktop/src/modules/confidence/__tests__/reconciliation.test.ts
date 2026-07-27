import { describe, it, expect } from 'vitest'
import { computeConfidence } from '../index'
import { scoreEvidence, normalize } from '../compute/score'
import { DEFAULT_CONFIDENCE_CONFIG as CFG } from '../config'
import { computeIndicators } from '../../indicators/index'
import { computeMarketStructure } from '../../market-structure/index'
import { computeSupportResistance } from '../../support-resistance/index'
import { computeVolumeAnalysis } from '../../volume-analysis/index'
import { computeAnalysis } from '../../analysis/index'
import { validateAnalysis } from '../../validation/index'
import type { Candle, MarketData, Timeframe } from '../../market/types'

/**
 * PENALTY RECONCILIATION.
 *
 * `confidence-explanation.ts` sums every `penalties[].scoreReduction` and
 * renders it as "N penalty(ies) reduced the score by X pts". For that sentence
 * to be true, the reported reductions must add up to the actual movement of the
 * score. Nothing asserted it, and it was false in 96% of runs (worst case 1.95
 * points on a 0–10 scale) for two reasons:
 *
 *   1. The contradiction entry reported `normalize(contradictionPoints × f)`.
 *      Contradictions are subtracted in RAW-POINT space before normalisation,
 *      and normalisation is non-linear above the knee, so
 *      normalize(a − b) ≠ normalize(a) − normalize(b). The reported figure was
 *      a different quantity from the effect it described.
 *   2. Two penalties floored the score at 0 but reported the REQUESTED amount
 *      rather than the amount the floor actually let through.
 *
 * The baseline is the UNPENALISED score — normalize(directedPoints) — because
 * the contradiction entry is measured from there.
 */

const HOUR = 3_600_000

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
    return {
      openTime, closeTime: openTime + HOUR - 1,
      open: p, high: p * (1 + rnd() * vol), low: p * (1 - rnd() * vol), close: p,
      volume: 1000 * (0.5 + rnd()), quoteVolume: p * 1000,
      trades: 100, takerBuyVolume: 550, takerSellVolume: 450,
    }
  })
}

function marketData(candles: Candle[]): MarketData {
  const l = candles[candles.length - 1]
  return {
    symbol: 'TESTUSDT', timeframe: '1h' as Timeframe, fetchedAt: 0, candles,
    ticker: {
      symbol: 'TESTUSDT', priceChange: 0, priceChangePercent: 0, weightedAvgPrice: l.close,
      lastPrice: l.close, bidPrice: l.close, askPrice: l.close, openPrice: candles[0].close,
      highPrice: l.high, lowPrice: l.low, volume: 1e6, quoteVolume: 1e8,
      openTime: candles[0].openTime, closeTime: l.closeTime, tradeCount: 1000,
    },
    fundingRate: null, openInterest: null,
  } as MarketData
}

/** The score before any post-normalisation penalty — the reconciliation baseline. */
function unpenalisedScore(analysis: ReturnType<typeof computeAnalysis>): number {
  const b = scoreEvidence(analysis.evidence, CFG)
  const trend = analysis.fullTrend.trend
  let directed: number
  if (trend.includes('bullish')) {
    directed = b.bullishRawPoints + b.neutralContribution * CFG.neutralStrengthFactor
  } else if (trend.includes('bearish')) {
    directed = b.bearishRawPoints + b.neutralContribution * CFG.neutralStrengthFactor
  } else {
    directed = Math.abs(b.rawPoints)
  }
  return normalize(directed, CFG.normalizationDivisor, CFG.gradeThresholds.veryStrong)
}

const REGIMES: Array<[number, number]> = []
for (const drift of [-0.005, -0.002, 0, 0.002, 0.005]) {
  for (const vol of [0.004, 0.015, 0.035]) REGIMES.push([drift, vol])
}

describe('confidence penalties reconcile with the score they claim to reduce', () => {
  it.each(REGIMES)('sum(scoreReduction) equals baseline − final (drift=%s vol=%s)', (drift, vol) => {
    for (let seed = 1; seed <= 8; seed++) {
      const candles = market(drift, vol, 300, seed * 977)
      const indicators = computeIndicators(candles)
      const ms = computeMarketStructure(candles)
      const sr = computeSupportResistance(candles, ms, undefined, indicators.atr)
      const va = computeVolumeAnalysis(candles, indicators, ms, sr)
      const analysis = computeAnalysis(marketData(candles), indicators, ms, sr, va)
      const validation = validateAnalysis(analysis)
      const confidence = computeConfidence(analysis, validation)

      const claimed = confidence.penalties.reduce((s, p) => s + p.scoreReduction, 0)
      const actual = unpenalisedScore(analysis) - confidence.score

      // Tolerance covers the >0.01 emit filter, which may drop a single
      // sub-0.01 contradiction entry, plus float noise.
      expect(Math.abs(claimed - actual)).toBeLessThan(0.011)
    }
  })

  it('never reports a negative or non-finite reduction', () => {
    for (const [drift, vol] of REGIMES) {
      const candles = market(drift, vol, 300, 4242)
      const indicators = computeIndicators(candles)
      const ms = computeMarketStructure(candles)
      const sr = computeSupportResistance(candles, ms, undefined, indicators.atr)
      const va = computeVolumeAnalysis(candles, indicators, ms, sr)
      const analysis = computeAnalysis(marketData(candles), indicators, ms, sr, va)
      const confidence = computeConfidence(analysis, validateAnalysis(analysis))
      for (const p of confidence.penalties) {
        expect(Number.isFinite(p.scoreReduction)).toBe(true)
        expect(p.scoreReduction).toBeGreaterThan(0)
      }
    }
  })

  it('every cap that fires binds as an upper bound on the FINAL score', () => {
    // The penalty chain mixes caps with subtractions and is order-dependent in
    // magnitude. What must hold regardless of order is that each step is
    // non-increasing, so a cap applied anywhere in the chain can never be
    // undone by a later step. If a subtraction were ever reordered above a cap,
    // or a step were made to raise the score, this fails.
    for (const [drift, vol] of REGIMES) {
      for (let seed = 1; seed <= 6; seed++) {
        const candles = market(drift, vol, 300, seed * 611)
        const indicators = computeIndicators(candles)
        const ms = computeMarketStructure(candles)
        const sr = computeSupportResistance(candles, ms, undefined, indicators.atr)
        const va = computeVolumeAnalysis(candles, indicators, ms, sr)
        const analysis = computeAnalysis(marketData(candles), indicators, ms, sr, va)
        const c = computeConfidence(analysis, validateAnalysis(analysis))
        const fired = new Set(c.penalties.map(p => p.source))

        if (fired.has('validation_critical')) expect(c.score).toBeLessThanOrEqual(CFG.criticalScoreCap + 1e-9)
        if (fired.has('weak_trend_cap')) expect(c.score).toBeLessThanOrEqual(CFG.weakTrendScoreCap + 1e-9)
        if (fired.has('near_zero_atr')) expect(c.score).toBeLessThanOrEqual(CFG.nearZeroAtrCap + 1e-9)
      }
    }
  })

  it('a penalty can never take the score below zero or above the scale', () => {
    for (const [drift, vol] of REGIMES) {
      const candles = market(drift, vol, 300, 31337)
      const indicators = computeIndicators(candles)
      const ms = computeMarketStructure(candles)
      const sr = computeSupportResistance(candles, ms, undefined, indicators.atr)
      const va = computeVolumeAnalysis(candles, indicators, ms, sr)
      const analysis = computeAnalysis(marketData(candles), indicators, ms, sr, va)
      const confidence = computeConfidence(analysis, validateAnalysis(analysis))
      expect(confidence.score).toBeGreaterThanOrEqual(0)
      expect(confidence.score).toBeLessThanOrEqual(10)
    }
  })
})
