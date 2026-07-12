import { describe, it, expect } from 'vitest'
import { attributeRecords } from '../attribution'
import type { ValidationRecord } from '../../types'

// ── Minimal record factory ────────────────────────────────────────────────────

function makeRecord(overrides: {
  result?: 'tp_hit' | 'sl_hit' | 'neither' | 'no_trade'
  direction?: 'bullish' | 'bearish' | 'neutral'
  trend?: string
  emaAlignment?: string
  confidence?: number
  verdict?: string
  rr?: number | null
  atrPercent?: number | null
  barsToOutcome?: number | null
  mfePct?: number
  mae?: number
  entryPrice?: number
  stopPrice?: number
  targetPrice?: number
  mfe?: number
  overallSeverity?: string
  hasIssues?: boolean
  msStrength?: string
  msConfidence?: number
  bosDetected?: boolean
  chochDetected?: boolean
  breakoutConfirmed?: boolean
  insideSupport?: boolean
  insideResistance?: boolean
  relativeVolume?: number
  overallStrength?: number
  rsiClass?: string
  macdBias?: string
}): ValidationRecord {
  const {
    result            = 'sl_hit',
    direction         = 'bullish',
    trend             = 'ranging',
    emaAlignment      = 'bullish_stack',
    confidence        = 6,
    verdict           = 'Aggressive Buy',
    rr                = 2.0,
    atrPercent        = null,
    barsToOutcome     = null,
    mfePct            = 0,
    mae               = 0,
    entryPrice        = 100,
    stopPrice         = 98,
    targetPrice       = 104,
    mfe               = 0,
    overallSeverity   = 'none',
    hasIssues         = false,
    msStrength        = 'moderate',
    msConfidence      = 60,
    bosDetected       = false,
    chochDetected     = false,
    breakoutConfirmed = false,
    insideSupport     = false,
    insideResistance  = false,
    relativeVolume    = 1.0,
    overallStrength   = 5,
    rsiClass          = 'neutral',
    macdBias          = 'neutral',
  } = overrides

  return {
    snapshot: {
      id: 'test',
      symbol: 'BTCUSDT',
      interval: '1h',
      timestamp: Date.now(),
      snapshotCandleIndex: 100,
      direction: direction as any,
      pipeline: {
        confidence:   { score: confidence } as any,
        traderReview: { verdict } as any,
        tradePlan:    { riskRewardRatio: rr, setupQuality: 'good' } as any,
        marketStructure: {
          strength: msStrength,
          confidence: msConfidence,
          bos:      { detected: bosDetected } as any,
          choch:    { detected: chochDetected } as any,
          breakout: { confirmed: breakoutConfirmed } as any,
        } as any,
        analysis: {
          fullTrend:    { trend } as any,
          emaContext:   { emaAlignment } as any,
          indicatorSummary: {
            rsi:  { classification: rsiClass } as any,
            macd: { bias: macdBias } as any,
            adx:  { trendStrength: 'moderate' } as any,
          } as any,
          srContext: {
            insideSupport, insideResistance,
            approachingSupport: false, approachingResistance: false,
          } as any,
          volumeContext: {
            relativeVolume, overallStrength,
            confirmsCurrentMove: false,
            obvConfirmingPrice: false,
          } as any,
        } as any,
        contradictionIntelligence: { overallSeverity } as any,
        sanityAudit: { hasIssues } as any,
        indicators:  { atrPercent } as any,
        opportunityAssessment: { tradingOpportunity: 'moderate' } as any,
      } as any,
    } as any,
    outcome: {
      snapshotId: 'test',
      result,
      barsToOutcome,
      mfe,
      mfePct,
      mae,
      maePct: 0,
      actualRR: null,
      entryPrice,
      stopPrice,
      targetPrice,
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('attributeRecords — loss classification', () => {
  it('assigns weak_trend when trend is ranging', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit', trend: 'ranging' })])
    expect(ar.lossReasons).toContain('weak_trend')
  })

  it('assigns weak_trend when trend is weak_bullish', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit', trend: 'weak_bullish' })])
    expect(ar.lossReasons).toContain('weak_trend')
  })

  it('assigns counter_trend for bearish trend on bullish direction', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', direction: 'bullish', trend: 'strong_bearish' }),
    ])
    expect(ar.lossReasons).toContain('counter_trend')
  })

  it('assigns range_chop when ranging with no structure events', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', trend: 'ranging', bosDetected: false, chochDetected: false, breakoutConfirmed: false }),
    ])
    expect(ar.lossReasons).toContain('range_chop')
  })

  it('assigns weak_ema for bullish trade with bearish_stack', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', direction: 'bullish', emaAlignment: 'bearish_stack' }),
    ])
    expect(ar.lossReasons).toContain('weak_ema')
  })

  it('assigns weak_structure when strength=weak and confidence<40', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', msStrength: 'weak', msConfidence: 30 }),
    ])
    expect(ar.lossReasons).toContain('weak_structure')
  })

  it('assigns false_breakout when breakout confirmed and barsToOutcome<=8', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', breakoutConfirmed: true, barsToOutcome: 5 }),
    ])
    expect(ar.lossReasons).toContain('false_breakout')
  })

  it('does NOT assign false_breakout when breakout confirmed but barsToOutcome>8', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', breakoutConfirmed: true, barsToOutcome: 15 }),
    ])
    expect(ar.lossReasons).not.toContain('false_breakout')
  })

  it('assigns late_entry when mae > stop_distance * 1.8', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', entryPrice: 100, stopPrice: 98, mae: 4 }),
    ])
    expect(ar.lossReasons).toContain('late_entry')
  })

  it('assigns stop_too_tight when stop < 0.5% from entry', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', entryPrice: 100, stopPrice: 99.6 }),
    ])
    expect(ar.lossReasons).toContain('stop_too_tight')
  })

  it('assigns target_too_far when mfe < 15% of target distance', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', entryPrice: 100, targetPrice: 110, mfe: 0.5 }),
    ])
    expect(ar.lossReasons).toContain('target_too_far')
  })

  it('assigns low_confidence when score < 4.5', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit', confidence: 4.0 })])
    expect(ar.lossReasons).toContain('low_confidence')
  })

  it('assigns low_trust for Avoid verdict', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit', verdict: 'Avoid' })])
    expect(ar.lossReasons).toContain('low_trust')
  })

  it('assigns mtf_conflict when sanityAudit.hasIssues', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit', hasIssues: true })])
    expect(ar.lossReasons).toContain('mtf_conflict')
  })

  it('assigns liquidity_sweep when barsToOutcome<=3 and mfePct>0.3', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'sl_hit', barsToOutcome: 2, mfePct: 0.5 }),
    ])
    expect(ar.lossReasons).toContain('liquidity_sweep')
  })

  it('assigns high_volatility when atrPercent > 3.5', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit', atrPercent: 4.0 })])
    expect(ar.lossReasons).toContain('high_volatility')
  })

  it('assigns low_volatility when atrPercent < 0.5', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit', atrPercent: 0.3 })])
    expect(ar.lossReasons).toContain('low_volatility')
  })

  it('falls back to unknown when no other reasons apply', () => {
    const [ar] = attributeRecords([
      makeRecord({
        result: 'sl_hit',
        trend: 'strong_bullish',
        direction: 'bullish',
        emaAlignment: 'bullish_stack',
        confidence: 8,
        verdict: 'Aggressive Buy',
        rr: 2.0,
        msStrength: 'strong', msConfidence: 80,
        bosDetected: false, chochDetected: false, breakoutConfirmed: false,
        entryPrice: 100, stopPrice: 97, targetPrice: 106,
        mae: 1, mfe: 3, mfePct: 0.1,
        atrPercent: 1.0,
        overallSeverity: 'none', hasIssues: false,
        relativeVolume: 1.2, overallStrength: 5,
        rsiClass: 'neutral', macdBias: 'bullish',
        insideSupport: false,
      }),
    ])
    expect(ar.lossReasons).toContain('unknown')
  })

  it('assigns no loss reasons for tp_hit records', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'tp_hit' })])
    expect(ar.lossReasons).toHaveLength(0)
  })
})

