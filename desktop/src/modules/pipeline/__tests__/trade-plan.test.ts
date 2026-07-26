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
    volumeContext: { relativeVolume: 1.5, volumeClassification: 'normal', confirmsCurrentMove: true, climaxSignal: 'none', accDistState: 'neutral', vwap: { available: true, unavailable: null, value: 100, side: 'above', distancePercent: 1.0, respectingVWAP: true }, obvDirection: 'bullish', obvConfirmingPrice: true, overallStrength: 7 },
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
// Direction + target ladder (moved from the rendering layer into the pipeline)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTradePlan — direction and target ladder', () => {
  const mkLadderZone = (lower: number, upper: number) =>
    ({ lower, upper, center: (lower + upper) / 2, strength: 6 }) as unknown as
      NonNullable<SupportResistanceResult['nearestResistance']>

  it('bullish trend → direction long; bearish → short; ranging → null', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    expect(computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence()).direction).toBe('long')
    expect(computeTradePlan(makeAnalysis('strong bearish', 100), makeSR(null, { lower: 103, upper: 105, center: 104 }), makeConfidence()).direction).toBe('short')
    expect(computeTradePlan(makeAnalysis('ranging', 100), makeSR(), makeConfidence()).direction).toBeNull()
  })

  it('long ladder: targetLevel first, then further resistance lower-bounds above it, max 3', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    sr.activeResistance = [
      mkLadderZone(110, 112),  // primary target zone (price 110 == targetLevel, not > → skipped)
      mkLadderZone(118, 120),
      mkLadderZone(125, 127),
      mkLadderZone(133, 135),  // beyond the 3-target cap
    ]
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence())
    expect(plan.targets).toEqual([110, 118, 125])
  })

  it('short ladder: further support upper-bounds below the target', () => {
    const sr = makeSR({ lower: 80, upper: 82, center: 81 }, { lower: 103, upper: 105, center: 104 })
    sr.activeSupport = [
      mkLadderZone(80, 82),   // primary target zone (price 82 == targetLevel, not < → skipped)
      mkLadderZone(72, 74),
    ]
    const plan = computeTradePlan(makeAnalysis('strong bearish', 100), sr, makeConfidence())
    expect(plan.targets).toEqual([82, 74])
  })

  it('empty ladder when no target exists', () => {
    const plan = computeTradePlan(makeAnalysis('ranging'), makeSR(), makeConfidence())
    expect(plan.targets).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Structural anchoring: weakening-zone exclusion + BOS-anchored stops
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTradePlan — weakening zones are excluded from entry/stop selection', () => {
  type Zone = NonNullable<SupportResistanceResult['nearestSupport']>
  const mkZone = (lower: number, upper: number, state = 'active') =>
    ({ lower, upper, center: (lower + upper) / 2, strength: 6, state }) as unknown as Zone

  it('a weakening nearest support is skipped in favor of the next reliable support', () => {
    const weakening = mkZone(95, 97, 'weakening')
    const reliable  = mkZone(90, 92, 'strengthened')
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    sr.nearestSupport = weakening
    sr.activeSupport  = [weakening, reliable]  // nearest-first ordering

    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence())
    expect(plan.entryZone).not.toBeNull()
    expect(plan.entryZone!.lower).toBe(90)   // the reliable zone, not the failed one
    expect(plan.entryZone!.upper).toBe(92)
    expect(plan.invalidationLevel!).toBeLessThan(90)  // stop derived from the reliable zone
  })

  it('with ONLY weakening zones available, falls through to ATR-based levels (capped at average)', () => {
    const weakening = mkZone(95, 97, 'weakening')
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    sr.nearestSupport = weakening
    sr.activeSupport  = [weakening]

    const analysis = makeAnalysis('strong bullish', 100)
    analysis.price.atrPercent = 2  // enable the ATR fallback path
    const plan = computeTradePlan(analysis, sr, makeConfidence())

    // Entry near current price (ATR fallback), NOT at the failed zone
    expect(plan.entryZone!.lower).toBeCloseTo(99.9, 1)
    expect(plan.entryZone!.upper).toBeCloseTo(100.1, 1)
    expect(['average', 'poor', 'no_setup', 'avoid']).toContain(plan.setupQuality)  // never above average
  })

  it('a reliable nearest support is used exactly as before (control)', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence())
    expect(plan.entryZone!.lower).toBeCloseTo(95, 1)
  })
})

