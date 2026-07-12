/**
 * Regression tests for Module 37 production-critical bug fixes.
 *
 * BUG-01  RSI invalidation wording fires when RSI is already in the extreme zone.
 * BUG-02  Volume "low" threshold hardcoded to 0.8 instead of configured 0.7.
 * BUG-04  NaN factorWeight propagates through confidence breakdown.
 * BUG-05  scoreToGrade falls through to 'weak' for NaN/Infinity inputs.
 * BUG-06  market-story RSI description uses hardcoded thresholds instead of classification.
 * BUG-07  classifyRSI duplicated in consistency.ts; analysis/compute/indicators must export it.
 * BUG-13  S/R zone firstDetectedIndex ignores swingLookback — look-ahead bias.
 */

import { describe, it, expect } from 'vitest'
import { computeInvalidationScenarios } from '../compute/invalidation'
import { computeDecision } from '../compute/decision'
import { computeDecisionExplanation } from '../compute/decision-explanation'
import { computeMarketStory } from '../compute/market-story'
import { scoreToGrade } from '../../confidence/compute/grade'
import { computeBreakdown } from '../../confidence/compute/breakdown'
import { classifyRSI } from '../../analysis/compute/indicators'
import { createZoneCandidates } from '../../support-resistance/zones'
import { DEFAULT_CONFIDENCE_CONFIG } from '../../confidence/config'
import { DEFAULT_CONFIG as SR_CONFIG } from '../../support-resistance/config'
import { flatCandles, swing } from '../../support-resistance/__tests__/helpers'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { TradePlan, MarketContext } from '../types'
import type { EvidenceItem } from '../../analysis/types'
import type { Timeframe } from '../../binance/types'

// ─── Shared stubs ─────────────────────────────────────────────────────────────

function makeAnalysis(o: {
  trend?: string
  rsi?: number | null
  rsiClass?: string
  relativeVolume?: number
  volumeConfirms?: boolean
  volumeStrength?: number
  nearestResistanceDist?: number | null
  nearestSupportDist?: number | null
} = {}): MarketAnalysisResult {
  const trend = (o.trend ?? 'strong bullish') as MarketAnalysisResult['fullTrend']['trend']
  return {
    symbol: 'BTCUSDT', timeframe: '1h' as Timeframe, analysedAt: 0,
    price: { current: 50000, change24hPercent: 2, high24h: 51000, low24h: 49000, atrPercent: 2 },
    fullTrend: {
      trend,
      bullishConditionsMet: trend.includes('bullish') ? 4 : 0,
      bearishConditionsMet: trend.includes('bearish') ? 4 : 0,
      neutralConditionsMet: 0,
      conditions: {} as never,
    },
    emaContext: {
      priceVsEMA20: 'above', priceVsEMA50: 'above', priceVsEMA100: 'above', priceVsEMA200: 'above',
      emaAlignment: trend.includes('bullish') ? 'bullish_stack' : trend.includes('bearish') ? 'bearish_stack' : 'mixed',
      confluenceZones: [],
    },
    indicatorSummary: {
      rsi: {
        value: o.rsi ?? 62,
        classification: (o.rsiClass ?? 'healthy_bullish') as never,
      },
      macd: { histogram: 0.5, bias: 'bullish' },
      adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
      bollinger: { bandwidth: 2, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
      stochRsi: { k: 60, d: 55, zone: 'neutral' },
    },
    srContext: {
      nearestSupportDistance: o.nearestSupportDist ?? -3,
      nearestResistanceDistance: o.nearestResistanceDist ?? 5,
      insideSupport: false, insideResistance: false,
      approachingSupport: false, approachingResistance: false,
      strongestActiveSupport: null, strongestActiveResistance: null,
    },
    volumeContext: {
      relativeVolume: o.relativeVolume ?? 1.2,
      volumeClassification: 'normal',
      confirmsCurrentMove: o.volumeConfirms ?? true,
      climaxSignal: 'none',
      accDistState: 'neutral',
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
      choch: { detected: false, events: [], last: null },
      consolidation: { detected: false, rangePercent: null, candleCount: 0 },
      breakout: { confirmed: false, direction: null, strength: 0, candleIndex: null },
      pullback: { detected: false, depth: null, candleCount: 0 },
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
      field: `f${i}`,
      message: `critical ${i + 1}`,
    })),
    ...Array.from({ length: warnings }, (_, i) => ({
      severity: 'warning' as const,
      category: 'completeness' as const,
      field: `f${i}`,
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
    summary: '',
  } as unknown as ValidationResult
}

function makeTradePlan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    actionable: true,
    entryZone: null,
    invalidationLevel: null,
    targetLevel: null,
    riskRewardRatio: null,
    positionSizePercent: null,
    setupQualityReason: null,
    ...overrides,
  } as TradePlan
}

