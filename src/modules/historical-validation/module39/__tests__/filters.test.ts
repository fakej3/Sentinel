import { describe, it, expect } from 'vitest'
import { simulateFilters, FILTERS } from '../filters'
import { attributeRecords } from '../attribution'
import type { AttributedRecord } from '../types'
import type { ValidationRecord } from '../../types'

// ── Record factory ────────────────────────────────────────────────────────────

function makeAttributed(overrides: {
  result?: 'tp_hit' | 'sl_hit' | 'neither' | 'no_trade'
  confidence?: number
  trend?: string
  relativeVolume?: number
  verdict?: string
  rr?: number | null
  overallSeverity?: string
  hasIssues?: boolean
  msStrength?: string
  msConfidence?: number
  emaAlignment?: string
  direction?: 'bullish' | 'bearish' | 'neutral'
  rsiClass?: string
  macdBias?: string
  atrPercent?: number | null
  setupQuality?: string
  bosDetected?: boolean
}): AttributedRecord {
  const {
    result          = 'sl_hit',
    confidence      = 6,
    trend           = 'strong_bullish',
    relativeVolume  = 1.0,
    verdict         = 'Aggressive Buy',
    rr              = 2.0,
    overallSeverity = 'none',
    hasIssues       = false,
    msStrength      = 'moderate',
    msConfidence    = 60,
    emaAlignment    = 'bullish_stack',
    direction       = 'bullish',
    rsiClass        = 'neutral',
    macdBias        = 'neutral',
    atrPercent      = null,
    setupQuality    = 'good',
    bosDetected     = true,
  } = overrides

  const raw: ValidationRecord = {
    snapshot: {
      id: 'test', symbol: 'BTCUSDT', interval: '1h',
      timestamp: Date.now(), snapshotCandleIndex: 100,
      direction: direction as any,
      pipeline: {
        confidence:   { score: confidence } as any,
        traderReview: { verdict } as any,
        tradePlan:    { riskRewardRatio: rr, setupQuality } as any,
        marketStructure: {
          strength: msStrength, confidence: msConfidence,
          bos:      { detected: bosDetected } as any,
          choch:    { detected: false } as any,
          breakout: { confirmed: false } as any,
        } as any,
        analysis: {
          fullTrend:  { trend } as any,
          emaContext: { emaAlignment } as any,
          indicatorSummary: {
            rsi:  { classification: rsiClass } as any,
            macd: { bias: macdBias } as any,
            adx:  { trendStrength: 'moderate' } as any,
          } as any,
          srContext: {
            insideSupport: false, insideResistance: false,
            approachingSupport: false, approachingResistance: false,
          } as any,
          volumeContext: {
            relativeVolume, overallStrength: 5,
            confirmsCurrentMove: true, obvConfirmingPrice: true,
          } as any,
        } as any,
        contradictionIntelligence: { overallSeverity } as any,
        sanityAudit: { hasIssues } as any,
        indicators:  { atrPercent } as any,
        opportunityAssessment: { tradingOpportunity: 'moderate' } as any,
      } as any,
    } as any,
    outcome: {
      snapshotId: 'test', result,
      barsToOutcome: null, mfe: 0, mfePct: 0, mae: 0, maePct: 0,
      actualRR: null, entryPrice: 100, stopPrice: 97, targetPrice: 106,
    },
  }

  const [ar] = attributeRecords([raw])
  return ar
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('simulateFilters', () => {
  it('returns one result per filter definition', () => {
    const records = [makeAttributed({ result: 'tp_hit' }), makeAttributed({ result: 'sl_hit' })]
    const results = simulateFilters(records)
    expect(results).toHaveLength(FILTERS.length)
  })

  it('before stats are identical across all filter results', () => {
    const records = [
      makeAttributed({ result: 'tp_hit' }),
      makeAttributed({ result: 'sl_hit' }),
      makeAttributed({ result: 'neither' }),
    ]
    const results = simulateFilters(records)
    const first = results[0].before
    for (const r of results) {
      expect(r.before.totalRecords).toBe(first.totalRecords)
      expect(r.before.winCount).toBe(first.winCount)
    }
  })

  it('low_confidence filter excludes records with confidence < 4.5', () => {
    const records = [
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
    ]
    const results = simulateFilters(records)
    const filter  = results.find(r => r.filterId === 'low_confidence')!
    expect(filter.after.totalRecords).toBe(1)
    expect(filter.after.winCount).toBe(1)
  })

  it('weak_trend filter excludes ranging trades', () => {
    const records = [
      makeAttributed({ result: 'sl_hit', trend: 'ranging' }),
      makeAttributed({ result: 'tp_hit', trend: 'strong_bullish' }),
    ]
    const results = simulateFilters(records)
    const filter  = results.find(r => r.filterId === 'weak_trend')!
    expect(filter.after.totalRecords).toBe(1)
    expect(filter.after.winCount).toBe(1)
  })

  it('poor_rr filter keeps null RR (no planned trade)', () => {
    const records = [
      makeAttributed({ result: 'sl_hit', rr: 1.0 }),
      makeAttributed({ result: 'tp_hit', rr: null }),
    ]
    const results = simulateFilters(records)
    const filter  = results.find(r => r.filterId === 'poor_rr')!
    // RR=1.0 should be excluded (< 1.5); null should be kept
    expect(filter.after.totalRecords).toBe(1)
  })

  it('computes selectivity as losses_removed / total_removed', () => {
    const records = [
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
    ]
    const results = simulateFilters(records)
    const filter  = results.find(r => r.filterId === 'low_confidence')!
    expect(filter.lossesRemoved).toBe(2)
    expect(filter.winsRemoved).toBe(0)
    expect(filter.selectivity).toBe(1.0)
  })

  it('marks improvesExpectancy=true when losses removed proportionally exceed wins', () => {
    // Create a dataset where removing low-confidence losers clearly improves expectancy
    const records = [
      makeAttributed({ result: 'sl_hit', confidence: 3, rr: 2 }),
      makeAttributed({ result: 'sl_hit', confidence: 3, rr: 2 }),
      makeAttributed({ result: 'sl_hit', confidence: 3, rr: 2 }),
      makeAttributed({ result: 'tp_hit', confidence: 8, rr: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 8, rr: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 8, rr: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 8, rr: 3 }),
    ]
    const results = simulateFilters(records)
    const filter  = results.find(r => r.filterId === 'low_confidence')!
    expect(filter.improvesExpectancy).toBe(true)
    expect(filter.expectancyDelta).not.toBeNull()
    expect(filter.expectancyDelta!).toBeGreaterThan(0)
  })

  it('expectancy follows formula: wr * avgRR - (1 - wr)', () => {
    const records = [
      makeAttributed({ result: 'tp_hit', rr: 2.0 }),
      makeAttributed({ result: 'sl_hit', rr: 2.0 }),
    ]
    const results = simulateFilters(records)
    // Before: 1W 1L → WR = 0.5, avgRR = 2, E = 0.5*2 - 0.5 = 0.5
    expect(results[0].before.expectancy).toBeCloseTo(0.5, 3)
  })
})
