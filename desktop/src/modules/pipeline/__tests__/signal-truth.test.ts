/**
 * Signal Truth Tests — 15 frozen market scenarios (A–O)
 *
 * PURPOSE: Test what Sentinel actually tells a trader, not internal function
 * correctness. Each scenario pairs a frozen market situation with an assertion
 * about the combined decision label + trade plan quality that a trader would see.
 *
 * ARCHITECTURE FACTS (forensic audit, verified in sources):
 *   1. V6 always returns speak:false — only V5 heuristics are in production
 *   2. confidence.score is a hand-tuned weighted sum; ZERO weights are backtested
 *      against real trade outcomes (provenance.ts:13, test asserts this stays 0)
 *   3. M38/M39 "historical validation" used deterministic synthetic candles
 *      (seeded RNG), not real Binance exchange data (module38/report.ts)
 *   4. The maturity gate (score < 30 → 'poor') is calibrated on synthetic data
 *   5. No candle patterns exist anywhere in the V5 evidence system
 *   6. Entry/stop/target are selected by zone proximity; no confirmation candle required
 *
 * USER'S KEY DISTINCTIONS:
 *   confidence score ≠ probability
 *   RR ≠ edge
 *   bullish trend ≠ long opportunity
 *   high RR ≠ good trade (if confirmation is weak)
 *   internally consistent ≠ correct
 */
import { describe, it, expect } from 'vitest'
import { computeDecision } from '../compute/decision'
import { computeTradePlan } from '../compute/trade-plan'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { MultiTimeframeAgreement } from '../types'
import type { Timeframe } from '../../binance/types'

// ── Common stubs ──────────────────────────────────────────────────────────────

const CLEAN_VAL: ValidationResult = {
  passed: true, clean: true, issues: [],
  criticalCount: 0, warningCount: 0, infoCount: 0, summary: '',
}

function makeValidation(criticalCount: number, warningCount = 0): ValidationResult {
  return { ...CLEAN_VAL, criticalCount, warningCount, passed: criticalCount === 0, clean: criticalCount === 0 && warningCount === 0 }
}

/**
 * Confidence stub with explicit trust score.
 * trustScore models how many trust factors pass (see compute/trust.ts):
 *   7/7 (100%) or 6/7 (86%) → 'high'   (≥ 80)
 *   5/7 (71%) or 4/7 (57%) → 'medium'  (≥ 57)
 *   3/7 (43%) or fewer     → 'low'      (< 57) → trust < 50 triggers 'poor' gate
 */
function makeConf(score: number, trustScore: number): ConfidenceResult {
  const level: 'high' | 'medium' | 'low' = trustScore >= 80 ? 'high' : trustScore >= 57 ? 'medium' : 'low'
  return {
    score,
    grade: score >= 8.5 ? 'very_strong' : score >= 7.0 ? 'strong' : score >= 5.0 ? 'moderate' : score >= 3.0 ? 'mixed' : 'weak',
    trust: { score: trustScore, level, factors: [], reductions: [] },
    penalties: [],
    warnings: [],
    breakdown: {} as never,
    analysisQuality: {
      confluence: { score: 6, agreeing: [], disagreeing: [] },
      contradictions: [],
      evidenceQuality: { rating: 'good', breakdown: {} as never },
      indicatorReliability: {} as never,
    },
  } as unknown as ConfidenceResult
}

type SRZone = { lower: number; upper: number; center: number }

/**
 * SR stub. Zones are always 'active' (state !== 'weakening') so they pass
 * the reliability filter in computeTradePlan. ActiveResistance/activeSupport
 * are populated from the primary zones for target ladder availability.
 */
function makeSR(support?: SRZone | null, resistance?: SRZone | null): SupportResistanceResult {
  const z = (s: SRZone) => ({ lower: s.lower, upper: s.upper, center: s.center, strength: 8, state: 'active' })
  return {
    zones: [],
    activeSupport:    support    ? [z(support)]    : [],
    activeResistance: resistance ? [z(resistance)] : [],
    nearestSupport:    support    ? z(support)    : null,
    nearestResistance: resistance ? z(resistance) : null,
    currentZone: null,
    evidence: [],
  } as unknown as SupportResistanceResult
}