describe('attributeRecords — win classification', () => {
  it('assigns high_confidence when score >= 7', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'tp_hit', confidence: 8 })])
    expect(ar.winReasons).toContain('high_confidence')
  })

  it('assigns high_trust for Aggressive Buy verdict', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'tp_hit', verdict: 'Aggressive Buy' })])
    expect(ar.winReasons).toContain('high_trust')
  })

  it('assigns aligned_mtf when no contradictions and no sanity issues', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'tp_hit', overallSeverity: 'none', hasIssues: false }),
    ])
    expect(ar.winReasons).toContain('aligned_mtf')
  })

  it('assigns strong_trend when trend includes strong', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'tp_hit', trend: 'strong_bullish' })])
    expect(ar.winReasons).toContain('strong_trend')
  })

  it('assigns perfect_ema for bullish direction with bullish_stack', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'tp_hit', direction: 'bullish', emaAlignment: 'bullish_stack' }),
    ])
    expect(ar.winReasons).toContain('perfect_ema')
  })

  it('assigns strong_structure when strength=strong and bos detected', () => {
    const [ar] = attributeRecords([
      makeRecord({ result: 'tp_hit', msStrength: 'strong', bosDetected: true }),
    ])
    expect(ar.winReasons).toContain('strong_structure')
    expect(ar.winReasons).toContain('bos_confirmed')
  })

  it('assigns good_rr when rr >= 2.5', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'tp_hit', rr: 3.0 })])
    expect(ar.winReasons).toContain('good_rr')
  })

  it('assigns no win reasons for sl_hit records', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'sl_hit' })])
    expect(ar.winReasons).toHaveLength(0)
  })

  it('assigns no win/loss reasons for neither records', () => {
    const [ar] = attributeRecords([makeRecord({ result: 'neither' })])
    expect(ar.lossReasons).toHaveLength(0)
    expect(ar.winReasons).toHaveLength(0)
  })
})

describe('attributeRecords — multi-label', () => {
  it('can assign multiple loss reasons simultaneously', () => {
    const [ar] = attributeRecords([
      makeRecord({
        result: 'sl_hit',
        trend: 'ranging',
        direction: 'bullish',
        emaAlignment: 'bearish_stack',
        confidence: 3,
        verdict: 'Avoid',
      }),
    ])
    expect(ar.lossReasons.length).toBeGreaterThan(1)
    expect(ar.lossReasons).toContain('weak_trend')
    expect(ar.lossReasons).toContain('weak_ema')
    expect(ar.lossReasons).toContain('low_confidence')
    expect(ar.lossReasons).toContain('low_trust')
  })
})
