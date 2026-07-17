import { describe, it, expect } from 'vitest'
import { computeMarketContext } from '../compute/market-context'
import { computeInvalidationScenarios } from '../compute/invalidation'
import { computeDecisionExplanation } from '../compute/decision-explanation'
import { computeDecisionQuality } from '../compute/decision-quality'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { TradePlan } from '../types'
import type { Timeframe } from '../../binance/types'

// ─── Shared stubs ─────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<{
  trend: string
  bullishMet: number
  bearishMet: number
  breakoutConfirmed: boolean
  chochDetected: boolean
  consolidationDetected: boolean
  pullbackDetected: boolean
  accDistState: string
  climaxSignal: string
  adxStrength: string
  bandwidthState: string
  atrPercent: number | null
  rsi: number | null
  rsiClass: string
  macdBias: string
  macdHistogram: number | null
  emaAlignment: string
  insideResistance: boolean
  insideSupport: boolean
  nearestResistanceDist: number | null
  nearestSupportDist: number | null
  relativeVolume: number
  volumeConfirms: boolean
  volumeStrength: number
}> = {}): MarketAnalysisResult {
  const o = overrides
  const trend = (o.trend ?? 'strong bullish') as MarketAnalysisResult['fullTrend']['trend']
  return {
    symbol: 'BTCUSDT', timeframe: '1h' as Timeframe, analysedAt: 0,
    price: { current: 50000, change24hPercent: 2, high24h: 51000, low24h: 49000, atrPercent: o.atrPercent ?? 2 },
    fullTrend: {
      trend,
      bullishConditionsMet: o.bullishMet ?? 4,
      bearishConditionsMet: o.bearishMet ?? 0,
      neutralConditionsMet: 0,
      conditions: {} as never,
    },
    emaContext: {
      priceVsEMA20: 'above', priceVsEMA50: 'above', priceVsEMA100: 'above', priceVsEMA200: 'above',
      emaAlignment: (o.emaAlignment ?? 'bullish_stack') as 'bullish_stack' | 'bearish_stack' | 'mixed' | 'unavailable',
      confluenceZones: [],
    },
    indicatorSummary: {
      rsi: {
        value: o.rsi ?? 62,
        classification: (o.rsiClass ?? 'healthy_bullish') as 'healthy_bullish' | 'overbought' | 'oversold' | 'neutral' | 'weak_bearish',
      },
      macd: {
        histogram: o.macdHistogram ?? 0.5,
        bias: (o.macdBias ?? 'bullish') as 'bullish' | 'bearish' | 'neutral',
      },
      adx: {
        adx: 30,
        trendStrength: (o.adxStrength ?? 'strong') as 'unavailable' | 'weak' | 'emerging' | 'strong' | 'very_strong' | 'extreme',
        dominantDirection: 'bullish',
      },
      bollinger: {
        bandwidth: 2,
        bandwidthState: (o.bandwidthState ?? 'normal') as 'expansion' | 'squeeze' | 'normal',
        priceRelativeToBands: 'above_upper',
      },
      stochRsi: { k: 60, d: 55, zone: 'neutral' },
    },
    srContext: {
      nearestSupportDistance: o.nearestSupportDist ?? -3,
      nearestResistanceDistance: o.nearestResistanceDist ?? 5,
      insideSupport: o.insideSupport ?? false,
      insideResistance: o.insideResistance ?? false,
      approachingSupport: false, approachingResistance: false,
      strongestActiveSupport: null, strongestActiveResistance: null,
    },
    volumeContext: {
      relativeVolume: o.relativeVolume ?? 1.2,
      volumeClassification: 'normal',
      confirmsCurrentMove: o.volumeConfirms ?? true,
      climaxSignal: (o.climaxSignal ?? 'none') as 'none' | 'buying_climax' | 'selling_climax',
      accDistState: (o.accDistState ?? 'neutral') as 'accumulation' | 'distribution' | 'neutral',
      priceAboveVWAP: true, vwapDistancePercent: 1.0, respectingVWAP: true,
      obvDirection: 'bullish', obvConfirmingPrice: true,
      overallStrength: o.volumeStrength ?? 6,
    },
    evidence: [],
    indicators: {} as never,
    marketStructure: {
      trend: 'bullish', strength: 'strong', confidence: 7,
      swings: { highs: [], lows: [] },
      structure: { higherHighs: 2, higherLows: 2, lowerHighs: 0, lowerLows: 0 },
      recentStructure: { higherHighs: 2, higherLows: 1, lowerHighs: 0, lowerLows: 0 },
      bos: { detected: false, events: [], last: null },
      choch: { detected: o.chochDetected ?? false, events: [], last: null },
      consolidation: { detected: o.consolidationDetected ?? false, rangePercent: null, candleCount: 0 },
      breakout: { confirmed: o.breakoutConfirmed ?? false, direction: null, strength: 0, candleIndex: null },
      pullback: { detected: o.pullbackDetected ?? false, depth: null, candleCount: 0 },
    } as never,
    supportResistance: {} as never,
    volumeAnalysis: {} as never,
  }
}