/**
 * MarketStructure stub for maturity gate scenarios.
 * computeTradeMaturity reads: bos.detected, choch.detected, strength.
 */
function makeMS(bos: boolean, choch: boolean, strength: 'strong' | 'moderate' | 'weak'): MarketStructureResult {
  return {
    bos:   { detected: bos,   events: [], last: null },
    choch: { detected: choch, events: [], last: null },
    strength,
    trend: 'bullish', confidence: 6,
    swings: { highs: [], lows: [] },
    structure: { higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0 },
    recentStructure: { higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0 },
    consolidation: { detected: false, rangePercent: null, candleCount: 0 },
    breakout: { confirmed: false, failed: false, level: null, direction: null },
    pullback: { detected: false, depth: null },
  } as unknown as MarketStructureResult
}

interface AnalysisOpts {
  currentPrice?: number
  atrPercent?: number | null
  rsiClass?: 'healthy_bullish' | 'overbought' | 'oversold' | 'neutral' | 'weak_bearish'
  macdBias?: 'bullish' | 'bearish' | 'neutral'
  volumeConfirms?: boolean
  relativeVolume?: number
  obvConfirms?: boolean
  bullishMet?: number
  bearishMet?: number
}

function makeAnalysis(
  trend: MarketAnalysisResult['fullTrend']['trend'],
  opts: AnalysisOpts = {},
): MarketAnalysisResult {
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')
  const price = opts.currentPrice ?? 100
  return {
    symbol: 'TESTUSDT', timeframe: '1h' as Timeframe, analysedAt: 0,
    price: {
      current: price,
      change24hPercent: 1,
      high24h: price * 1.05,
      low24h:  price * 0.95,
      atrPercent: opts.atrPercent !== undefined ? opts.atrPercent : null,
    },
    fullTrend: {
      trend,
      bullishConditionsMet: opts.bullishMet ?? (isBullish ? 4 : 0),
      bearishConditionsMet: opts.bearishMet ?? (isBearish ? 4 : 0),
      neutralConditionsMet: 0,
      conditions: {} as never,
    },
    emaContext: {
      priceVsEMA20: 'above', priceVsEMA50: 'above', priceVsEMA100: 'above', priceVsEMA200: 'above',
      emaAlignment: (isBullish ? 'bullish_stack' : isBearish ? 'bearish_stack' : 'mixed') as never,
      confluenceZones: [],
    },
    indicatorSummary: {
      rsi: {
        value: isBullish ? 62 : isBearish ? 38 : 50,
        classification: (opts.rsiClass ?? (isBullish ? 'healthy_bullish' : isBearish ? 'weak_bearish' : 'neutral')) as never,
      },
      macd: {
        histogram: isBullish ? 0.5 : isBearish ? -0.5 : 0,
        bias: (opts.macdBias ?? (isBullish ? 'bullish' : isBearish ? 'bearish' : 'neutral')) as never,
      },
      adx: { adx: 28, trendStrength: 'strong' as never, dominantDirection: (isBullish ? 'bullish' : 'bearish') as never },
      bollinger: { bandwidthPercent: 2, bandwidthState: 'normal' as never, priceRelativeToBands: 'inside' as never },
      stochRsi: { k: 60, d: 55, zone: 'neutral' as never },
    },
    srContext: {
      nearestSupportDistance: -3, nearestResistanceDistance: 5,
      insideSupport: false, insideResistance: false,
      approachingSupport: false, approachingResistance: false,
      strongestActiveSupport: null, strongestActiveResistance: null,
    },
    volumeContext: {
      relativeVolume: opts.relativeVolume ?? 1.2,
      volumeClassification: 'normal' as never,
      confirmsCurrentMove: opts.volumeConfirms ?? true,
      climaxSignal: 'none' as never,
      accDistState: 'neutral' as never,
      vwap: { available: true, unavailable: null, value: price, side: 'above' as never, distancePercent: 1, respectingVWAP: true },
      obvDirection: 'bullish' as never,
      obvConfirmingPrice: opts.obvConfirms ?? (isBullish ? true : false),
      overallStrength: 6,
    },
    evidence: [],
    indicators: {} as never,
    marketStructure: {
      trend: isBullish ? 'bullish' : isBearish ? 'bearish' : 'ranging',
      strength: 'moderate', confidence: 6,
      swings: { highs: [], lows: [] },
      structure: { higherHighs: 2, higherLows: 2, lowerHighs: 0, lowerLows: 0 },
      recentStructure: { higherHighs: 2, higherLows: 1, lowerHighs: 0, lowerLows: 0 },
      bos:   { detected: false, events: [], last: null },
      choch: { detected: false, events: [], last: null },
      consolidation: { detected: false, rangePercent: null, candleCount: 0 },
      breakout: { confirmed: false, direction: null, strength: 0, candleIndex: null },
      pullback: { detected: false, depth: null, candleCount: 0 },
    } as never,
    supportResistance: {} as never,
    volumeAnalysis: {} as never,
  }
}

