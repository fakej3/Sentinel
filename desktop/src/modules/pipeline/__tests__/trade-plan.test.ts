import { describe, it, expect } from 'vitest'
import { computeTradePlan } from '../compute/trade-plan'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { MultiTimeframeAgreement } from '../types'
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

  it('bullish trend with resistance → target at resistance lower edge (conservative boundary)', () => {
    const sr = makeSR(
      { lower: 95, upper: 97, center: 96 },
      { lower: 110, upper: 112, center: 111 },
    )
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence() as ConfidenceResult)
    // Target uses zone lower boundary (not center) to avoid inflating RR
    expect(plan.targetLevel).toBeCloseTo(110, 0)
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

// ─────────────────────────────────────────────────────────────────────────────
// MTF Agreement integration
// ─────────────────────────────────────────────────────────────────────────────

function makeMTFConflict(): MultiTimeframeAgreement {
  return {
    agreement: 'strong_conflict',
    agreementScore: 1.5,
    timeframes: [],
    dominantDirection: 'bullish',
    conflictingCount: 2,
  }
}

function makeMTFAligned(): MultiTimeframeAgreement {
  return {
    agreement: 'aligned',
    agreementScore: 9.0,
    timeframes: [],
    dominantDirection: 'bullish',
    conflictingCount: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Weak trend downgrade (evidence: 8/10 validation losses had weak trend labels)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTradePlan — weak trend downgrade', () => {
  const SR_EXCELLENT = makeSR(
    { lower: 95, upper: 97, center: 96 },
    { lower: 103, upper: 105, center: 104 },
  )

  it('weak bullish trend degrades excellent → good', () => {
    const plan = computeTradePlan(
      makeAnalysis('weak bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
    )
    expect(plan.setupQuality).toBe('good')
    expect(plan.setupQualityReason).toMatch(/downgraded/)
  })

  it('weak bearish trend degrades excellent → good', () => {
    const plan = computeTradePlan(
      makeAnalysis('weak bearish', 100),
      SR_EXCELLENT,
      makeConfidence(8.5) as ConfidenceResult,
    )
    expect(plan.setupQuality).toBe('good')
  })

  it('weak bullish trend degrades good → average', () => {
    // confidence 5.5 → would be good, but weak trend drops to average
    const plan = computeTradePlan(
      makeAnalysis('weak bullish', 100),
      SR_EXCELLENT,
      makeConfidence(5.5) as ConfidenceResult,
    )
    expect(plan.setupQuality).toBe('average')
    expect(plan.setupQualityReason).toMatch(/downgraded/)
  })

  it('ranging trend produces no_setup (no directional levels)', () => {
    // Ranging markets don't set entry zone (not bullish/bearish), so no_setup before weak check
    const plan = computeTradePlan(
      makeAnalysis('ranging', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
    )
    expect(plan.setupQuality).toBe('no_setup')
  })

  it('strong bullish trend is not downgraded', () => {
    const plan = computeTradePlan(
      makeAnalysis('strong bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
    )
    expect(plan.setupQuality).toBe('excellent')
  })

  it('moderate bearish trend is not downgraded', () => {
    const plan = computeTradePlan(
      makeAnalysis('moderate bearish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
    )
    expect(plan.setupQuality).toBe('excellent')
  })

  it('weak trend patience message warns about weak trend', () => {
    const plan = computeTradePlan(
      makeAnalysis('weak bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
    )
    // Quality is 'good' after downgrade — message should mention weak trend or confirmation
    expect(plan.patienceMessage.toLowerCase()).toMatch(/weak|confirm/)
  })
})

describe('computeTradePlan — MTF agreement', () => {
  const SR_EXCELLENT = makeSR(
    { lower: 95, upper: 97, center: 96 },
    { lower: 103, upper: 105, center: 104 },
  )

  it('MTF strong_conflict degrades excellent → good', () => {
    const plan = computeTradePlan(
      makeAnalysis('strong bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
      undefined,
      makeMTFConflict(),
    )
    expect(plan.setupQuality).toBe('good')
  })

  it('MTF strong_conflict degrades good → average', () => {
    // confidence 5.5 → good base, but MTF conflict drops to average
    const plan = computeTradePlan(
      makeAnalysis('strong bullish', 100),
      SR_EXCELLENT,
      makeConfidence(5.5) as ConfidenceResult,
      undefined,
      makeMTFConflict(),
    )
    expect(plan.setupQuality).toBe('average')
  })

  it('MTF aligned does not change quality', () => {
    const withoutMTF = computeTradePlan(
      makeAnalysis('strong bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
    )
    const withAligned = computeTradePlan(
      makeAnalysis('strong bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
      undefined,
      makeMTFAligned(),
    )
    expect(withAligned.setupQuality).toBe(withoutMTF.setupQuality)
    expect(withAligned.setupQuality).toBe('excellent')
  })

  it('MTF undefined behaves identically to no MTF argument', () => {
    const withUndefined = computeTradePlan(
      makeAnalysis('strong bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
      undefined,
      undefined,
    )
    const withoutArg = computeTradePlan(
      makeAnalysis('strong bullish', 100),
      SR_EXCELLENT,
      makeConfidence(8.0) as ConfidenceResult,
    )
    expect(withUndefined.setupQuality).toBe(withoutArg.setupQuality)
  })
})