function makeValidation(criticals = 0, warnings = 0): ValidationResult {
  const issues = [
    ...Array.from({ length: criticals }, (_, i) => ({
      severity: 'critical' as const,
      category: 'structural' as const,
      field: `field${i}`,
      message: `critical issue ${i + 1}`,
    })),
    ...Array.from({ length: warnings }, (_, i) => ({
      severity: 'warning' as const,
      category: 'completeness' as const,
      field: `field${i}`,
      message: `warning ${i + 1}`,
    })),
  ]
  return {
    passed: criticals === 0,
    clean: criticals === 0 && warnings === 0,
    criticalCount: criticals,
    warningCount: warnings,
    infoCount: 0,
    issues,
    summary: `${criticals} critical, ${warnings} warnings`,
  } as unknown as ValidationResult
}

function makeConfidence(score = 7, confluenceScore = 6): ConfidenceResult {
  return {
    score,
    grade: 'strong',
    trust: { score: 100, level: 'high', factors: [], reductions: [] },
    penalties: [],
    warnings: [],
    breakdown: {} as never,
    analysisQuality: {
      confluence: {
        score: confluenceScore,
        agreeing: ['Trend', 'Volume'],
        disagreeing: [],
      },
      contradictions: [],
      evidenceQuality: { rating: 'good', breakdown: {} as never },
      indicatorReliability: {} as never,
    },
  } as unknown as ConfidenceResult
}

