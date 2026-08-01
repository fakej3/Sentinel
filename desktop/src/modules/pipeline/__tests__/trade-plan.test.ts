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
    indicatorSummary: { rsi: { value: 60, classification: 'healthy_bullish' }, macd: { histogram: 0.5, bias: 'bullish' }, adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' }, bollinger: { bandwidthPercent: 2, bandwidthState: 'normal', priceRelativeToBands: 'above_upper' }, stochRsi: { k: 60, d: 55, zone: 'neutral' } },
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

// ─────────────────────────────────────────────────────────────────────────────
// Hostile audit: explanation/state consistency and ladder coherence
// ─────────────────────────────────────────────────────────────────────────────

/** Full zone with independently controllable boundaries. */
function fullZone(
  id: string, lower: number, upper: number, type: 'support' | 'resistance',
): NonNullable<SupportResistanceResult['nearestSupport']> {
  return {
    id, type, origin: 'swing-high', state: 'active', center: (lower + upper) / 2,
    upper, lower, width: upper - lower, touchCount: 3, successfulReactions: 2,
    failedReactions: 0, broken: false, retested: false, firstDetectedIndex: 0,
    lastInteractionIndex: 10, age: 10, strength: 7, confidence: 7, evidence: [],
  }
}

function analysisWithAtr(trend: string, price: number, atrPercent: number | null): MarketAnalysisResult {
  const a = makeAnalysis(trend, price)
  return { ...a, price: { ...a.price, atrPercent } }
}

describe('trade plan — the patience message must match the actual reason', () => {
  it('does not claim ATR is unavailable when no_setup was caused by LOW ATR', () => {
    // near-zero-ATR is a distinct no_setup cause from "no S/R and no ATR".
    // The message is the only explanation a trader sees.
    const sr = makeSR({ lower: 95, upper: 96, center: 95.5 }, { lower: 105, upper: 106, center: 105.5 })
    const plan = computeTradePlan(analysisWithAtr('strong bullish', 100, 0.05), sr, makeConfidence())
    expect(plan.setupQuality).toBe('no_setup')
    expect(plan.setupQualityReason).toMatch(/below the 0.2% minimum/)
    expect(plan.patienceMessage).not.toMatch(/ATR is unavailable/)
    expect(plan.patienceMessage).toMatch(/volatility|stablecoin|peg/i)
  })

  it('explains an excessive-RR downgrade as target distance, not as data quality', () => {
    // RR > 6 downgrades to 'poor'. The patience message fell through to
    // "Data quality is insufficient — wait for more price history", which
    // describes a completely different condition.
    const sr = makeSR({ lower: 99, upper: 99.5, center: 99.25 }, { lower: 120, upper: 121, center: 120.5 })
    const plan = computeTradePlan(analysisWithAtr('strong bullish', 100, 1.0), sr, makeConfidence())
    expect(plan.setupQuality).toBe('poor')
    expect(plan.riskRewardRatio as number).toBeGreaterThan(6)
    expect(plan.patienceMessage).not.toMatch(/more price history/)
    expect(plan.patienceMessage).toMatch(/target|distant|closer/i)
  })

  it('explains a low-trust downgrade as trust, not as data volume', () => {
    const sr = makeSR({ lower: 97, upper: 98, center: 97.5 }, { lower: 103, upper: 104, center: 103.5 })
    const lowTrust = { score: 7.5, grade: 'strong', trust: { score: 20, level: 'low', factors: [], reductions: [] } } as unknown as ConfidenceResult
    const plan = computeTradePlan(analysisWithAtr('strong bullish', 100, 1.0), sr, lowTrust)
    expect(plan.setupQuality).toBe('poor')
    expect(plan.setupQualityReason).toMatch(/trust/i)
    expect(plan.patienceMessage).not.toMatch(/more price history/)
    expect(plan.patienceMessage).toMatch(/trust/i)
  })
})

describe('trade plan — target ladder coherence', () => {
  it('is strictly monotonic in the trade direction for a long', () => {
    // activeResistance is sorted by CENTRE, but the ladder pushes BOUNDARIES,
    // and the filter compared each candidate against targets[0] rather than the
    // last pushed target. A wide high-centre zone can therefore contribute a
    // boundary below an already-pushed one, producing T1 < T2 > T3.
    const near = fullZone('r1', 105, 106, 'resistance')   // centre 105.5
    const mid = fullZone('r2', 130, 131, 'resistance')    // centre 130.5
    const wide = fullZone('r3', 120, 145, 'resistance')   // centre 132.5, lower 120
    const sr = {
      ...makeSR({ lower: 95, upper: 96, center: 95.5 }),
      nearestResistance: near,
      activeResistance: [near, mid, wide],
      activeSupport: [fullZone('s1', 95, 96, 'support')],
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bullish', 100, 1.0), sr, makeConfidence())
    for (let i = 1; i < plan.targets.length; i++) {
      expect(plan.targets[i], `target ${i} (${plan.targets[i]}) must exceed target ${i - 1} (${plan.targets[i - 1]})`)
        .toBeGreaterThan(plan.targets[i - 1])
    }
  })

  it('is strictly monotonic in the trade direction for a short', () => {
    const near = fullZone('s1', 94, 95, 'support')        // centre 94.5
    const mid = fullZone('s2', 70, 71, 'support')         // centre 70.5
    const wide = fullZone('s3', 55, 80, 'support')        // centre 67.5, upper 80
    const sr = {
      ...makeSR(null, { lower: 104, upper: 105, center: 104.5 }),
      nearestSupport: near,
      activeSupport: [near, mid, wide],
      activeResistance: [fullZone('r1', 104, 105, 'resistance')],
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bearish', 100, 1.0), sr, makeConfidence())
    for (let i = 1; i < plan.targets.length; i++) {
      expect(plan.targets[i], `target ${i} (${plan.targets[i]}) must be below target ${i - 1} (${plan.targets[i - 1]})`)
        .toBeLessThan(plan.targets[i - 1])
    }
  })
})

describe('trade plan — every non-actionable tier explains its own cause', () => {
  it('a ranging market is explained as having no direction, not as missing ATR', () => {
    // 'no_levels' fires for a ranging trend even when ATR is healthy, because
    // the ATR fallback is gated on a directional bias.
    const sr = makeSR({ lower: 95, upper: 96, center: 95.5 }, { lower: 105, upper: 106, center: 105.5 })
    const plan = computeTradePlan(analysisWithAtr('ranging', 100, 2.0), sr, makeConfidence())
    expect(plan.setupQuality).toBe('no_setup')
    expect(plan.patienceMessage).toMatch(/ranging|directional/i)
    expect(plan.patienceMessage).not.toMatch(/no usable ATR/)
  })

  it('an MTF-conflict downgrade to poor is explained as a timeframe conflict', () => {
    // Reachable through the API even though the pipeline does not yet supply
    // MTF agreement. Without its own cause this fell to the generic fallback.
    const sr = makeSR({ lower: 97, upper: 98, center: 97.5 }, { lower: 103, upper: 104, center: 103.5 })
    const conflict = {
      agreement: 'strong_conflict', conflictingCount: 2,
    } as unknown as MultiTimeframeAgreement
    const plan = computeTradePlan(
      analysisWithAtr('strong bullish', 100, 1.0), sr, makeConfidence(4.5), undefined, conflict,
    )
    expect(plan.setupQuality).toBe('poor')
    expect(plan.patienceMessage).toMatch(/timeframe/i)
    expect(plan.patienceMessage).not.toMatch(/more price history/)
  })

  it('no non-actionable plan ever claims a condition the classifier did not find', () => {
    // Property sweep: the patience message must never mention "price history"
    // unless the classifier actually cited a data-volume problem.
    const cases: Array<[string, number, number | null, number, number]> = [
      ['strong bullish', 100, 0.05, 7.5, 100],  // near-zero ATR
      ['ranging', 100, 2.0, 7.5, 100],           // no direction
      ['strong bullish', 100, 1.0, 7.5, 20],     // low trust
      ['strong bullish', 100, 1.0, 2.0, 100],    // low confidence
    ]
    for (const [trend, price, atr, score, trust] of cases) {
      const sr = makeSR({ lower: 97, upper: 98, center: 97.5 }, { lower: 103, upper: 104, center: 103.5 })
      const c = { score, grade: 'strong', trust: { score: trust, level: 'high', factors: [], reductions: [] } } as unknown as ConfidenceResult
      const plan = computeTradePlan(analysisWithAtr(trend, price, atr), sr, c)
      if (plan.actionable) continue
      expect(plan.patienceMessage, `${trend}/atr=${atr}/conf=${score}/trust=${trust}`)
        .not.toMatch(/more price history/)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Entry distance validation (Issue #1)
// MAX_ENTRY_DISTANCE_ATR = 5; ATR = currentPrice * atrPercent / 100
// SHORT gap = max(0, entryZone.lower − currentPrice)   [entry is above price]
// LONG  gap = max(0, currentPrice − entryZone.upper)   [entry is below price]
// ─────────────────────────────────────────────────────────────────────────────

describe('trade plan — entry distance validation', () => {
  it('SHORT: entry zone 7 ATR above price → avoid (entry_too_distant)', () => {
    // price=1000, ATR=10 → threshold=50; resistance.lower=1070 → gap=70 → 7 ATR
    const sr = {
      ...makeSR(null, { lower: 1070, upper: 1080, center: 1075 }),
      nearestSupport: fullZone('s', 900, 910, 'support'),
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bearish', 1000, 1.0), sr, makeConfidence())
    expect(plan.setupQuality).toBe('avoid')
    expect(plan.actionable).toBe(false)
    expect(plan.setupQualityReason).toMatch(/ATR away/i)
    expect(plan.patienceMessage).toMatch(/ATR away/i)
  })

  it('LONG: entry zone 7 ATR below price → avoid (entry_too_distant)', () => {
    // price=1000, ATR=10 → threshold=50; support.upper=930 → gap=70 → 7 ATR
    const sr = {
      ...makeSR({ lower: 920, upper: 930, center: 925 }, null),
      nearestResistance: fullZone('r', 1060, 1070, 'resistance'),
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bullish', 1000, 1.0), sr, makeConfidence())
    expect(plan.setupQuality).toBe('avoid')
    expect(plan.actionable).toBe(false)
    expect(plan.setupQualityReason).toMatch(/ATR away/i)
    expect(plan.patienceMessage).toMatch(/ATR away/i)
  })

  it('SHORT: entry zone 3 ATR above price → passes the distance gate', () => {
    // price=1000, ATR=10 → threshold=50; resistance.lower=1030 → gap=30 → 3 ATR ≤ 5
    const sr = {
      ...makeSR(null, { lower: 1030, upper: 1040, center: 1035 }),
      nearestSupport: fullZone('s', 1010, 1015, 'support'),
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bearish', 1000, 1.0), sr, makeConfidence())
    expect(plan.setupQualityReason).not.toMatch(/ATR away/i)
    expect(plan.setupQuality).not.toBe('avoid')
  })

  it('LONG: entry zone 3 ATR below price → passes the distance gate', () => {
    // price=1000, ATR=10 → threshold=50; support.upper=970 → gap=30 → 3 ATR ≤ 5
    const sr = {
      ...makeSR({ lower: 962, upper: 970, center: 966 }, null),
      nearestResistance: fullZone('r', 1000, 1010, 'resistance'),
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bullish', 1000, 1.0), sr, makeConfidence())
    expect(plan.setupQualityReason).not.toMatch(/ATR away/i)
    expect(plan.setupQuality).not.toBe('avoid')
  })

  it('SHORT: price inside the entry zone → gap=0 → distance gate does not fire', () => {
    // price=1035, zone 1030-1040 → max(0, 1030-1035)=0 → allowed
    const resistanceZone = fullZone('r', 1030, 1040, 'resistance')
    const sr = {
      ...makeSR(null, null),
      currentZone:    resistanceZone,
      nearestSupport: fullZone('s', 1010, 1015, 'support'),
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bearish', 1035, 1.0), sr, makeConfidence())
    expect(plan.setupQualityReason).not.toMatch(/ATR away/i)
    expect(plan.entryZone).not.toBeNull()
  })

  it('LONG: price inside the entry zone → gap=0 → distance gate does not fire', () => {
    // price=925, zone 920-930 → max(0, 925-930)=0 → allowed
    const supportZone = fullZone('s', 920, 930, 'support')
    const sr = {
      ...makeSR(null, null),
      currentZone:       supportZone,
      nearestResistance: fullZone('r', 960, 970, 'resistance'),
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bullish', 925, 1.0), sr, makeConfidence())
    expect(plan.setupQualityReason).not.toMatch(/ATR away/i)
    expect(plan.entryZone).not.toBeNull()
  })

  it('when ATR is null the distance gate is skipped entirely', () => {
    // atrPercent=null → cannot compute ATR → gate is skipped, even for extreme distances
    const sr = {
      ...makeSR(null, { lower: 2000, upper: 2100, center: 2050 }),
      nearestSupport: fullZone('s', 800, 810, 'support'),
    } as SupportResistanceResult
    const plan = computeTradePlan(analysisWithAtr('strong bearish', 1000, null), sr, makeConfidence())
    expect(plan.setupQualityReason).not.toMatch(/ATR away/i)
  })
})