function makeConfidence(score = 7): ConfidenceResult {
  return {
    score,
    grade: 'strong',
    bullishConfidence: score,
    bearishConfidence: 0,
    neutralContribution: 0,
    reasons: [],
    penalties: [],
    warnings: [],
    breakdown: { trendQuality: 7, momentum: 6, volume: 5, marketStructure: 7, srPositioning: 4, contradictions: 0 },
    analysisQuality: {
      contradictions: [],
      confluence: { agreementRatio: 0.8, categories: {} as never },
      evidenceBreadth: 5,
    },
    trust: { level: 'high', score: 8, factors: [] },
  } as unknown as ConfidenceResult
}

function makeMarketContext(): MarketContext {
  return {
    phase: 'trending_bullish',
    secondaryPhases: [],
    description: 'Trending bullish',
    volatility: 'normal',
    isTrending: true,
  }
}

const cfg = DEFAULT_CONFIDENCE_CONFIG

// ─── BUG-01: RSI invalidation wording ────────────────────────────────────────

describe('BUG-01 — RSI invalidation scenarios not emitted when RSI already at extreme', () => {
  it('omits "dropping into oversold" when RSI is already oversold in a bullish trend', () => {
    const scenarios = computeInvalidationScenarios(
      makeAnalysis({ trend: 'strong bullish', rsi: 25, rsiClass: 'oversold' }),
      makeValidation(),
      makeTradePlan(),
    )
    const text = scenarios.map(s => s.description).join(' ')
    expect(text).not.toContain('dropping into oversold')
  })

  it('omits "recovering into bullish zone" when RSI is already overbought in a bearish trend', () => {
    const scenarios = computeInvalidationScenarios(
      makeAnalysis({ trend: 'strong bearish', rsi: 78, rsiClass: 'overbought' }),
      makeValidation(),
      makeTradePlan(),
    )
    const text = scenarios.map(s => s.description).join(' ')
    expect(text).not.toContain('recovering into bullish zone')
  })

  it('still emits "dropping into oversold" when RSI is in a non-extreme zone in a bullish trend', () => {
    const scenarios = computeInvalidationScenarios(
      makeAnalysis({ trend: 'strong bullish', rsi: 50, rsiClass: 'neutral' }),
      makeValidation(),
      makeTradePlan(),
    )
    const text = scenarios.map(s => s.description).join(' ')
    expect(text).toContain('dropping into oversold')
  })

  it('still emits "recovering into bullish zone" when RSI is in a non-extreme zone in a bearish trend', () => {
    const scenarios = computeInvalidationScenarios(
      makeAnalysis({ trend: 'strong bearish', rsi: 50, rsiClass: 'neutral' }),
      makeValidation(),
      makeTradePlan(),
    )
    const text = scenarios.map(s => s.description).join(' ')
    expect(text).toContain('recovering into bullish zone')
  })
})

// ─── BUG-02: hardcoded 0.8 volume threshold ──────────────────────────────────

