import { describe, it, expect } from 'vitest'
import { computeDecision } from '../compute/decision'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { Timeframe } from '../../binance/types'

// ─── Stubs ─────────────────────────────────────────────────────────────────────

function makeAnalysis(
  trend: MarketAnalysisResult['fullTrend']['trend'] = 'strong bullish',
  overrides: Partial<{
    bullishMet: number
    bearishMet: number
    rsi: number | null
    rsiClass: string
    relativeVolume: number
    volumeConfirms: boolean
    nearestResistanceDist: number | null
    nearestSupportDist: number | null
    insideResistance: boolean
    insideSupport: boolean
    emaAlignment: string
  }> = {},
): MarketAnalysisResult {
  const o = overrides
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')
  return {
    symbol: 'BTCUSDT', timeframe: '1h' as Timeframe, analysedAt: 0,
    price: { current: 50000, change24hPercent: 2, high24h: 51000, low24h: 49000, atrPercent: 2 },
    fullTrend: {
      trend,
      bullishConditionsMet: o.bullishMet ?? (isBullish ? 4 : 0),
      bearishConditionsMet: o.bearishMet ?? (isBearish ? 4 : 0),
      neutralConditionsMet: 0,
      conditions: {} as never,
    },
    emaContext: {
      priceVsEMA20: 'above', priceVsEMA50: 'above', priceVsEMA100: 'above', priceVsEMA200: 'above',
      emaAlignment: (o.emaAlignment ?? (isBullish ? 'bullish_stack' : isBearish ? 'bearish_stack' : 'mixed')) as 'bullish_stack' | 'bearish_stack' | 'mixed' | 'unavailable',
      confluenceZones: [],
    },
    indicatorSummary: {
      rsi: {
        value: o.rsi ?? (isBullish ? 62 : isBearish ? 38 : 50),
        classification: (o.rsiClass ?? (isBullish ? 'healthy_bullish' : isBearish ? 'weak_bearish' : 'neutral')) as 'healthy_bullish' | 'overbought' | 'oversold' | 'neutral' | 'weak_bearish',
      },
      macd: { histogram: 0.5, bias: isBullish ? 'bullish' : isBearish ? 'bearish' : 'neutral' },
      adx: { adx: 30, trendStrength: 'strong', dominantDirection: isBullish ? 'bullish' : 'bearish' },
      bollinger: { bandwidthPercent: 2, bandwidthState: 'normal', priceRelativeToBands: 'above_upper' },
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
      climaxSignal: 'none',
      accDistState: 'neutral',
      vwap: { available: true, unavailable: null, value: 100, side: 'above', distancePercent: 1.0, respectingVWAP: true },
      obvDirection: 'bullish', obvConfirmingPrice: true,
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

function makeConfidence(score = 7.0): ConfidenceResult {
  return {
    score,
    grade: score >= 7.0 ? 'strong' : score >= 5.0 ? 'moderate' : 'weak',
    trust: { score: 100, level: 'high', factors: [], reductions: [] },
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

function makeValidation(criticals = 0, warnings = 0): ValidationResult {
  return {
    passed: criticals === 0,
    clean: criticals === 0 && warnings === 0,
    criticalCount: criticals,
    warningCount: warnings,
    infoCount: 0,
    issues: [],
    summary: `${criticals} critical, ${warnings} warnings`,
  } as unknown as ValidationResult
}

// ─── Decision matrix ──────────────────────────────────────────────────────────

describe('computeDecision — decision matrix', () => {
  it('strong bullish + score ≥ 6.5 + no criticals → Strong Buy', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.0), makeValidation())
    expect(d.label).toBe('Strong Buy')
  })

  it('strong bullish + score < 6.5 → Buy (not Strong Buy)', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(5.0), makeValidation())
    expect(d.label).toBe('Buy')
  })

  it('strong bullish + score ≥ 6.5 + criticals → Buy (criticals prevent Strong Buy)', () => {
    // The initial label assignment already accounts for hasCritical via !hasCritical guard,
    // so the result is 'Buy', not 'Strong Buy'.
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.5), makeValidation(1))
    expect(d.label).toBe('Buy')
    expect(d.label).not.toBe('Strong Buy')
  })

  it('moderate bullish + score ≥ 5.0 + no criticals → Buy', () => {
    const d = computeDecision(makeAnalysis('moderate bullish', { bullishMet: 3 }), makeConfidence(5.5), makeValidation())
    expect(d.label).toBe('Buy')
  })

  it('moderate bullish + score < 5.0 → Cautious Buy', () => {
    const d = computeDecision(makeAnalysis('moderate bullish', { bullishMet: 3 }), makeConfidence(3.5), makeValidation())
    expect(d.label).toBe('Cautious Buy')
  })

  it('moderate bullish + criticals → Cautious Buy (criticals prevent Buy)', () => {
    const d = computeDecision(makeAnalysis('moderate bullish', { bullishMet: 3 }), makeConfidence(6.0), makeValidation(1))
    expect(d.label).toBe('Cautious Buy')
  })

  it('weak bullish → always Cautious Buy regardless of score', () => {
    const dHigh = computeDecision(makeAnalysis('weak bullish', { bullishMet: 2 }), makeConfidence(9.0), makeValidation())
    const dLow  = computeDecision(makeAnalysis('weak bullish', { bullishMet: 2 }), makeConfidence(1.0), makeValidation())
    expect(dHigh.label).toBe('Cautious Buy')
    expect(dLow.label).toBe('Cautious Buy')
  })

  it('ranging + score ≥ 4.0 → Watch', () => {
    const d = computeDecision(makeAnalysis('ranging', { bullishMet: 2, bearishMet: 2 }), makeConfidence(5.0), makeValidation())
    expect(d.label).toBe('Watch')
  })

  it('ranging + score < 4.0 → Neutral', () => {
    const d = computeDecision(makeAnalysis('ranging', { bullishMet: 2, bearishMet: 2 }), makeConfidence(2.0), makeValidation())
    expect(d.label).toBe('Neutral')
  })

  it('weak bearish → always Cautious Sell regardless of score', () => {
    const dHigh = computeDecision(makeAnalysis('weak bearish', { bearishMet: 2, bullishMet: 0 }), makeConfidence(9.0), makeValidation())
    const dLow  = computeDecision(makeAnalysis('weak bearish', { bearishMet: 2, bullishMet: 0 }), makeConfidence(1.0), makeValidation())
    expect(dHigh.label).toBe('Cautious Sell')
    expect(dLow.label).toBe('Cautious Sell')
  })

  it('moderate bearish + score ≥ 5.0 + no criticals → Sell', () => {
    const d = computeDecision(makeAnalysis('moderate bearish', { bearishMet: 3, bullishMet: 0 }), makeConfidence(6.0), makeValidation())
    expect(d.label).toBe('Sell')
  })

  it('moderate bearish + score < 5.0 → Cautious Sell', () => {
    const d = computeDecision(makeAnalysis('moderate bearish', { bearishMet: 3, bullishMet: 0 }), makeConfidence(3.0), makeValidation())
    expect(d.label).toBe('Cautious Sell')
  })

  it('moderate bearish + criticals → Cautious Sell (criticals prevent Sell)', () => {
    const d = computeDecision(makeAnalysis('moderate bearish', { bearishMet: 3, bullishMet: 0 }), makeConfidence(7.0), makeValidation(1))
    expect(d.label).toBe('Cautious Sell')
  })

  it('strong bearish + score ≥ 6.5 + no criticals → Strong Sell', () => {
    const d = computeDecision(makeAnalysis('strong bearish', { bearishMet: 4, bullishMet: 0 }), makeConfidence(7.0), makeValidation())
    expect(d.label).toBe('Strong Sell')
  })

  it('strong bearish + score < 6.5 → Sell', () => {
    const d = computeDecision(makeAnalysis('strong bearish', { bearishMet: 4, bullishMet: 0 }), makeConfidence(5.0), makeValidation())
    expect(d.label).toBe('Sell')
  })

  it('strong bearish + criticals → Sell (criticals prevent Strong Sell)', () => {
    const d = computeDecision(makeAnalysis('strong bearish', { bearishMet: 4, bullishMet: 0 }), makeConfidence(8.0), makeValidation(1))
    expect(d.label).toBe('Sell')
    expect(d.label).not.toBe('Strong Sell')
  })
})

