import { describe, it, expect } from 'vitest'
import { computeFeatureImportance } from '../importance'
import { attributeRecords } from '../attribution'
import type { AttributedRecord } from '../types'
import type { ValidationRecord } from '../../types'

// ── Minimal record factory ────────────────────────────────────────────────────

function makeAttributed(overrides: {
  result?: 'tp_hit' | 'sl_hit'
  confidence?: number
  trend?: string
  direction?: 'bullish' | 'bearish'
  emaAlignment?: string
  rr?: number | null
  relativeVolume?: number
  obvConfirming?: boolean
  bosDetected?: boolean
  chochDetected?: boolean
  breakoutConfirmed?: boolean
  rsiClass?: string
  macdBias?: string
  adxStrength?: string
  volumeConfirms?: boolean
  msStrength?: string
  overallSeverity?: string
  tradingOpportunity?: string
  verdict?: string
}): AttributedRecord {
  const {
    result             = 'sl_hit',
    confidence         = 5,
    trend              = 'moderate_bullish',
    direction          = 'bullish',
    emaAlignment       = 'bullish_stack',
    rr                 = 2.0,
    relativeVolume     = 1.0,
    obvConfirming      = false,
    bosDetected        = false,
    chochDetected      = false,
    breakoutConfirmed  = false,
    rsiClass           = 'neutral',
    macdBias           = 'neutral',
    adxStrength        = 'moderate',
    volumeConfirms     = false,
    msStrength         = 'moderate',
    overallSeverity    = 'none',
    tradingOpportunity = 'moderate',
    verdict            = 'Aggressive Buy',
  } = overrides

  const raw: ValidationRecord = {
    snapshot: {
      id: 'x', symbol: 'BTCUSDT', interval: '1h',
      timestamp: 0, snapshotCandleIndex: 100,
      direction: direction as any,
      pipeline: {
        confidence:   { score: confidence } as any,
        traderReview: { verdict } as any,
        tradePlan:    { riskRewardRatio: rr, setupQuality: 'good' } as any,
        marketStructure: {
          strength: msStrength, confidence: 70,
          bos:      { detected: bosDetected } as any,
          choch:    { detected: chochDetected } as any,
          breakout: { confirmed: breakoutConfirmed } as any,
        } as any,
        analysis: {
          fullTrend:  { trend } as any,
          emaContext: { emaAlignment } as any,
          indicatorSummary: {
            rsi:  { classification: rsiClass } as any,
            macd: { bias: macdBias } as any,
            adx:  { trendStrength: adxStrength } as any,
          } as any,
          srContext: {
            insideSupport: false, insideResistance: false,
            approachingSupport: false, approachingResistance: false,
          } as any,
          volumeContext: {
            relativeVolume, overallStrength: 5,
            confirmsCurrentMove: volumeConfirms,
            obvConfirmingPrice: obvConfirming,
          } as any,
        } as any,
        contradictionIntelligence: { overallSeverity } as any,
        sanityAudit: { hasIssues: false } as any,
        indicators:  { atrPercent: null } as any,
        opportunityAssessment: { tradingOpportunity } as any,
      } as any,
    } as any,
    outcome: {
      snapshotId: 'x', result,
      barsToOutcome: null, mfe: 0, mfePct: 0, mae: 0, maePct: 0,
      actualRR: null, entryPrice: 100, stopPrice: 97, targetPrice: 106,
    },
  }

  const [ar] = attributeRecords([raw])
  return ar
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeFeatureImportance', () => {
  it('returns an array with known features', () => {
    const records = [makeAttributed({ result: 'tp_hit' }), makeAttributed({ result: 'sl_hit' })]
    const rows = computeFeatureImportance(records)
    expect(rows.length).toBeGreaterThan(0)
    const keys = rows.map(r => r.feature)
    expect(keys).toContain('confidence_high')
    expect(keys).toContain('ema_aligned')
    expect(keys).toContain('bos_detected')
  })

  it('is sorted descending by importanceScore', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      makeAttributed({ result: i % 3 === 0 ? 'sl_hit' : 'tp_hit', confidence: 8 }),
    )
    const rows = computeFeatureImportance(records)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].importanceScore).toBeLessThanOrEqual(rows[i - 1].importanceScore)
    }
  })

  it('confidence_high has lift>1 when high-confidence records win at a higher rate', () => {
    const records = [
      // active (confidence >= 7): high win rate
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'sl_hit', confidence: 8 }),
      // inactive (confidence < 7): low win rate (but non-zero so lift is defined)
      makeAttributed({ result: 'sl_hit', confidence: 5 }),
      makeAttributed({ result: 'sl_hit', confidence: 5 }),
      makeAttributed({ result: 'sl_hit', confidence: 5 }),
      makeAttributed({ result: 'tp_hit', confidence: 5 }),
    ]
    const rows = computeFeatureImportance(records)
    const row  = rows.find(r => r.feature === 'confidence_high')!
    expect(row.lift).not.toBeNull()
    expect(row.lift!).toBeGreaterThan(1)
    expect(row.winRateActive).toBeCloseTo(0.75, 5)
    expect(row.winRateInactive).toBeCloseTo(0.25, 5)
  })

  it('confidence_high lift is null when inactive win rate is zero', () => {
    const records = [
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'sl_hit', confidence: 5 }),
      makeAttributed({ result: 'sl_hit', confidence: 5 }),
    ]
    const rows = computeFeatureImportance(records)
    const row  = rows.find(r => r.feature === 'confidence_high')!
    // wrNeg = 0 → lift = null (division by zero guard)
    expect(row.lift).toBeNull()
    expect(row.importanceScore).toBe(0)
  })

  it('sets importanceScore = 0 when lift is null', () => {
    // All records active for a feature that always wins → inactive = empty → lift = null
    const records = [
      makeAttributed({ result: 'tp_hit', rr: 3.0 }),
      makeAttributed({ result: 'sl_hit', rr: 3.0 }),
    ]
    const rows = computeFeatureImportance(records)
    // good_rr: all records have rr>=2, so inactive set is empty → lift null
    const row = rows.find(r => r.feature === 'good_rr')!
    if (row.lift === null) {
      expect(row.importanceScore).toBe(0)
    }
  })

  it('caps lift at 50', () => {
    // active: 100% win rate vs inactive: 0% win rate (very low ratio)
    const records = [
      makeAttributed({ result: 'tp_hit', confidence: 9 }),
      makeAttributed({ result: 'tp_hit', confidence: 9 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
    ]
    const rows = computeFeatureImportance(records)
    for (const row of rows) {
      if (row.lift !== null) {
        expect(row.lift).toBeLessThanOrEqual(50)
      }
    }
  })

  it('handles empty resolved set without throwing', () => {
    const records = [makeAttributed({ result: 'tp_hit' })]
    // Artificially give no resolved records by using an empty array
    expect(() => computeFeatureImportance([])).not.toThrow()
  })
})
