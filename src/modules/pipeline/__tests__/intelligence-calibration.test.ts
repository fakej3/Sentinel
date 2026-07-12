/**
 * Module 31 — Intelligence Calibration & Reality Validation
 * Tests for all 6 new compute modules.
 */
import { describe, it, expect } from 'vitest'
import { computeConfidenceExplanation } from '../compute/confidence-explanation'
import { computeMarketStory } from '../compute/market-story'
import { computeContradictionIntelligence } from '../compute/contradiction-intelligence'
import { computeTraderReview } from '../compute/trader-review'
import { computeOpportunityAssessment } from '../compute/opportunity-assessment'
import { computeSanityAudit } from '../compute/sanity-audit'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { TradeDecision, TradePlan, MarketContext } from '../types'
import type { Timeframe } from '../../binance/types'

// ─── Shared test stubs ────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<{
  trend: string
  rsi: number
  macdBias: string
  adxStrength: string
  adxValue: number
  emaAlignment: string
  relativeVolume: number
  volumeConfirms: boolean
  climaxSignal: string
  accDistState: string
  priceAboveVWAP: boolean
  insideSupport: boolean
  insideResistance: boolean
  approachingSupport: boolean
  approachingResistance: boolean
  nearestSupportDist: number | null
  nearestResistanceDist: number | null
  bullishMet: number
  bearishMet: number
  atrPercent: number
  bandwidthState: string
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
      rsi: { value: o.rsi ?? 62, classification: 'neutral' as never },
      macd: { histogram: 0.5, bias: (o.macdBias ?? 'bullish') as 'bullish' | 'bearish' | 'neutral' },
      adx: {
        adx: o.adxValue ?? 30,
        trendStrength: (o.adxStrength ?? 'strong') as 'unavailable' | 'weak' | 'emerging' | 'strong' | 'very_strong' | 'extreme',
        dominantDirection: 'bullish' as never,
      },
      bollinger: {
        bandwidth: 2,
        bandwidthState: (o.bandwidthState ?? 'normal') as 'expansion' | 'squeeze' | 'normal',
        priceRelativeToBands: 'inside' as never,
      },
      stochRsi: { k: 60, d: 55, zone: 'neutral' as never },
    },
    srContext: {
      nearestSupportDistance: o.nearestSupportDist ?? -3,
      nearestResistanceDistance: o.nearestResistanceDist ?? 5,
      insideSupport: o.insideSupport ?? false,
      insideResistance: o.insideResistance ?? false,
      approachingSupport: o.approachingSupport ?? false,
      approachingResistance: o.approachingResistance ?? false,
      strongestActiveSupport: null,
      strongestActiveResistance: null,
    },
    volumeContext: {
      relativeVolume: o.relativeVolume ?? 1.2,
      volumeClassification: 'normal' as never,
      confirmsCurrentMove: o.volumeConfirms ?? true,
      climaxSignal: (o.climaxSignal ?? 'none') as 'none' | 'buying_climax' | 'selling_climax',
      accDistState: (o.accDistState ?? 'neutral') as 'accumulation' | 'distribution' | 'neutral',
      priceAboveVWAP: o.priceAboveVWAP ?? true,
      vwapDistancePercent: 1.0,
      respectingVWAP: true,
      obvDirection: 'bullish' as never,
      obvConfirmingPrice: true,
      overallStrength: 6,
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

function makeConfidence(overrides: Partial<{
  score: number
  grade: ConfidenceResult['grade']
  trustLevel: 'high' | 'medium' | 'low'
  contradictions: ConfidenceResult['analysisQuality']['contradictions']
  confluenceRatio: number
  penalties: ConfidenceResult['penalties']
  reasons: ConfidenceResult['reasons']
}> = {}): ConfidenceResult {
  return {
    score: overrides.score ?? 7.0,
    grade: overrides.grade ?? 'strong',
    bullishConfidence: 7.0,
    bearishConfidence: 2.0,
    neutralContribution: 5,
    reasons: overrides.reasons ?? [
      { factor: 'Price above EMA200', points: 12, direction: 'bullish' },
      { factor: 'EMA bullish alignment', points: 10, direction: 'bullish' },
      { factor: 'RSI supports bullish', points: 8, direction: 'bullish' },
    ],
    penalties: overrides.penalties ?? [],
    warnings: [],
    breakdown: {
      trendQuality: 7, momentum: 6, volume: 5, marketStructure: 7, srPositioning: 5, contradictions: 1,
    },
    analysisQuality: {
      score: 7,
      confluence: {
        score: 6,
        agreeing: ['Trend', 'Volume'],
        disagreeing: [],
        agreementRatio: overrides.confluenceRatio ?? 0.8,
      },
      contradictions: overrides.contradictions ?? [],
      evidenceQuality: {} as never,
      reliability: { trendReliability: 7, oscillatorReliability: 6, volumeReliability: 6, note: 'Normal conditions.' },
    },
    trust: {
      score: 100,
      level: overrides.trustLevel ?? 'high',
      factors: [],
      reductions: [],
    },
  } as unknown as ConfidenceResult
}

function makeDecision(overrides: Partial<{
  label: TradeDecision['label']
  riskLevel: TradeDecision['riskLevel']
}> = {}): TradeDecision {
  return {
    label: overrides.label ?? 'Buy',
    reasons: ['Bullish trend confirmed'],
    riskLevel: overrides.riskLevel ?? 'Medium',
    confidence: 7.0,
    explanation: { dimensions: [], flipToNeutral: [], flipToOpposite: [] },
    quality: { score: 7, clarity: 7, agreement: 7, contradictionPenalty: 1, riskPenalty: 0, signalCleanliness: 8 },
  }
}

function makeTradePlan(overrides: Partial<{
  actionable: boolean
  setupQuality: TradePlan['setupQuality']
  riskRewardRatio: number | null
}> = {}): TradePlan {
  return {
    entryZone: { lower: 49500, upper: 50000 },
    invalidationLevel: 48000,
    targetLevel: 52000,
    riskRewardRatio: overrides.riskRewardRatio ?? 4.0,
    setupQuality: overrides.setupQuality ?? 'good',
    setupQualityReason: 'Good setup',
    actionable: overrides.actionable ?? true,
    patienceMessage: 'Wait for pullback.',
    maturityScore: 62,
    maturityLabel: 'mature',
    maturityComponents: { momentum: 20, volume: 15, trend: 14, structure: 8, confidence: 5 },
    maturityPrimaryConcern: null,
  }
}

function makeMarketContext(overrides: Partial<{
  phase: MarketContext['phase']
  isTrending: boolean
  volatility: MarketContext['volatility']
}> = {}): MarketContext {
  return {
    phase: overrides.phase ?? 'trending_bullish',
    secondaryPhases: [],
    description: 'Market is trending bullish.',
    volatility: overrides.volatility ?? 'normal',
    isTrending: overrides.isTrending ?? true,
  }
}

// ─── computeConfidenceExplanation ────────────────────────────────────────────

describe('computeConfidenceExplanation', () => {
  it('returns required shape', () => {
    const result = computeConfidenceExplanation(makeConfidence(), makeAnalysis())
    expect(result).toHaveProperty('positiveContributors')
    expect(result).toHaveProperty('negativeContributors')
    expect(result).toHaveProperty('rationale')
    expect(typeof result.rationale).toBe('string')
    expect(Array.isArray(result.positiveContributors)).toBe(true)
    expect(Array.isArray(result.negativeContributors)).toBe(true)
  })

  it('positive contributors reference bullish reasons in a bullish trend', () => {
    const confidence = makeConfidence({
      reasons: [
        { factor: 'Price above EMA200', points: 12, direction: 'bullish' },
        { factor: 'MACD bullish bias', points: 8, direction: 'bullish' },
        { factor: 'Price below EMA20', points: -5, direction: 'bearish' },
      ],
    })
    const result = computeConfidenceExplanation(confidence, makeAnalysis({ trend: 'strong bullish' }))
    const posLabels = result.positiveContributors.map(c => c.label)
    expect(posLabels).toContain('Price above EMA200')
    expect(posLabels).toContain('MACD bullish bias')
  })

  it('limits positive contributors to at most 5', () => {
    const confidence = makeConfidence({
      reasons: Array.from({ length: 10 }, (_, i) => ({
        factor: `Bull factor ${i}`,
        points: 10 - i,
        direction: 'bullish' as const,
      })),
    })
    const result = computeConfidenceExplanation(confidence, makeAnalysis({ trend: 'strong bullish' }))
    expect(result.positiveContributors.length).toBeLessThanOrEqual(5)
  })

  it('includes penalties in negative contributors', () => {
    const confidence = makeConfidence({
      penalties: [{ source: 'validation_warning', description: 'Weak candle count', scoreReduction: 0.5 }],
    })
    const result = computeConfidenceExplanation(confidence, makeAnalysis())
    const negLabels = result.negativeContributors.map(c => c.label)
    expect(negLabels.some(l => l.includes('Weak candle count') || l.includes('penalty'))).toBe(true)
  })

  it('rationale includes the score', () => {
    const result = computeConfidenceExplanation(makeConfidence({ score: 7.5 }), makeAnalysis())
    expect(result.rationale).toContain('7.5')
  })

  it('rationale mentions low trust when trust is low', () => {
    const result = computeConfidenceExplanation(makeConfidence({ trustLevel: 'low' }), makeAnalysis())
    expect(result.rationale).toMatch(/trust.*low|low.*trust/i)
  })

  it('rationale mentions contradictions when present', () => {
    const confidence = makeConfidence({
      contradictions: [{ category: 'Trend', severity: 'strong', description: 'Conflicting EMA signals.', factors: [] }],
    })
    const result = computeConfidenceExplanation(confidence, makeAnalysis())
    expect(result.rationale).toMatch(/contradiction/i)
  })

  it('works for bearish trend — bearish reasons become positive contributors', () => {
    const confidence = makeConfidence({
      reasons: [
        { factor: 'Price below EMA200', points: -12, direction: 'bearish' },
        { factor: 'MACD bearish bias', points: -8, direction: 'bearish' },
      ],
    })
    const result = computeConfidenceExplanation(confidence, makeAnalysis({ trend: 'strong bearish' }))
    const posLabels = result.positiveContributors.map(c => c.label)
    expect(posLabels).toContain('Price below EMA200')
  })
})

// ─── computeMarketStory ──────────────────────────────────────────────────────

describe('computeMarketStory', () => {
  it('returns a non-empty text string', () => {
    const result = computeMarketStory(makeAnalysis(), makeConfidence(), makeMarketContext())
    expect(typeof result.text).toBe('string')
    expect(result.text.length).toBeGreaterThan(10)
  })

  it('sentences array is non-empty and joins to text', () => {
    const result = computeMarketStory(makeAnalysis(), makeConfidence(), makeMarketContext())
    expect(result.sentences.length).toBeGreaterThanOrEqual(1)
    expect(result.text).toBe(result.sentences.join(' '))
  })

  it('strong bullish trend produces bullish narrative', () => {
    const result = computeMarketStory(
      makeAnalysis({ trend: 'strong bullish', emaAlignment: 'bullish_stack' }),
      makeConfidence({ score: 8.0 }),
      makeMarketContext(),
    )
    expect(result.text).toMatch(/bullish|upward/i)
  })

  it('strong bearish trend produces bearish narrative', () => {
    const result = computeMarketStory(
      makeAnalysis({ trend: 'strong bearish', emaAlignment: 'bearish_stack' }),
      makeConfidence({ score: 7.5 }),
      makeMarketContext({ phase: 'trending_bearish' }),
    )
    expect(result.text).toMatch(/bearish|downward|selling/i)
  })

  it('ranging market mentions ranging or neutral', () => {
    const result = computeMarketStory(
      makeAnalysis({ trend: 'ranging', emaAlignment: 'mixed' }),
      makeConfidence({ score: 3.5 }),
      makeMarketContext({ phase: 'ranging', isTrending: false }),
    )
    expect(result.text).toMatch(/consolidat|ranging|sideways|neutral/i)
  })

  it('buying climax produces a climax note', () => {
    const result = computeMarketStory(
      makeAnalysis({ climaxSignal: 'buying_climax' }),
      makeConfidence(),
      makeMarketContext(),
    )
    expect(result.text).toMatch(/climax|exhaust|top/i)
  })

  it('approachingResistance with distance produces distance in text', () => {
    const result = computeMarketStory(
      makeAnalysis({ approachingResistance: true, nearestResistanceDist: 1.5 }),
      makeConfidence(),
      makeMarketContext(),
    )
    expect(result.text).toMatch(/resistance/i)
  })

  it('strong contradictions produce a caution note', () => {
    const confidence = makeConfidence({
      contradictions: [{ category: 'Trend', severity: 'strong', description: 'Conflicting signals', factors: [] }],
    })
    const result = computeMarketStory(makeAnalysis(), confidence, makeMarketContext())
    expect(result.text).toMatch(/contradiction|caution|opposing/i)
  })

  it('breakout phase mentions breakout', () => {
    const result = computeMarketStory(
      makeAnalysis(),
      makeConfidence(),
      makeMarketContext({ phase: 'breakout' }),
    )
    expect(result.text).toMatch(/breakout/i)
  })
})

// ─── computeContradictionIntelligence ────────────────────────────────────────

describe('computeContradictionIntelligence', () => {
  it('returns required shape', () => {
    const result = computeContradictionIntelligence(makeConfidence(), makeValidation())
    expect(result).toHaveProperty('categories')
    expect(result).toHaveProperty('overallSeverity')
    expect(result).toHaveProperty('summary')
    expect(result.categories.length).toBe(6) // always exactly 6 categories
  })

  it('always produces exactly 6 categories in canonical order', () => {
    const result = computeContradictionIntelligence(makeConfidence(), makeValidation())
    const expected = ['Trend', 'Momentum', 'Volume', 'Structure', 'Support/Resistance', 'Validation']
    expect(result.categories.map(c => c.category)).toEqual(expected)
  })

  it('overallSeverity is none when no contradictions exist', () => {
    const result = computeContradictionIntelligence(makeConfidence(), makeValidation())
    expect(result.overallSeverity).toBe('none')
  })

  it('maps strong contradiction to major severity', () => {
    const confidence = makeConfidence({
      contradictions: [{ category: 'Trend', severity: 'strong', description: 'Conflicting EMA vs trend', factors: [] }],
    })
    const result = computeContradictionIntelligence(confidence, makeValidation())
    const trendCat = result.categories.find(c => c.category === 'Trend')
    expect(trendCat?.severity).toBe('major')
    expect(result.overallSeverity).toBe('major')
  })

  it('maps moderate contradiction to moderate severity', () => {
    const confidence = makeConfidence({
      contradictions: [{ category: 'Momentum', severity: 'moderate', description: 'RSI divergence', factors: [] }],
    })
    const result = computeContradictionIntelligence(confidence, makeValidation())
    const momCat = result.categories.find(c => c.category === 'Momentum')
    expect(momCat?.severity).toBe('moderate')
  })

  it('maps mild contradiction to minor severity', () => {
    const confidence = makeConfidence({
      contradictions: [{ category: 'Volume', severity: 'mild', description: 'Slight volume divergence', factors: [] }],
    })
    const result = computeContradictionIntelligence(confidence, makeValidation())
    const volCat = result.categories.find(c => c.category === 'Volume')
    expect(volCat?.severity).toBe('minor')
  })

  it('adds Validation category as major when criticals exist', () => {
    const result = computeContradictionIntelligence(makeConfidence(), makeValidation(2, 0))
    const valCat = result.categories.find(c => c.category === 'Validation')
    expect(valCat?.severity).toBe('major')
  })

  it('adds Validation category as minor when only warnings exist', () => {
    const result = computeContradictionIntelligence(makeConfidence(), makeValidation(0, 3))
    const valCat = result.categories.find(c => c.category === 'Validation')
    expect(valCat?.severity).toBe('minor')
  })

  it('categories without contradictions have severity none', () => {
    const confidence = makeConfidence({
      contradictions: [{ category: 'Trend', severity: 'strong', description: 'EMA conflict', factors: [] }],
    })
    const result = computeContradictionIntelligence(confidence, makeValidation())
    const volCat = result.categories.find(c => c.category === 'Volume')
    expect(volCat?.severity).toBe('none')
  })

  it('summary is a non-empty string', () => {
    const result = computeContradictionIntelligence(makeConfidence(), makeValidation())
    expect(typeof result.summary).toBe('string')
    expect(result.summary.length).toBeGreaterThan(5)
  })
})

// ─── computeTraderReview ─────────────────────────────────────────────────────

describe('computeTraderReview', () => {
  it('returns required shape', () => {
    const result = computeTraderReview(makeAnalysis(), makeConfidence(), makeDecision(), makeTradePlan(), makeMarketContext())
    expect(result).toHaveProperty('verdict')
    expect(result).toHaveProperty('reasoning')
    expect(Array.isArray(result.reasoning)).toBe(true)
    expect(result.reasoning.length).toBeGreaterThanOrEqual(1)
  })

  it('strong bullish + high score + good RR + volume confirms → Aggressive Buy', () => {
    const result = computeTraderReview(
      makeAnalysis({ trend: 'strong bullish', rsi: 60, volumeConfirms: true }),
      makeConfidence({ score: 8.0 }),
      makeDecision({ label: 'Strong Buy' }),
      makeTradePlan({ actionable: true, riskRewardRatio: 2.5 }),
      makeMarketContext({ isTrending: true }),
    )
    expect(result.verdict).toBe('Aggressive Buy')
  })

  it('moderate bullish + overbought RSI → Wait (not chasing an overbought entry)', () => {
    const result = computeTraderReview(
      makeAnalysis({ trend: 'moderate bullish', rsi: 72 }),
      makeConfidence({ score: 6.5 }),
      makeDecision({ label: 'Buy' }),
      makeTradePlan({ actionable: true }),
      makeMarketContext({ isTrending: true }),
    )
    expect(result.verdict).toBe('Wait')
  })

  it('not actionable → Avoid', () => {
    const result = computeTraderReview(
      makeAnalysis(),
      makeConfidence(),
      makeDecision({ label: 'Watch' }),
      makeTradePlan({ actionable: false, setupQuality: 'no_setup' }),
      makeMarketContext(),
    )
    expect(result.verdict).toBe('Avoid')
  })

  it('major contradiction present → Wait', () => {
    const confidence = makeConfidence({
      score: 7.0,
      contradictions: [{ category: 'Trend', severity: 'strong', description: 'Major conflict', factors: [] }],
    })
    const result = computeTraderReview(
      makeAnalysis({ trend: 'strong bullish' }),
      confidence,
      makeDecision({ label: 'Strong Buy' }),
      makeTradePlan({ actionable: true }),
      makeMarketContext({ isTrending: true }),
    )
    expect(result.verdict).toBe('Wait')
  })

  it('ranging market + low confidence → Wait', () => {
    const result = computeTraderReview(
      makeAnalysis({ trend: 'ranging' }),
      makeConfidence({ score: 3.0 }),
      makeDecision({ label: 'Neutral' }),
      makeTradePlan({ actionable: true }),
      makeMarketContext({ isTrending: false, phase: 'ranging' }),
    )
    expect(result.verdict).toBe('Wait')
  })

  it('strong bearish + high score + good RR → Aggressive Sell', () => {
    const result = computeTraderReview(
      makeAnalysis({ trend: 'strong bearish', rsi: 40, volumeConfirms: true }),
      makeConfidence({ score: 8.0 }),
      makeDecision({ label: 'Strong Sell' }),
      makeTradePlan({ actionable: true, riskRewardRatio: 2.5 }),
      makeMarketContext({ isTrending: true }),
    )
    expect(result.verdict).toBe('Aggressive Sell')
  })

  it('bearish + oversold RSI → Reduce Position', () => {
    const result = computeTraderReview(
      makeAnalysis({ trend: 'moderate bearish', rsi: 22, adxStrength: 'weak' }),
      makeConfidence({ score: 5.5 }),
      makeDecision({ label: 'Sell' }),
      makeTradePlan({ actionable: true }),
      makeMarketContext({ isTrending: true }),
    )
    expect(result.verdict).toBe('Reduce Position')
  })

  it('avoid setup quality → Avoid verdict', () => {
    const result = computeTraderReview(
      makeAnalysis(),
      makeConfidence(),
      makeDecision({ label: 'Watch' }),
      makeTradePlan({ actionable: false, setupQuality: 'avoid' }),
      makeMarketContext(),
    )
    expect(result.verdict).toBe('Avoid')
  })

  it('reasoning has at most 4 entries', () => {
    const result = computeTraderReview(
      makeAnalysis(), makeConfidence(), makeDecision(), makeTradePlan(), makeMarketContext(),
    )
    expect(result.reasoning.length).toBeLessThanOrEqual(4)
  })
})

// ─── computeOpportunityAssessment ────────────────────────────────────────────

describe('computeOpportunityAssessment', () => {
  it('returns required shape', () => {
    const result = computeOpportunityAssessment(makeAnalysis(), makeConfidence(), makeTradePlan(), makeMarketContext())
    expect(result).toHaveProperty('marketQuality')
    expect(result).toHaveProperty('marketQualityDetail')
    expect(result).toHaveProperty('tradingOpportunity')
    expect(result).toHaveProperty('tradingOpportunityDetail')
    expect(result).toHaveProperty('combinedMessage')
  })

  it('excellent confidence + strong ADX + high confluence → excellent market quality', () => {
    const confidence = makeConfidence({ score: 8.0, confluenceRatio: 0.85 })
    const result = computeOpportunityAssessment(
      makeAnalysis({ adxStrength: 'strong' }),
      confidence,
      makeTradePlan(),
      makeMarketContext(),
    )
    expect(result.marketQuality).toBe('excellent')
  })

  it('strong contradictions → poor market quality', () => {
    const confidence = makeConfidence({
      score: 4.0,
      contradictions: [{ category: 'Trend', severity: 'strong', description: 'Conflict', factors: [] }],
    })
    const result = computeOpportunityAssessment(makeAnalysis(), confidence, makeTradePlan(), makeMarketContext())
    expect(result.marketQuality).toBe('poor')
  })

  it('excellent setup quality maps to excellent trading opportunity', () => {
    const result = computeOpportunityAssessment(
      makeAnalysis(),
      makeConfidence(),
      makeTradePlan({ setupQuality: 'excellent' }),
      makeMarketContext(),
    )
    expect(result.tradingOpportunity).toBe('excellent')
  })

  it('average setup quality maps to fair trading opportunity', () => {
    const result = computeOpportunityAssessment(
      makeAnalysis(),
      makeConfidence(),
      makeTradePlan({ setupQuality: 'average' }),
      makeMarketContext(),
    )
    expect(result.tradingOpportunity).toBe('fair')
  })

  it('avoid setup quality maps to none trading opportunity', () => {
    const result = computeOpportunityAssessment(
      makeAnalysis(),
      makeConfidence(),
      makeTradePlan({ setupQuality: 'avoid', actionable: false }),
      makeMarketContext(),
    )
    expect(result.tradingOpportunity).toBe('none')
  })

  it('no_setup quality maps to none trading opportunity', () => {
    const result = computeOpportunityAssessment(
      makeAnalysis(),
      makeConfidence(),
      makeTradePlan({ setupQuality: 'no_setup', actionable: false }),
      makeMarketContext(),
    )
    expect(result.tradingOpportunity).toBe('none')
  })

  it('combinedMessage is a non-empty string', () => {
    const result = computeOpportunityAssessment(makeAnalysis(), makeConfidence(), makeTradePlan(), makeMarketContext())
    expect(typeof result.combinedMessage).toBe('string')
    expect(result.combinedMessage.length).toBeGreaterThan(5)
  })

  it('both excellent → combined message mentions high quality', () => {
    const confidence = makeConfidence({ score: 8.0, confluenceRatio: 0.85 })
    const result = computeOpportunityAssessment(
      makeAnalysis({ adxStrength: 'strong' }),
      confidence,
      makeTradePlan({ setupQuality: 'excellent' }),
      makeMarketContext(),
    )
    expect(result.combinedMessage).toMatch(/strong|high.quality|excellent/i)
  })
})

// ─── computeSanityAudit ──────────────────────────────────────────────────────

describe('computeSanityAudit', () => {
  it('returns required shape', () => {
    const result = computeSanityAudit(makeAnalysis(), makeConfidence(), makeDecision())
    expect(result).toHaveProperty('flags')
    expect(result).toHaveProperty('hasIssues')
    expect(Array.isArray(result.flags)).toBe(true)
  })

  it('clean scenario → no flags', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'strong bullish', rsi: 60 }),
      makeConfidence({ score: 7.5 }),
      makeDecision({ label: 'Strong Buy' }),
    )
    expect(result.hasIssues).toBe(false)
    expect(result.flags.length).toBe(0)
  })

  it('strong trend + low confidence → strong_trend_low_confidence flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'strong bullish' }),
      makeConfidence({ score: 3.5 }),
      makeDecision({ label: 'Buy' }),
    )
    expect(result.hasIssues).toBe(true)
    const flag = result.flags.find(f => f.type === 'strong_trend_low_confidence')
    expect(flag).toBeDefined()
  })

  it('ranging + high confidence → ranging_high_confidence flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'ranging' }),
      makeConfidence({ score: 7.5 }),
      makeDecision({ label: 'Neutral' }),
    )
    expect(result.hasIssues).toBe(true)
    const flag = result.flags.find(f => f.type === 'ranging_high_confidence')
    expect(flag).toBeDefined()
  })

  it('high confidence + multiple strong contradictions → high_confidence_many_contradictions flag', () => {
    const confidence = makeConfidence({
      score: 7.0,
      contradictions: [
        { category: 'Trend', severity: 'strong', description: 'Conflict A', factors: [] },
        { category: 'Volume', severity: 'strong', description: 'Conflict B', factors: [] },
      ],
    })
    const result = computeSanityAudit(makeAnalysis(), confidence, makeDecision())
    expect(result.hasIssues).toBe(true)
    const flag = result.flags.find(f => f.type === 'high_confidence_many_contradictions')
    expect(flag).toBeDefined()
  })

  it('Buy decision on bearish trend → decision_trend_mismatch flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'strong bearish' }),
      makeConfidence(),
      makeDecision({ label: 'Buy' }),
    )
    expect(result.hasIssues).toBe(true)
    const flag = result.flags.find(f => f.type === 'decision_trend_mismatch')
    expect(flag).toBeDefined()
  })

  it('Sell decision on bullish trend → decision_trend_mismatch flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'strong bullish' }),
      makeConfidence(),
      makeDecision({ label: 'Sell' }),
    )
    const flag = result.flags.find(f => f.type === 'decision_trend_mismatch')
    expect(flag).toBeDefined()
  })

  it('strong trend label + weak ADX → strong_trend_weak_adx flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'strong bullish', adxStrength: 'weak' }),
      makeConfidence(),
      makeDecision({ label: 'Strong Buy' }),
    )
    const flag = result.flags.find(f => f.type === 'strong_trend_weak_adx')
    expect(flag).toBeDefined()
  })

  it('Buy signal with RSI ≥ 75 → overbought_buy_signal flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ rsi: 78 }),
      makeConfidence(),
      makeDecision({ label: 'Buy' }),
    )
    expect(result.hasIssues).toBe(true)
    const flag = result.flags.find(f => f.type === 'overbought_buy_signal')
    expect(flag).toBeDefined()
  })

  it('Sell signal with RSI ≤ 25 → oversold_sell_signal flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ rsi: 22 }),
      makeConfidence(),
      makeDecision({ label: 'Sell' }),
    )
    const flag = result.flags.find(f => f.type === 'oversold_sell_signal')
    expect(flag).toBeDefined()
  })

  it('strong trend without volume confirmation → volume_not_confirming_strong_trend flag', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'strong bullish', volumeConfirms: false }),
      makeConfidence(),
      makeDecision({ label: 'Strong Buy' }),
    )
    const flag = result.flags.find(f => f.type === 'volume_not_confirming_strong_trend')
    expect(flag).toBeDefined()
  })

  it('hasIssues is false when flags array is empty', () => {
    const result = computeSanityAudit(
      makeAnalysis({ rsi: 60 }),
      makeConfidence({ score: 7.0 }),
      makeDecision({ label: 'Buy' }),
    )
    expect(result.hasIssues).toBe(result.flags.length > 0)
  })

  it('each flag has type and description strings', () => {
    const result = computeSanityAudit(
      makeAnalysis({ trend: 'strong bullish' }),
      makeConfidence({ score: 2.0 }),
      makeDecision({ label: 'Strong Buy' }),
    )
    for (const flag of result.flags) {
      expect(typeof flag.type).toBe('string')
      expect(typeof flag.description).toBe('string')
      expect(flag.type.length).toBeGreaterThan(0)
      expect(flag.description.length).toBeGreaterThan(0)
    }
  })
})
