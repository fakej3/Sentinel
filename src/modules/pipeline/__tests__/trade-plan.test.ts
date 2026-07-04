import { describe, it, expect } from 'vitest'
import { computeTradePlan } from '../compute/trade-plan'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { Timeframe } from '../../binance/types'

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makeSR(
  support: { lower: number; upper: number; center: number } | null = null,
  resistance: { lower: number; upper: number; center: number } | null = null,
): SupportResistanceResult {
  const makeZone = (zone: { lower: number; upper: number; center: number } | null) =>
    zone ? { ...zone, strength: 7 } as unknown as SupportResistanceResult['nearestSupport'] : null

  return {
    zones: [],
    activeSupport: [],
    activeResistance: [],
    nearestSupport: makeZone(support),
    nearestResistance: makeZone(resistance),
    currentZone: null,
    evidence: [],
  } as SupportResistanceResult
}

function makeAnalysis(
  trend = 'strong bullish',
  currentPrice = 100,
): MarketAnalysisResult {
  return {
    symbol: 'BTCUSDT', timeframe: '1h' as Timeframe, analysedAt: 0,
    price: { current: currentPrice, change24hPercent: 0, high24h: 110, low24h: 90, atrPercent: null },
    fullTrend: { trend: trend as MarketAnalysisResult['fullTrend']['trend'], bullishConditionsMet: 3, bearishConditionsMet: 0, neutralConditionsMet: 0, conditions: {} as never },
    emaContext: { priceVsEMA20: 'above', priceVsEMA50: 'above', priceVsEMA100: 'above', priceVsEMA200: 'above', emaAlignment: 'bullish_stack', confluenceZones: [] },
    indicatorSummary: { rsi: { value: 60, classification: 'healthy_bullish' }, macd: { histogram: 0.5, bias: 'bullish' }, adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' }, bollinger: { bandwidth: 2, bandwidthState: 'normal', priceRelativeToBands: 'above_upper' }, stochRsi: { k: 60, d: 55, zone: 'neutral' } },
    srContext: { nearestSupportDistance: -2, nearestResistanceDistance: 5, insideSupport: false, insideResistance: false, approachingSupport: false, approachingResistance: false, strongestActiveSupport: null, strongestActiveResistance: null },
    volumeContext: { relativeVolume: 1.5, volumeClassification: 'normal', confirmsCurrentMove: true, climaxSignal: 'none', accDistState: 'neutral', priceAboveVWAP: true, vwapDistancePercent: 1.0, respectingVWAP: true, obvDirection: 'bullish', obvConfirmingPrice: true, overallStrength: 7 },
    evidence: [],
    indicators: {} as never,
    marketStructure: {} as never,
    supportResistance: {} as never,
    volumeAnalysis: {} as never,
  }
}

function makeConfidence(score = 7.5): ConfidenceResult {
  return { score, grade: 'strong', trust: { score: 100, level: 'high', factors: [], reductions: [] } } as unknown as ConfidenceResult
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTradePlan
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTradePlan', () => {
  it('returns required shape', () => {
    const plan = computeTradePlan(makeAnalysis(), makeSR(), makeConfidence() as ConfidenceResult)
    expect(typeof plan.patienceMessage).toBe('string')
    expect(plan.patienceMessage.length).toBeGreaterThan(0)
  })

  it('returns null fields when S/R is unavailable', () => {
    const plan = computeTradePlan(makeAnalysis(), makeSR(), makeConfidence() as ConfidenceResult)
    // no support or resistance → entry zone, invalidation, target all null
    expect(plan.entryZone).toBeNull()
    expect(plan.invalidationLevel).toBeNull()
    expect(plan.targetLevel).toBeNull()
    expect(plan.riskRewardRatio).toBeNull()
  })

  it('bullish trend with support → entry zone at support', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 })
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence() as ConfidenceResult)
    expect(plan.entryZone).not.toBeNull()
    expect(plan.entryZone!.lower).toBeCloseTo(95, 1)
    expect(plan.entryZone!.upper).toBeCloseTo(97, 1)
  })

  it('bearish trend with resistance → entry zone at resistance', () => {
    const sr = makeSR(null, { lower: 103, upper: 105, center: 104 })
    const plan = computeTradePlan(makeAnalysis('strong bearish', 100), sr, makeConfidence() as ConfidenceResult)
    expect(plan.entryZone).not.toBeNull()
    expect(plan.entryZone!.lower).toBeCloseTo(103, 1)
  })

  it('bullish trend → invalidation below support', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 })
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence() as ConfidenceResult)
    expect(plan.invalidationLevel).not.toBeNull()
    expect(plan.invalidationLevel!).toBeLessThan(95)
  })

  it('bullish trend with resistance → target at resistance', () => {
    const sr = makeSR(
      { lower: 95, upper: 97, center: 96 },
      { lower: 110, upper: 112, center: 111 },
    )
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence() as ConfidenceResult)
    expect(plan.targetLevel).toBeCloseTo(111, 0)
  })

  it('computes R/R ratio when both invalidation and target are known', () => {
    const sr = makeSR(
      { lower: 95, upper: 97, center: 96 },
      { lower: 110, upper: 112, center: 111 },
    )
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence() as ConfidenceResult)
    expect(plan.riskRewardRatio).not.toBeNull()
    expect(plan.riskRewardRatio!).toBeGreaterThan(0)
  })

  it('ranging market → appropriate patience message', () => {
    const plan = computeTradePlan(makeAnalysis('ranging'), makeSR(), makeConfidence() as ConfidenceResult)
    expect(plan.patienceMessage.toLowerCase()).toMatch(/ranging|wait|break/)
  })

  it('is deterministic', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const analysis = makeAnalysis('strong bullish', 100)
    const confidence = makeConfidence() as ConfidenceResult
    const p1 = computeTradePlan(analysis, sr, confidence)
    const p2 = computeTradePlan(analysis, sr, confidence)
    expect(p1).toEqual(p2)
  })
})