function makeTradePlan(invalidationLevel: number | null = 48000): TradePlan {
  return {
    entryZone: { lower: 49500, upper: 50000 },
    invalidationLevel,
    targetLevel: 52000,
    riskRewardRatio: 4,
    setupQuality: 'good',
    setupQualityReason: 'Good setup: RR 4.00, confidence 7.5',
    actionable: true,
    patienceMessage: 'Wait for pullback to entry zone',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeMarketContext
// ─────────────────────────────────────────────────────────────────────────────

describe('computeMarketContext', () => {
  it('returns required shape with all fields', () => {
    const ctx = computeMarketContext(makeAnalysis())
    expect(typeof ctx.phase).toBe('string')
    expect(Array.isArray(ctx.secondaryPhases)).toBe(true)
    expect(typeof ctx.description).toBe('string')
    expect(ctx.description.length).toBeGreaterThan(0)
    expect(['high', 'normal', 'low']).toContain(ctx.volatility)
    expect(typeof ctx.isTrending).toBe('boolean')
  })

  it('strong bullish trend → trending_bullish phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ trend: 'strong bullish' }))
    expect(ctx.phase).toBe('trending_bullish')
    expect(ctx.isTrending).toBe(true)
  })

  it('strong bearish trend → trending_bearish phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ trend: 'strong bearish', bearishMet: 4, bullishMet: 0, emaAlignment: 'bearish_stack' }))
    expect(ctx.phase).toBe('trending_bearish')
    expect(ctx.isTrending).toBe(true)
  })

  it('ranging trend → ranging phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ trend: 'ranging', bullishMet: 2, bearishMet: 2 }))
    expect(ctx.phase).toBe('ranging')
    expect(ctx.isTrending).toBe(false)
  })

  it('consolidation detected → consolidation phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ trend: 'ranging', consolidationDetected: true }))
    expect(ctx.phase).toBe('consolidation')
  })

  it('breakout confirmed → breakout phase (highest priority)', () => {
    const ctx = computeMarketContext(makeAnalysis({ breakoutConfirmed: true }))
    expect(ctx.phase).toBe('breakout')
  })

  it('CHoCH detected → reversal_attempt phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ chochDetected: true }))
    expect(ctx.phase).toBe('reversal_attempt')
  })

  it('pullback detected in bullish trend → pullback phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ pullbackDetected: true, trend: 'moderate bullish', bullishMet: 3 }))
    expect(ctx.phase).toBe('pullback')
  })

  it('ranging + distribution accDistState → distribution phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ trend: 'ranging', accDistState: 'distribution' }))
    expect(ctx.phase).toBe('distribution')
    expect(ctx.secondaryPhases).toContain('ranging')
  })

  it('ranging + accumulation accDistState → accumulation phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ trend: 'ranging', accDistState: 'accumulation' }))
    expect(ctx.phase).toBe('accumulation')
    expect(ctx.secondaryPhases).toContain('ranging')
  })

  it('high ATR → high volatility', () => {
    const ctx = computeMarketContext(makeAnalysis({ atrPercent: 7 }))
    expect(ctx.volatility).toBe('high')
  })

  it('low ATR → low volatility', () => {
    const ctx = computeMarketContext(makeAnalysis({ atrPercent: 0.5 }))
    expect(ctx.volatility).toBe('low')
  })

  it('bollinger expansion → high volatility', () => {
    const ctx = computeMarketContext(makeAnalysis({ bandwidthState: 'expansion', atrPercent: 2 }))
    expect(ctx.volatility).toBe('high')
  })

  it('bollinger squeeze → low volatility', () => {
    const ctx = computeMarketContext(makeAnalysis({ bandwidthState: 'squeeze', atrPercent: 2 }))
    expect(ctx.volatility).toBe('low')
  })

  it('high-volatility description appends context', () => {
    const ctx = computeMarketContext(makeAnalysis({ atrPercent: 8 }))
    expect(ctx.description).toMatch(/elevated volatility/i)
  })

  it('breakout has trending secondary phase', () => {
    const ctx = computeMarketContext(makeAnalysis({ breakoutConfirmed: true, trend: 'strong bullish', bullishMet: 5 }))
    expect(ctx.phase).toBe('breakout')
    expect(ctx.secondaryPhases).toContain('trending_bullish')
    expect(ctx.isTrending).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeInvalidationScenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('computeInvalidationScenarios', () => {
  it('returns an array', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis(), makeValidation(), makeTradePlan())
    expect(Array.isArray(scenarios)).toBe(true)
  })

  it('returns scenarios sorted critical → major → minor', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis(), makeValidation(1, 1), makeTradePlan())
    const severityOrder = { critical: 0, major: 1, minor: 2 }
    for (let i = 1; i < scenarios.length; i++) {
      expect(severityOrder[scenarios[i].severity]).toBeGreaterThanOrEqual(severityOrder[scenarios[i - 1].severity])
    }
  })

  it('critical validation issues produce critical scenarios', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis(), makeValidation(2), makeTradePlan())
    const criticals = scenarios.filter(s => s.severity === 'critical')
    expect(criticals.length).toBeGreaterThan(0)
    const hasValidationType = criticals.some(s => s.type === 'validation')
    expect(hasValidationType).toBe(true)
  })

  it('trade plan invalidation level produces critical price_level scenario for bullish', () => {
    const scenarios = computeInvalidationScenarios(
      makeAnalysis({ trend: 'strong bullish' }),
      makeValidation(),
      makeTradePlan(48000),
    )
    const priceCritical = scenarios.find(s => s.severity === 'critical' && s.type === 'price_level')
    expect(priceCritical).toBeDefined()
    expect(priceCritical!.description).toMatch(/48000/)
  })

  it('null invalidation level produces no price_level critical scenario', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis(), makeValidation(), makeTradePlan(null))
    const priceCriticals = scenarios.filter(s => s.severity === 'critical' && s.type === 'price_level')
    expect(priceCriticals).toHaveLength(0)
  })

  it('bullish trend always includes structure BOS/CHoCH major scenario', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis({ trend: 'strong bullish' }), makeValidation(), makeTradePlan(null))
    const structural = scenarios.find(s => s.type === 'structure' && s.severity === 'major')
    expect(structural).toBeDefined()
  })

  it('bearish trend always includes structure BOS/CHoCH major scenario', () => {
    const scenarios = computeInvalidationScenarios(
      makeAnalysis({ trend: 'strong bearish', bearishMet: 4, bullishMet: 0, emaAlignment: 'bearish_stack' }),
      makeValidation(),
      makeTradePlan(null),
    )
    const structural = scenarios.find(s => s.type === 'structure' && s.severity === 'major')
    expect(structural).toBeDefined()
  })

  it('every scenario has non-empty description', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis(), makeValidation(1, 2), makeTradePlan())
    for (const s of scenarios) {
      expect(typeof s.description).toBe('string')
      expect(s.description.length).toBeGreaterThan(0)
    }
  })

  it('validation warnings produce minor scenarios', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis(), makeValidation(0, 2), makeTradePlan())
    const warnings = scenarios.filter(s => s.severity === 'minor' && s.type === 'validation')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('ranging market returns major structure scenarios', () => {
    const scenarios = computeInvalidationScenarios(makeAnalysis({ trend: 'ranging', bullishMet: 2, bearishMet: 2 }), makeValidation(), makeTradePlan(null))
    const major = scenarios.filter(s => s.severity === 'major')
    expect(major.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeDecisionExplanation
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDecisionExplanation', () => {
  it('returns required shape', () => {
    const exp = computeDecisionExplanation(makeAnalysis(), makeConfidence(), makeValidation())
    expect(Array.isArray(exp.dimensions)).toBe(true)
    expect(Array.isArray(exp.flipToNeutral)).toBe(true)
    expect(Array.isArray(exp.flipToOpposite)).toBe(true)
  })

  it('returns exactly 6 dimensions', () => {
    const exp = computeDecisionExplanation(makeAnalysis(), makeConfidence(), makeValidation())
    expect(exp.dimensions).toHaveLength(6)
  })

  it('each dimension has name, status, and detail', () => {
    const exp = computeDecisionExplanation(makeAnalysis(), makeConfidence(), makeValidation())
    const validStatuses = ['strongly_supports', 'supports', 'neutral', 'opposes', 'strongly_opposes']
    for (const dim of exp.dimensions) {
      expect(typeof dim.name).toBe('string')
      expect(validStatuses).toContain(dim.status)
      expect(typeof dim.detail).toBe('string')
      expect(dim.detail.length).toBeGreaterThan(0)
    }
  })

  it('Trend dimension is first', () => {
    const exp = computeDecisionExplanation(makeAnalysis(), makeConfidence(), makeValidation())
    expect(exp.dimensions[0].name).toBe('Trend')
  })

  it('strong bullish trend → Trend dimension strongly_supports', () => {
    const exp = computeDecisionExplanation(makeAnalysis({ trend: 'strong bullish', bullishMet: 5 }), makeConfidence(), makeValidation())
    const trendDim = exp.dimensions.find(d => d.name === 'Trend')!
    expect(trendDim.status).toBe('strongly_supports')
  })

  it('critical validation issues → Validation dimension strongly_opposes', () => {
    const exp = computeDecisionExplanation(makeAnalysis(), makeConfidence(), makeValidation(2))
    const valDim = exp.dimensions.find(d => d.name === 'Validation')!
    expect(valDim.status).toBe('strongly_opposes')
  })

  it('clean validation → Validation dimension supports', () => {
    const exp = computeDecisionExplanation(makeAnalysis(), makeConfidence(), makeValidation(0, 0))
    const valDim = exp.dimensions.find(d => d.name === 'Validation')!
    expect(valDim.status).toBe('supports')
  })

  it('no contradictions → Contradictions dimension supports', () => {
    const exp = computeDecisionExplanation(makeAnalysis(), makeConfidence(7, 6), makeValidation())
    const contrDim = exp.dimensions.find(d => d.name === 'Contradictions')!
    expect(contrDim.status).toBe('supports')
  })

  it('bullish analysis produces non-empty flipToNeutral', () => {
    const exp = computeDecisionExplanation(makeAnalysis({ trend: 'strong bullish' }), makeConfidence(), makeValidation())
    expect(exp.flipToNeutral.length).toBeGreaterThan(0)
  })

  it('bullish analysis produces non-empty flipToOpposite', () => {
    const exp = computeDecisionExplanation(makeAnalysis({ trend: 'strong bullish' }), makeConfidence(), makeValidation())
    expect(exp.flipToOpposite.length).toBeGreaterThan(0)
  })

  it('ranging produces non-trivial flipToNeutral and flipToOpposite', () => {
    const exp = computeDecisionExplanation(makeAnalysis({ trend: 'ranging', bullishMet: 2, bearishMet: 2 }), makeConfidence(), makeValidation())
    expect(exp.flipToNeutral.length).toBeGreaterThan(0)
    expect(exp.flipToOpposite.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeDecisionQuality
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDecisionQuality', () => {
  it('returns required shape', () => {
    const q = computeDecisionQuality(makeAnalysis(), makeConfidence(), makeValidation())
    expect(typeof q.score).toBe('number')
    expect(typeof q.clarity).toBe('number')
    expect(typeof q.agreement).toBe('number')
    expect(typeof q.contradictionPenalty).toBe('number')
    expect(typeof q.riskPenalty).toBe('number')
    expect(typeof q.signalCleanliness).toBe('number')
  })

  it('score is in 0–10 range', () => {
    const q = computeDecisionQuality(makeAnalysis(), makeConfidence(), makeValidation())
    expect(q.score).toBeGreaterThanOrEqual(0)
    expect(q.score).toBeLessThanOrEqual(10)
  })

  it('clarity is in 0–10 range', () => {
    const q = computeDecisionQuality(makeAnalysis({ bullishMet: 5, trend: 'strong bullish' }), makeConfidence(), makeValidation())
    expect(q.clarity).toBeGreaterThanOrEqual(0)
    expect(q.clarity).toBeLessThanOrEqual(10)
  })

  it('more bullish conditions → higher clarity', () => {
    const q4 = computeDecisionQuality(makeAnalysis({ bullishMet: 4, trend: 'strong bullish' }), makeConfidence(), makeValidation())
    const q2 = computeDecisionQuality(makeAnalysis({ bullishMet: 2, trend: 'weak bullish' }), makeConfidence(), makeValidation())
    expect(q4.clarity).toBeGreaterThan(q2.clarity)
  })

  it('critical validation issues increase riskPenalty', () => {
    const qClean = computeDecisionQuality(makeAnalysis(), makeConfidence(), makeValidation(0))
    const qCritical = computeDecisionQuality(makeAnalysis(), makeConfidence(), makeValidation(2))
    expect(qCritical.riskPenalty).toBeGreaterThan(qClean.riskPenalty)
  })

  it('critical issues reduce overall score', () => {
    const qClean = computeDecisionQuality(makeAnalysis(), makeConfidence(), makeValidation(0))
    const qCritical = computeDecisionQuality(makeAnalysis(), makeConfidence(), makeValidation(2))
    expect(qCritical.score).toBeLessThan(qClean.score)
  })

  it('overbought RSI in bullish trend reduces signalCleanliness', () => {
    const qNormal = computeDecisionQuality(makeAnalysis({ rsiClass: 'healthy_bullish', rsi: 60 }), makeConfidence(), makeValidation())
    const qOverbought = computeDecisionQuality(makeAnalysis({ rsiClass: 'overbought', rsi: 82 }), makeConfidence(), makeValidation())
    expect(qOverbought.signalCleanliness).toBeLessThan(qNormal.signalCleanliness)
  })

  it('signalCleanliness is in 0–10 range', () => {
    const q = computeDecisionQuality(
      makeAnalysis({ rsiClass: 'overbought', rsi: 85, macdHistogram: null }),
      makeConfidence(),
      makeValidation(),
    )
    expect(q.signalCleanliness).toBeGreaterThanOrEqual(0)
    expect(q.signalCleanliness).toBeLessThanOrEqual(10)
  })

  it('score values are rounded to 1 decimal place', () => {
    const q = computeDecisionQuality(makeAnalysis(), makeConfidence(), makeValidation())
    expect(q.score).toBe(Math.round(q.score * 10) / 10)
    expect(q.clarity).toBe(Math.round(q.clarity * 10) / 10)
  })

  it('ranging market (no conditions) → zero clarity', () => {
    const q = computeDecisionQuality(makeAnalysis({ trend: 'ranging', bullishMet: 0, bearishMet: 0 }), makeConfidence(), makeValidation())
    expect(q.clarity).toBe(0)
  })
})