// ─── Risk level ───────────────────────────────────────────────────────────────

describe('computeDecision — risk level', () => {
  it('criticals → High risk', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.0), makeValidation(1))
    expect(d.riskLevel).toBe('High')
  })

  it('score < 3 → High risk', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(2.5), makeValidation())
    expect(d.riskLevel).toBe('High')
  })

  it('warnings without criticals → at most Medium risk', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(6.0), makeValidation(0, 2))
    expect(d.riskLevel).toBe('Medium')
  })

  it('score < 5.5 without criticals or warnings → Medium risk', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(5.0), makeValidation())
    expect(d.riskLevel).toBe('Medium')
  })

  it('clean + score ≥ 5.5 → Low risk', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.0), makeValidation())
    expect(d.riskLevel).toBe('Low')
  })
})

// ─── Output shape ─────────────────────────────────────────────────────────────

describe('computeDecision — output shape', () => {
  it('confidence field mirrors the input score', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(6.2), makeValidation())
    expect(d.confidence).toBe(6.2)
  })

  it('returns 1–5 reason bullets', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.0), makeValidation())
    expect(d.reasons.length).toBeGreaterThanOrEqual(1)
    expect(d.reasons.length).toBeLessThanOrEqual(5)
  })

  it('every reason is a non-empty string', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.0), makeValidation(0, 2))
    for (const r of d.reasons) {
      expect(typeof r).toBe('string')
      expect(r.length).toBeGreaterThan(0)
    }
  })

  it('explanation and quality fields are present', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.0), makeValidation())
    expect(typeof d.explanation).toBe('object')
    expect(typeof d.quality).toBe('object')
    expect(typeof d.quality.score).toBe('number')
  })

  it('is deterministic — same inputs produce the same result', () => {
    const analysis = makeAnalysis('moderate bullish', { bullishMet: 3 })
    const confidence = makeConfidence(6.0)
    const validation = makeValidation(0, 1)
    const d1 = computeDecision(analysis, confidence, validation)
    const d2 = computeDecision(analysis, confidence, validation)
    expect(d1.label).toBe(d2.label)
    expect(d1.riskLevel).toBe(d2.riskLevel)
    expect(d1.confidence).toBe(d2.confidence)
  })
})