describe('BUG-02 — volume threshold uses 0.7 not 0.8', () => {
  it('computeDecision: rv=0.75 (above 0.7) does not add a low-volume reason', () => {
    const decision = computeDecision(
      makeAnalysis({ trend: 'strong bullish', relativeVolume: 0.75, volumeConfirms: false }),
      makeConfidence(),
      makeValidation(),
    )
    expect(decision.reasons.join(' ')).not.toContain('Low volume')
  })

  it('computeDecision: rv=0.65 (below 0.7) adds a low-volume reason', () => {
    const decision = computeDecision(
      makeAnalysis({ trend: 'strong bullish', relativeVolume: 0.65, volumeConfirms: false }),
      makeConfidence(),
      makeValidation(),
    )
    expect(decision.reasons.join(' ')).toContain('Low volume')
  })

  it('computeDecisionExplanation: rv=0.75 volume dimension is not opposes', () => {
    const expl = computeDecisionExplanation(
      makeAnalysis({ trend: 'strong bullish', relativeVolume: 0.75, volumeConfirms: false }),
      makeConfidence(),
      makeValidation(),
    )
    const volDim = expl.dimensions.find(d => d.name === 'Volume')
    expect(volDim?.status).not.toBe('opposes')
  })

  it('computeDecisionExplanation: rv=0.65 volume dimension is opposes', () => {
    const expl = computeDecisionExplanation(
      makeAnalysis({ trend: 'strong bullish', relativeVolume: 0.65, volumeConfirms: false }),
      makeConfidence(),
      makeValidation(),
    )
    const volDim = expl.dimensions.find(d => d.name === 'Volume')
    expect(volDim?.status).toBe('opposes')
  })

  it('computeDecisionExplanation: flipToNeutral includes volume hint when rv=0.75 (above 0.7)', () => {
    const expl = computeDecisionExplanation(
      makeAnalysis({ trend: 'strong bullish', relativeVolume: 0.75, volumeConfirms: true }),
      makeConfidence(),
      makeValidation(),
    )
    const hasVolumeLine = expl.flipToNeutral.some(s => s.includes('0.7'))
    expect(hasVolumeLine).toBe(true)
  })

  it('computeDecisionExplanation: flipToNeutral does not include volume hint when rv=0.65 (below 0.7)', () => {
    const expl = computeDecisionExplanation(
      makeAnalysis({ trend: 'strong bullish', relativeVolume: 0.65, volumeConfirms: false }),
      makeConfidence(),
      makeValidation(),
    )
    const hasVolumeLine = expl.flipToNeutral.some(s => s.includes('dries up below 0.7'))
    expect(hasVolumeLine).toBe(false)
  })
})

// ─── BUG-04: NaN weight propagation ──────────────────────────────────────────

describe('BUG-04 — NaN factorWeight does not corrupt confidence breakdown', () => {
  it('returns finite breakdown scores when a known factor has NaN weight', () => {
    const cfgWithNaN = {
      ...cfg,
      factorWeights: { ...cfg.factorWeights, 'Price above EMA200': NaN },
    }
    const evidence: EvidenceItem[] = [
      { factor: 'Price above EMA200', impact: 'high', description: 'test', source: 'indicators', direction: 'bullish' },
    ]
    const result = computeBreakdown(evidence, cfgWithNaN, 0)
    expect(Number.isFinite(result.trendQuality)).toBe(true)
    expect(Number.isFinite(result.momentum)).toBe(true)
    expect(Number.isFinite(result.volume)).toBe(true)
    expect(Number.isFinite(result.marketStructure)).toBe(true)
    expect(Number.isFinite(result.srPositioning)).toBe(true)
  })

  it('NaN weight factor contributes 0 to the category score', () => {
    const cfgWithNaN = {
      ...cfg,
      factorWeights: { ...cfg.factorWeights, 'Price above EMA200': NaN },
    }
    const evidenceNaN: EvidenceItem[] = [
      { factor: 'Price above EMA200', impact: 'high', description: 'test', source: 'indicators', direction: 'bullish' },
    ]
    const evidenceNormal: EvidenceItem[] = []
    const resultNaN = computeBreakdown(evidenceNaN, cfgWithNaN, 0)
    const resultNormal = computeBreakdown(evidenceNormal, cfgWithNaN, 0)
    expect(resultNaN.trendQuality).toBe(resultNormal.trendQuality)
  })
})

// ─── BUG-05: scoreToGrade NaN guard ──────────────────────────────────────────

describe('BUG-05 — scoreToGrade returns weak for non-finite scores', () => {
  it('returns weak for NaN', () => {
    expect(scoreToGrade(NaN, cfg)).toBe('weak')
  })

  it('returns weak for +Infinity', () => {
    expect(scoreToGrade(Infinity, cfg)).toBe('weak')
  })

  it('returns weak for -Infinity', () => {
    expect(scoreToGrade(-Infinity, cfg)).toBe('weak')
  })

  it('normal scores are unchanged: 9 → very_strong', () => {
    expect(scoreToGrade(9, cfg)).toBe('very_strong')
  })

  it('normal scores are unchanged: 0 → weak', () => {
    expect(scoreToGrade(0, cfg)).toBe('weak')
  })
})

// ─── BUG-06: market-story RSI uses engine classification ─────────────────────