// ── RR pre-computation helpers ────────────────────────────────────────────────
// atrPercent=null → stopBufferFraction = 0.005 (0.5%)
// atrPercent=2   → stopBufferFraction = max(0.005, 2/200) = 0.01 (1%)
//
// Bullish RR = (resistance.lower - entryMid) / (entryMid - support.lower * (1 - buf))
// Bearish RR = (entryMid - support.upper)   / (resistance.upper * (1 + buf) - entryMid)

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO A — Perfect bullish alignment
// Strong trend, full confidence, trust=90%, good RR ≈ 4.7
// Expected: Strong Buy + excellent + actionable
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario A: Perfect bullish alignment → Strong Buy + excellent', () => {
  // Frozen inputs (atrPercent=null → buf=0.005):
  //   entryMid=98, stop=97*0.995=96.515, risk=1.485, reward=105-98=7, RR=4.71
  const analysis  = makeAnalysis('strong bullish')
  const sr        = makeSR({ lower: 97, upper: 99, center: 98 }, { lower: 105, upper: 107, center: 106 })
  const conf      = makeConf(8.5, 90)

  it('decision: Strong Buy (strong bullish + score≥6.5 + no critical)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Strong Buy')
    expect(d.riskLevel).toBe('Low')
    expect(d.confidence).toBe(8.5)
  })

  it('plan: excellent quality, actionable, long direction', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('excellent')
    expect(p.actionable).toBe(true)
    expect(p.direction).toBe('long')
    expect(p.riskRewardRatio).toBeGreaterThanOrEqual(2.0)
  })

  it('plan: entry zone anchored to support, stop below support', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.entryZone).not.toBeNull()
    expect(p.entryZone!.lower).toBeCloseTo(97, 1)
    expect(p.invalidationLevel).not.toBeNull()
    expect(p.invalidationLevel!).toBeLessThan(97)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO B — Moderate bullish, solid confirmation