// ─── Reason content ───────────────────────────────────────────────────────────

describe('computeDecision — reason content', () => {
  it('bullish trend reason names the bullish conditions count', () => {
    const d = computeDecision(makeAnalysis('strong bullish', { bullishMet: 5 }), makeConfidence(7.0), makeValidation())
    const trendReason = d.reasons[0]
    expect(trendReason).toMatch(/5\/5|5.5/)
    expect(trendReason.toLowerCase()).toMatch(/bullish/)
  })

  it('bearish trend reason names the bearish conditions count', () => {
    const d = computeDecision(makeAnalysis('strong bearish', { bearishMet: 4, bullishMet: 0 }), makeConfidence(7.0), makeValidation())
    expect(d.reasons[0]).toMatch(/4\/5|4.5/)
    expect(d.reasons[0].toLowerCase()).toMatch(/bearish/)
  })

  it('ranging trend reason acknowledges both directions', () => {
    const d = computeDecision(
      makeAnalysis('ranging', { bullishMet: 2, bearishMet: 2 }),
      makeConfidence(5.0), makeValidation(),
    )
    expect(d.reasons[0].toLowerCase()).toMatch(/ranging/)
  })

  it('critical validation issues appear in reasons', () => {
    const d = computeDecision(makeAnalysis('strong bullish'), makeConfidence(7.0), makeValidation(2))
    const hasValidationReason = d.reasons.some(r => r.toLowerCase().includes('critical'))
    expect(hasValidationReason).toBe(true)
  })

  it('healthy_bullish RSI produces a supportive momentum reason', () => {
    const d = computeDecision(
      makeAnalysis('strong bullish', { rsi: 62, rsiClass: 'healthy_bullish' }),
      makeConfidence(7.0), makeValidation(),
    )
    const rsiReason = d.reasons.find(r => r.toLowerCase().includes('rsi'))
    expect(rsiReason).toBeDefined()
    expect(rsiReason!.toLowerCase()).toMatch(/bullish|healthy/)
  })

  it('overbought RSI produces a caution reason', () => {
    const d = computeDecision(
      makeAnalysis('strong bullish', { rsi: 82, rsiClass: 'overbought' }),
      makeConfidence(7.0), makeValidation(),
    )
    const rsiReason = d.reasons.find(r => r.toLowerCase().includes('rsi'))
    expect(rsiReason).toBeDefined()
    expect(rsiReason!.toLowerCase()).toMatch(/overbought|peak/)
  })

  it('oversold RSI produces a reversal reason', () => {
    const d = computeDecision(
      makeAnalysis('strong bullish', { rsi: 28, rsiClass: 'oversold' }),
      makeConfidence(7.0), makeValidation(),
    )
    const rsiReason = d.reasons.find(r => r.toLowerCase().includes('rsi'))
    expect(rsiReason).toBeDefined()
    expect(rsiReason!.toLowerCase()).toMatch(/oversold|reversal/)
  })

  it('volume confirmation appears in reasons when present', () => {
    const d = computeDecision(
      makeAnalysis('strong bullish', { volumeConfirms: true, relativeVolume: 1.5 }),
      makeConfidence(7.0), makeValidation(),
    )
    const volReason = d.reasons.find(r => r.toLowerCase().includes('volume'))
    expect(volReason).toBeDefined()
    expect(volReason!.toLowerCase()).toMatch(/confirm/)
  })

  it('low volume (< 0.7×) appears as a weak-conviction reason', () => {
    const d = computeDecision(
      makeAnalysis('strong bullish', { volumeConfirms: false, relativeVolume: 0.65 }),
      makeConfidence(7.0), makeValidation(),
    )
    const volReason = d.reasons.find(r => r.toLowerCase().includes('volume'))
    expect(volReason).toBeDefined()
    expect(volReason!.toLowerCase()).toMatch(/low|conviction/)
  })

  it('volume at 0.75× (above 0.7 threshold) does NOT add a low-volume reason', () => {
    const d = computeDecision(
      makeAnalysis('strong bullish', { volumeConfirms: false, relativeVolume: 0.75 }),
      makeConfidence(7.0), makeValidation(),
    )
    const lowVolReason = d.reasons.find(r => r.toLowerCase().includes('low') && r.toLowerCase().includes('volume'))
    expect(lowVolReason).toBeUndefined()
  })

  it('price inside resistance zone in bullish trend produces a breakout-needed reason', () => {
    const d = computeDecision(
      makeAnalysis('strong bullish', { insideResistance: true }),
      makeConfidence(7.0), makeValidation(),
    )
    const srReason = d.reasons.find(r => r.toLowerCase().includes('resistance'))
    expect(srReason).toBeDefined()
    expect(srReason!.toLowerCase()).toMatch(/breakout/)
  })
})