describe('BUG-06 — market-story RSI description uses engine classification not hardcoded thresholds', () => {
  it('RSI=55 classified as neutral produces neutral description (not bullish zone)', () => {
    const analysis = makeAnalysis({ rsi: 55, rsiClass: 'neutral' })
    const story = computeMarketStory(analysis, makeConfidence(), makeMarketContext())
    expect(story.text).toContain('neutral')
    expect(story.text).not.toContain('RSI in bullish zone at 55')
  })

  it('RSI=56 classified as healthy_bullish produces bullish zone description', () => {
    const analysis = makeAnalysis({ rsi: 56, rsiClass: 'healthy_bullish' })
    const story = computeMarketStory(analysis, makeConfidence(), makeMarketContext())
    expect(story.text).toContain('RSI in bullish zone at 56')
  })

  it('RSI=45 classified as weak_bearish produces bearish zone description', () => {
    const analysis = makeAnalysis({ rsi: 45, rsiClass: 'weak_bearish' })
    const story = computeMarketStory(analysis, makeConfidence(), makeMarketContext())
    expect(story.text).toContain('RSI in bearish zone at 45')
  })

  it('RSI=25 classified as oversold produces oversold description', () => {
    const analysis = makeAnalysis({ rsi: 25, rsiClass: 'oversold' })
    const story = computeMarketStory(analysis, makeConfidence(), makeMarketContext())
    expect(story.text).toContain('RSI is oversold at 25')
  })
})

// ─── BUG-07: classifyRSI exported from analysis/compute/indicators ────────────

describe('BUG-07 — classifyRSI exported and matches validation thresholds', () => {
  it('classifyRSI is exported from analysis/compute/indicators', () => {
    expect(typeof classifyRSI).toBe('function')
  })

  it('classifyRSI: null → unavailable', () => {
    expect(classifyRSI(null)).toBe('unavailable')
  })

  it('classifyRSI: 25 → oversold', () => {
    expect(classifyRSI(25)).toBe('oversold')
  })

  it('classifyRSI: 37 → weak_bearish', () => {
    expect(classifyRSI(37)).toBe('weak_bearish')
  })

  it('classifyRSI: 50 → neutral', () => {
    expect(classifyRSI(50)).toBe('neutral')
  })

  it('classifyRSI: 55 → neutral (boundary: <= 55 maps to neutral)', () => {
    expect(classifyRSI(55)).toBe('neutral')
  })

  it('classifyRSI: 56 → healthy_bullish', () => {
    expect(classifyRSI(56)).toBe('healthy_bullish')
  })

  it('classifyRSI: 75 → overbought', () => {
    expect(classifyRSI(75)).toBe('overbought')
  })
})

// ─── BUG-13: S/R look-ahead bias via swingLookback ───────────────────────────

describe('BUG-13 — firstDetectedIndex respects swingLookback to eliminate look-ahead bias', () => {
  it('firstDetectedIndex equals swing.index when swingLookback is 0 (default)', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, SR_CONFIG, null)
    expect(zones[0].firstDetectedIndex).toBe(10)
  })

  it('firstDetectedIndex equals swing.index + swingLookback when swingLookback=2', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const cfgWithLookback = { ...SR_CONFIG, swingLookback: 2 }
    const zones = createZoneCandidates(swings, candles, cfgWithLookback, null)
    expect(zones[0].firstDetectedIndex).toBe(12)
  })

  it('firstDetectedIndex equals swing.index + swingLookback when swingLookback=1', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 15, price: 90, type: 'low' })]
    const cfgWithLookback = { ...SR_CONFIG, swingLookback: 1 }
    const zones = createZoneCandidates(swings, candles, cfgWithLookback, null)
    expect(zones[0].firstDetectedIndex).toBe(16)
  })

  it('all zones in a batch are offset by the same swingLookback', () => {
    const candles = flatCandles(60, 100)
    const swings = [
      swing({ index: 10, price: 120, type: 'high' }),
      swing({ index: 20, price: 80, type: 'low' }),
    ]
    const cfgWithLookback = { ...SR_CONFIG, swingLookback: 2 }
    const zones = createZoneCandidates(swings, candles, cfgWithLookback, null)
    expect(zones[0].firstDetectedIndex).toBe(12)
    expect(zones[1].firstDetectedIndex).toBe(22)
  })

  it('config without swingLookback (undefined) falls back to 0 — backwards compatible', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const cfgNoLookback = { ...SR_CONFIG }
    delete (cfgNoLookback as Record<string, unknown>).swingLookback
    const zones = createZoneCandidates(swings, candles, cfgNoLookback, null)
    expect(zones[0].firstDetectedIndex).toBe(10)
  })
})