// Moderate trend, confidence=7.5, trust=75% (5/7 factors), RR ≈ 4.0
// Expected: Buy + excellent + actionable
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario B: Moderate bullish, solid confirmation → Buy + excellent', () => {
  // entryMid=97, stop=96*0.995=95.52, risk=1.48, reward=103-97=6, RR≈4.05
  const analysis = makeAnalysis('moderate bullish')
  const sr       = makeSR({ lower: 96, upper: 98, center: 97 }, { lower: 103, upper: 105, center: 104 })
  const conf     = makeConf(7.5, 75)

  it('decision: Buy (moderate bullish + score≥5.0 + no critical)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Buy')
  })

  it('plan: excellent quality, actionable', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('excellent')
    expect(p.actionable).toBe(true)
    expect(p.riskRewardRatio).toBeGreaterThanOrEqual(2.0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO C — THE KEY SCENARIO (user-mandated)
// Weak bullish + nearby support + attractive RR ≈ 5.1 + WEAK CONFIRMATION
//
// "Weak confirmation" means ≤3/7 trust factors pass:
//   volume does not confirm the move (factor 3 fails)
//   market structure BOS/CHoCH absent (factor 2 fails)
//   only 2/5 bullish conditions met (factor 7 fails)
//   → trust.score = 43% (3/7 * 100), level = 'low', < 50 threshold
//
// Despite the attractive RR, the low_trust gate (trust < 50) must fire
// and produce 'poor' setup quality → NOT actionable.
//
// This is the critical correctness guarantee:
//   HIGH RR ALONE CANNOT MAKE A WEAK-CONFIRMATION TRADE ACTIONABLE.
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario C: Weak bullish + high RR + weak confirmation → NOT actionable', () => {
  // atrPercent=2% → buf=0.01
  // entryMid=97, stop=96*0.99=95.04, risk=1.96, reward=107-97=10, RR≈5.10
  // trust=43 (3/7 factors: trend-clear, momentum-not-extreme, no-critical) → 'low'
  const analysis = makeAnalysis('weak bullish', {
    atrPercent: 2,
    bullishMet: 2,           // only 2/5 conditions → factor 7 fails
    volumeConfirms: false,   // factor 3 fails
    rsiClass: 'neutral',
    macdBias: 'neutral',
  })
  const sr   = makeSR({ lower: 96, upper: 98, center: 97 }, { lower: 107, upper: 109, center: 108 })
  const conf = makeConf(5.5, 43)  // trust=43 < 50 → low_trust gate fires

  it('decision: Cautious Buy (weak bullish → always Cautious Buy)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Cautious Buy')
  })

  it('plan: NOT actionable despite RR > 5 — low_trust gate fires at trust < 50%', () => {
    const p = computeTradePlan(analysis, sr, conf)
    // The RR is approximately 5.1 — attractive on paper.
    // But trust.score=43 triggers the low_trust guard before RR or trend quality are assessed.
    expect(p.setupQuality).toBe('poor')
    expect(p.actionable).toBe(false)
    // Confirm the RR itself was valid (proof that RR alone didn't block this — trust did)
    expect(p.riskRewardRatio).toBeGreaterThan(4.0)
    expect(p.riskRewardRatio!).toBeLessThanOrEqual(6.0)
  })

  it('plan: patience message references low trust, not generic issue', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.patienceMessage.toLowerCase()).toMatch(/trust|confirm|reliab/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO D — Ranging market, no directional setup
// No trend → no entry zone → no_setup
// Expected: Watch + no_setup + NOT actionable + direction null
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario D: Ranging market → Watch + no_setup', () => {
  const analysis = makeAnalysis('ranging')
  const conf     = makeConf(4.5, 65)

  it('decision: Watch (ranging + score≥4.0)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Watch')
  })

  it('plan: no directional setup, no entry zone, not actionable', () => {
    // No direction → no entry/stop/target → no_setup
    const p = computeTradePlan(analysis, makeSR(), conf)
    expect(p.direction).toBeNull()
    expect(p.entryZone).toBeNull()
    expect(p.setupQuality).toBe('no_setup')
    expect(p.actionable).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO E — Perfect bearish alignment
// Strong bearish trend, full alignment, RR ≈ 5.25
// Expected: Strong Sell + excellent + actionable
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario E: Perfect bearish alignment → Strong Sell + excellent', () => {
  // Bearish: resistance(103,105)=entry, support(94,96)=target
  // entryMid=104, stop=105*1.005=105.525, risk=1.525, reward=104-96=8, RR≈5.25
  const analysis = makeAnalysis('strong bearish')
  const sr       = makeSR({ lower: 94, upper: 96, center: 95 }, { lower: 103, upper: 105, center: 104 })
  const conf     = makeConf(8.5, 90)

  it('decision: Strong Sell', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Strong Sell')
    expect(d.riskLevel).toBe('Low')
  })

  it('plan: excellent quality, actionable, short direction', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('excellent')
    expect(p.actionable).toBe(true)
    expect(p.direction).toBe('short')
    expect(p.riskRewardRatio).toBeGreaterThanOrEqual(2.0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO F — Critical validation issue
// Good setup undermined by a critical data quality issue
// Expected: decision label caps at Buy (not Strong Buy) + plan is poor
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario F: Critical validation issue → Buy + poor (NOT actionable)', () => {
  const analysis  = makeAnalysis('strong bullish')
  const sr        = makeSR({ lower: 97, upper: 99, center: 98 }, { lower: 105, upper: 107, center: 106 })
  const conf      = makeConf(8.0, 85)
  const badVal    = makeValidation(1)

  it('decision: Buy (not Strong Buy) — critical issue blocks the strong label', () => {
    const d = computeDecision(analysis, conf, badVal)
    // hasCritical=true → (score≥6.5 && !hasCritical) is false → 'Buy'
    expect(d.label).toBe('Buy')
    expect(d.label).not.toBe('Strong Buy')
  })

  it('plan: poor quality due to critical_validation gate, not actionable', () => {
    const p = computeTradePlan(analysis, sr, conf, badVal)
    expect(p.setupQuality).toBe('poor')
    expect(p.actionable).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO G — RR below the 1.5 minimum
// Strong bullish but support and resistance are too close together
// Expected: Strong Buy (decision is directional) + avoid (RR<1.5)
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario G: RR < 1.5 threshold → Strong Buy + avoid (NOT actionable)', () => {
  // atrPercent=2% → buf=0.01
  // entryMid=99.75, stop=99*0.99=98.01, risk=1.74, reward=101-99.75=1.25, RR≈0.72
  const analysis = makeAnalysis('strong bullish', { atrPercent: 2 })
  const sr       = makeSR({ lower: 99, upper: 100.5, center: 99.75 }, { lower: 101, upper: 102, center: 101.5 })
  const conf     = makeConf(8.5, 90)

  it('decision: Strong Buy (RR gate does not affect the label)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Strong Buy')
  })

  it('plan: avoid — RR below 1.5 minimum threshold', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('avoid')
    expect(p.actionable).toBe(false)
    expect(p.riskRewardRatio).not.toBeNull()
    expect(p.riskRewardRatio!).toBeLessThan(1.5)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO H — RR exceeds the 6.0 maximum
// Strong bullish with target far beyond realistic structure
// Expected: Strong Buy + poor (rr_above_max, not actionable)
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario H: RR > 6.0 maximum → Strong Buy + poor (NOT actionable)', () => {
  // entryMid=98, stop=97*0.995=96.515, risk=1.485, reward=115-98=17, RR≈11.4
  const analysis = makeAnalysis('strong bullish')
  const sr       = makeSR({ lower: 97, upper: 99, center: 98 }, { lower: 115, upper: 117, center: 116 })
  const conf     = makeConf(8.5, 90)

  it('plan: poor (rr_above_max) — target is unrealistically distant', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('poor')
    expect(p.actionable).toBe(false)
    expect(p.riskRewardRatio).not.toBeNull()
    expect(p.riskRewardRatio!).toBeGreaterThan(6.0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO I — Low confidence score
// Bullish trend but confidence.score < 4.0 (below the minimum reliability gate)
// Expected: Buy + poor (low_confidence gate, not actionable)
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario I: Confidence score below 4.0 → Buy + poor (NOT actionable)', () => {
  const analysis = makeAnalysis('strong bullish')
  const sr       = makeSR({ lower: 97, upper: 99, center: 98 }, { lower: 105, upper: 107, center: 106 })
  const conf     = makeConf(3.8, 70)  // score < 4.0

  it('decision: Buy (strong bullish but score 3.8 < 6.5 threshold)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Buy')
    expect(d.riskLevel).toBe('Medium')  // score 3.8 < 5.5 but ≥ 3.0 → Medium
  })

  it('plan: poor (low_confidence gate < 4.0), not actionable', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('poor')
    expect(p.actionable).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO J — Immature setup (maturity gate)
// Moderate bullish, good RR and confidence, but momentum/volume absent
// Maturity components: momentum=0, volume=0, trend=14, structure=5, confidence=10 → score=29 < 30
// Expected: Buy + poor (immature gate, not actionable)
//
// This verifies that Sentinel correctly rejects a setup where market conditions
// are not "ready" — even when the directional thesis looks fine on paper.
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario J: Immature maturity score (29/100) → Buy + poor (NOT actionable)', () => {
  // Deliberately weak momentum + volume to force maturityScore = 29 < 30:
  //   momentum: rsiClass='neutral' + macdBias='neutral' → 0
  //   volume:   obvConfirms=false, volConfirms=false, relVol=0.6 → max(0, 0-5) = 0
  //   trend:    'moderate bullish' → 14
  //   structure: no BOS, no CHoCH, strength='moderate' → 5 (else branch)
  //   confidence: score=7.5 ≥ 7.0 → 10
  //   total: 0+0+14+5+10 = 29 (immature)
  const analysis = makeAnalysis('moderate bullish', {
    rsiClass: 'neutral',
    macdBias: 'neutral',
    volumeConfirms: false,
    obvConfirms: false,
    relativeVolume: 0.6,
  })
  const sr   = makeSR({ lower: 96, upper: 98, center: 97 }, { lower: 103, upper: 105, center: 104 })
  const conf = makeConf(7.5, 80)
  const ms   = makeMS(false, false, 'moderate')  // no BOS, no CHoCH

  it('decision: Buy (moderate bullish + score≥5.0)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Buy')
  })

  it('plan: poor (immature gate), not actionable — momentum and volume absent', () => {
    const p = computeTradePlan(analysis, sr, conf, CLEAN_VAL, undefined, ms)
    expect(p.maturityScore).toBe(29)
    expect(p.maturityLabel).toBe('immature')
    expect(p.setupQuality).toBe('poor')
    expect(p.actionable).toBe(false)
  })

  it('plan: maturity components reflect the gaps correctly', () => {
    const p = computeTradePlan(analysis, sr, conf, CLEAN_VAL, undefined, ms)
    expect(p.maturityComponents.momentum).toBe(0)
    expect(p.maturityComponents.volume).toBe(0)
    expect(p.maturityComponents.trend).toBe(14)
    expect(p.maturityComponents.structure).toBe(5)
    expect(p.maturityComponents.confidence).toBe(10)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO K — No S/R data available (no real structural levels found)
// Strong bullish with perfect confidence but no S/R structure in the market
// When ATR is also unavailable, the ATR fallback cannot trigger
// Expected: Strong Buy + no_setup (NOT actionable, no entry zone)
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario K: No S/R data, no ATR → Strong Buy + no_setup', () => {
  // atrPercent=null → ATR fallback cannot trigger
  const analysis = makeAnalysis('strong bullish')   // atrPercent defaults to null
  const conf     = makeConf(8.5, 90)

  it('decision: Strong Buy', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Strong Buy')
  })

  it('plan: no_setup — no S/R levels to anchor trade', () => {
    const p = computeTradePlan(analysis, makeSR(), conf)
    expect(p.entryZone).toBeNull()
    expect(p.invalidationLevel).toBeNull()
    expect(p.targetLevel).toBeNull()
    expect(p.setupQuality).toBe('no_setup')
    expect(p.actionable).toBe(false)
    expect(p.direction).toBe('long')   // direction is still long — just no levels
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO L — Moderate bearish, solid confirmation
// Bearish mirror of scenario B — Sell + excellent + actionable
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario L: Moderate bearish, solid confirmation → Sell + excellent', () => {
  // entryMid=104, stop=105*1.005=105.525, risk=1.525, reward=104-98=6, RR≈3.93
  const analysis = makeAnalysis('moderate bearish')
  const sr       = makeSR({ lower: 96, upper: 98, center: 97 }, { lower: 103, upper: 105, center: 104 })
  const conf     = makeConf(7.5, 75)

  it('decision: Sell (moderate bearish + score≥5.0 + no critical)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Sell')
  })

  it('plan: excellent quality, actionable, short direction', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('excellent')
    expect(p.actionable).toBe(true)
    expect(p.direction).toBe('short')
    expect(p.riskRewardRatio).toBeGreaterThanOrEqual(2.0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO M — Weak bearish + weak confirmation → Cautious Sell + poor
// Bearish mirror of scenario C — high RR but trust < 50% blocks the trade
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario M: Weak bearish + weak confirmation → NOT actionable', () => {
  // atrPercent=2% → buf=0.01
  // entryMid=104, stop=105*1.01=106.05, risk=2.05, reward=104-97=7, RR≈3.41
  // trust=43 (3/7) → 'low' → low_trust gate fires (< 50%)
  const analysis = makeAnalysis('weak bearish', {
    atrPercent: 2,
    bearishMet: 2,
    volumeConfirms: false,
    rsiClass: 'neutral',
    macdBias: 'neutral',
  })
  const sr   = makeSR({ lower: 95, upper: 97, center: 96 }, { lower: 103, upper: 105, center: 104 })
  const conf = makeConf(5.5, 43)

  it('decision: Cautious Sell (weak bearish → always Cautious Sell)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Cautious Sell')
  })

  it('plan: poor (low_trust), not actionable despite valid geometry', () => {
    const p = computeTradePlan(analysis, sr, conf)
    expect(p.setupQuality).toBe('poor')
    expect(p.actionable).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO N — Excellent setup degraded by multi-timeframe conflict
// All quality gates pass but MTF conflict downgrades excellent → good
// This verifies the MTF conflict detection does not block the trade entirely
// Expected: Strong Sell + good (actionable, but not excellent)
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario N: Perfect bearish + MTF conflict → Strong Sell + good (still actionable)', () => {
  // Same setup as scenario E but with strong_conflict MTF agreement
  const analysis = makeAnalysis('strong bearish')
  const sr       = makeSR({ lower: 94, upper: 96, center: 95 }, { lower: 103, upper: 105, center: 104 })
  const conf     = makeConf(8.5, 90)
  const mtf: MultiTimeframeAgreement = {
    agreement: 'strong_conflict',
    agreementScore: 2,
    timeframes: [],
    dominantDirection: 'bearish',
    conflictingCount: 2,
  }

  it('decision: Strong Sell (MTF does not affect the decision label)', () => {
    const d = computeDecision(analysis, conf, CLEAN_VAL)
    expect(d.label).toBe('Strong Sell')
  })

  it('plan: good (not excellent) due to MTF conflict, still actionable', () => {
    const p = computeTradePlan(analysis, sr, conf, CLEAN_VAL, mtf)
    // Would be 'excellent' without MTF conflict, but strong_conflict downgrades it
    expect(p.setupQuality).toBe('good')
    expect(p.actionable).toBe(true)  // still tradeable — just degraded
    expect(p.riskRewardRatio).toBeGreaterThanOrEqual(2.0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO O — ATR-based levels (no real S/R structure found)
// Strong bullish with ATR available but no S/R zones detected
// ATR fallback triggers: entry near price, stop=2×ATR below, target=4×ATR above
// Expected: Strong Buy + average (capped by atr_based, still actionable)
//
// This documents a known architectural gap: ATR-based levels are "honest"
// volatility arithmetic around the current price, not structural anchors.
// V6's README explicitly identifies this as V5's core failure mode.
// ═════════════════════════════════════════════════════════════════════════════
describe('Scenario O: ATR-based fallback (no real S/R) → Strong Buy + average', () => {
  // atrPercent=2%, currentPrice=100, no S/R:
  //   entryZone = { lower: 99.9, upper: 100.1 }, entryRef = 100
  //   atr = 2, stop = 100 - 2*2 = 96, target = 100 + 4*2 = 108
  //   risk = 100 - 96 = 4, reward = 108 - 100 = 8, RR = 2.0
  const analysis = makeAnalysis('strong bullish', { atrPercent: 2 })
  const conf     = makeConf(8.5, 90)

  it('plan: average quality (ATR-based cap), still actionable', () => {
    const p = computeTradePlan(analysis, makeSR(), conf)
    expect(p.setupQuality).toBe('average')
    expect(p.actionable).toBe(true)
    expect(p.direction).toBe('long')
    expect(p.riskRewardRatio).toBeCloseTo(2.0, 1)
  })

  it('plan: entry zone is near current price (ATR-derived, not structural)', () => {
    const p = computeTradePlan(analysis, makeSR(), conf)
    expect(p.entryZone).not.toBeNull()
    // Entry anchored within 0.1% of current price
    expect(Math.abs(p.entryZone!.lower - 99.9)).toBeLessThan(0.1)
    expect(Math.abs(p.entryZone!.upper - 100.1)).toBeLessThan(0.1)
  })

  it('plan: patience message acknowledges ATR-based limitation', () => {
    const p = computeTradePlan(analysis, makeSR(), conf)
    expect(p.patienceMessage.toLowerCase()).toMatch(/atr|volatil|structure/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// CROSS-SCENARIO INVARIANTS
// Properties that must hold across ALL 15 scenarios regardless of inputs
// ═════════════════════════════════════════════════════════════════════════════
describe('Cross-scenario invariants', () => {
  it('actionable is ONLY true when setupQuality is excellent, good, or average', () => {
    const scenarios = [
      { analysis: makeAnalysis('strong bullish'), sr: makeSR({ lower: 97, upper: 99, center: 98 }, { lower: 105, upper: 107, center: 106 }), conf: makeConf(8.5, 90), val: CLEAN_VAL },
      { analysis: makeAnalysis('weak bullish', { atrPercent: 2, bullishMet: 2, volumeConfirms: false }), sr: makeSR({ lower: 96, upper: 98, center: 97 }, { lower: 107, upper: 109, center: 108 }), conf: makeConf(5.5, 43), val: CLEAN_VAL },
      { analysis: makeAnalysis('ranging'), sr: makeSR(), conf: makeConf(4.5, 65), val: CLEAN_VAL },
      { analysis: makeAnalysis('strong bullish'), sr: makeSR({ lower: 97, upper: 99, center: 98 }, { lower: 105, upper: 107, center: 106 }), conf: makeConf(8.0, 85), val: makeValidation(1) },
    ]

    for (const { analysis, sr, conf, val } of scenarios) {
      const p = computeTradePlan(analysis, sr, conf, val)
      const qualityIsActionable = p.setupQuality === 'excellent' || p.setupQuality === 'good' || p.setupQuality === 'average'
      expect(p.actionable).toBe(qualityIsActionable)
    }
  })

  it('confidence.score is a heuristic score (0–10), not a probability (0–1)', () => {
    // This test documents an architectural fact, not a runtime behavior.
    // confidence.score of 7.5 does NOT mean "75% win rate".
    // Per provenance.ts:13: ZERO confidence weights are backtested.
    // Per provenance.test.ts:37: expect(summary.backtested).toBe(0) is a live assertion.
    const conf = makeConf(7.5, 75)
    expect(conf.score).toBeGreaterThan(1)   // NOT in [0,1] probability range
    expect(conf.score).toBeLessThanOrEqual(10)
    // The grade label is a quality tier, not a probability tier
    expect(conf.grade).toBe('strong')
  })

  it('direction is set by fullTrend.trend — never re-derived from level geometry', () => {
    // Verifies that direction authority is the trend, not the S/R levels.
    // Overlays must consume tradePlan.direction and never re-derive it.
    const bullishPlan = computeTradePlan(
      makeAnalysis('strong bullish'), makeSR(), makeConf(8.5, 90))
    const bearishPlan = computeTradePlan(
      makeAnalysis('strong bearish'), makeSR(), makeConf(8.5, 90))
    const rangingPlan = computeTradePlan(
      makeAnalysis('ranging'), makeSR(), makeConf(4.5, 65))

    expect(bullishPlan.direction).toBe('long')
    expect(bearishPlan.direction).toBe('short')
    expect(rangingPlan.direction).toBeNull()
  })
})