describe('computeTradePlan — BOS-anchored invalidation (sweep-zone widening, 1 ATR bound)', () => {
  const mkMS = (bosDirection: 'bullish' | 'bearish', level: number) =>
    ({
      bos: { detected: true, events: [], last: { type: 'BOS', index: 0, timestamp: 0, level, direction: bosDirection } },
      choch: { detected: false, events: [], last: null },
      strength: 'moderate',
    }) as unknown as import('../../market-structure/types').MarketStructureResult

  const analysisWithAtr = (trend: string, atrPercent: number) => {
    const a = makeAnalysis(trend, 100)
    a.price.atrPercent = atrPercent
    return a
  }

  it('long: widens the stop below a bullish BOS when the zone stop sits in the sweep zone above it', () => {
    // ATR 2% of 100 = 2. Buffer = max(0.5%, 2/200) = 1%.
    // Support 95–97 → naive stop = 95 × 0.99 = 94.05.
    // Bullish BOS at 94.8 → structural stop = 94.8 × 0.99 = 93.852.
    // The naive stop (94.05) sits ABOVE the structural line (93.852) — i.e.
    // in the sweep zone above confirmed structure. Adjustment = 0.198 ≤ 1 ATR
    // (2) → stop widens to the structural line.
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const plan = computeTradePlan(
      analysisWithAtr('strong bullish', 2), sr, makeConfidence(),
      undefined, undefined, mkMS('bullish', 94.8),
    )
    expect(plan.invalidationLevel!).toBeCloseTo(94.8 * 0.99, 3)
  })

  it('long: does NOT widen to a BOS more than 1 ATR away (stale structure)', () => {
    // BOS at 80 → structural stop 79.2; adjustment from 94.05 is ~14.85,
    // far beyond 1 ATR (2) — silently multiplying risk to reach stale
    // structure is refused; the conservative zone stop stands.
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const plan = computeTradePlan(
      analysisWithAtr('strong bullish', 2), sr, makeConfidence(),
      undefined, undefined, mkMS('bullish', 80),
    )
    expect(plan.invalidationLevel!).toBeCloseTo(95 * 0.99, 3)
  })

  it('long: ignores a BOS level inside or above the entry zone', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const plan = computeTradePlan(
      analysisWithAtr('strong bullish', 2), sr, makeConfidence(),
      undefined, undefined, mkMS('bullish', 96),  // inside the zone — not below it
    )
    expect(plan.invalidationLevel!).toBeCloseTo(95 * 0.99, 3)
  })

  it('long: an opposite-direction (bearish) BOS never moves the stop', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const plan = computeTradePlan(
      analysisWithAtr('strong bullish', 2), sr, makeConfidence(),
      undefined, undefined, mkMS('bearish', 94.8),
    )
    expect(plan.invalidationLevel!).toBeCloseTo(95 * 0.99, 3)
  })

  it('short: widens the stop above a bearish BOS in the sweep zone (symmetric)', () => {
    // ATR 2. Buffer 1%. Resistance 103–105 → naive stop = 105 × 1.01 = 106.05.
    // Bearish BOS at 105.3 (above the zone) → structural stop = 105.3 × 1.01
    // = 106.353. Naive sits BELOW it (sweepable); adjustment 0.303 ≤ 2 → widen.
    const sr = makeSR(null, { lower: 103, upper: 105, center: 104 })
    const plan = computeTradePlan(
      analysisWithAtr('strong bearish', 2), sr, makeConfidence(),
      undefined, undefined, mkMS('bearish', 105.3),
    )
    expect(plan.invalidationLevel!).toBeCloseTo(105.3 * 1.01, 3)
  })

  it('without ATR the rule is skipped — no volatility unit to bound the adjustment', () => {
    // makeAnalysis default atrPercent = null → buffer 0.5%, no BOS adjustment.
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const plan = computeTradePlan(
      makeAnalysis('strong bullish', 100), sr, makeConfidence(),
      undefined, undefined, mkMS('bullish', 94.8),
    )
    expect(plan.invalidationLevel!).toBeCloseTo(95 * (1 - 0.005), 3)
  })

  it('without marketStructure the stop is unchanged (backward compatible)', () => {
    const sr = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 110, upper: 112, center: 111 })
    const plan = computeTradePlan(makeAnalysis('strong bullish', 100), sr, makeConfidence())
    expect(plan.invalidationLevel!).toBeCloseTo(95 * (1 - 0.005), 3)
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
