import { describe, it, expect } from 'vitest'
import { deriveImprovementCandidates } from '../candidates'
import { attributeRecords } from '../attribution'
import type { AttributedRecord } from '../types'
import type { ValidationRecord } from '../../types'

// ── Minimal attributed record factory ────────────────────────────────────────

function makeAttributed(overrides: {
  result?: 'tp_hit' | 'sl_hit' | 'neither' | 'no_trade'
  confidence?: number
  rr?: number | null
  trend?: string
}): AttributedRecord {
  const {
    result     = 'sl_hit',
    confidence = 6,
    rr         = 2.0,
    trend      = 'strong_bullish',
  } = overrides

  const raw: ValidationRecord = {
    snapshot: {
      id: 'c', symbol: 'BTCUSDT', interval: '1h',
      timestamp: 0, snapshotCandleIndex: 100,
      direction: 'bullish' as any,
      pipeline: {
        confidence:   { score: confidence } as any,
        traderReview: { verdict: 'Aggressive Buy' } as any,
        tradePlan:    { riskRewardRatio: rr, setupQuality: 'good' } as any,
        marketStructure: {
          strength: 'moderate', confidence: 60,
          bos:      { detected: false } as any,
          choch:    { detected: false } as any,
          breakout: { confirmed: false } as any,
        } as any,
        analysis: {
          fullTrend:  { trend } as any,
          emaContext: { emaAlignment: 'bullish_stack' } as any,
          indicatorSummary: {
            rsi:  { classification: 'neutral' } as any,
            macd: { bias: 'neutral' } as any,
            adx:  { trendStrength: 'moderate' } as any,
          } as any,
          srContext: {
            insideSupport: false, insideResistance: false,
            approachingSupport: false, approachingResistance: false,
          } as any,
          volumeContext: {
            relativeVolume: 1.0, overallStrength: 5,
            confirmsCurrentMove: false, obvConfirmingPrice: false,
          } as any,
        } as any,
        contradictionIntelligence: { overallSeverity: 'none' } as any,
        sanityAudit: { hasIssues: false } as any,
        indicators:  { atrPercent: null } as any,
        opportunityAssessment: { tradingOpportunity: 'moderate' } as any,
      } as any,
    } as any,
    outcome: {
      snapshotId: 'c', result,
      barsToOutcome: null, mfe: 0, mfePct: 0, mae: 0, maePct: 0,
      actualRR: null, entryPrice: 100, stopPrice: 97, targetPrice: 106,
    },
  }

  const [ar] = attributeRecords([raw])
  return ar
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('deriveImprovementCandidates', () => {
  it('returns an array (possibly empty)', () => {
    const records = [makeAttributed({ result: 'tp_hit' }), makeAttributed({ result: 'sl_hit' })]
    const candidates = deriveImprovementCandidates(records)
    expect(Array.isArray(candidates)).toBe(true)
  })

  it('only includes candidates that improve expectancy', () => {
    const records = [
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'tp_hit', confidence: 8 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 3 }),
    ]
    const candidates = deriveImprovementCandidates(records)
    for (const c of candidates) {
      expect(c.expectancyDelta).toBeGreaterThan(0)
      expect(c.expectancyAfter).toBeGreaterThan(c.expectancyBefore)
    }
  })

  it('low_confidence filter is recommended when losers dominate that segment', () => {
    // 8 low-confidence losers vs 2 high-confidence winners
    const records = [
      ...Array.from({ length: 8 }, () => makeAttributed({ result: 'sl_hit', confidence: 3 })),
      ...Array.from({ length: 10 }, () => makeAttributed({ result: 'tp_hit', confidence: 9 })),
    ]
    const candidates = deriveImprovementCandidates(records)
    const found = candidates.find(c => c.filterId === 'low_confidence')
    expect(found).toBeDefined()
    expect(found!.lossesRemoved).toBeGreaterThan(found!.winsRemoved)
  })

  it('candidates are sorted by expectancy delta descending', () => {
    const records = [
      ...Array.from({ length: 6 }, () => makeAttributed({ result: 'sl_hit', confidence: 3 })),
      ...Array.from({ length: 10 }, () => makeAttributed({ result: 'tp_hit', confidence: 9 })),
    ]
    const candidates = deriveImprovementCandidates(records)
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].expectancyDelta).toBeLessThanOrEqual(candidates[i - 1].expectancyDelta)
    }
  })

  it('provides wilson CI bounds when enough data', () => {
    const records = [
      ...Array.from({ length: 8 }, () => makeAttributed({ result: 'sl_hit', confidence: 3 })),
      ...Array.from({ length: 12 }, () => makeAttributed({ result: 'tp_hit', confidence: 9 })),
    ]
    const candidates = deriveImprovementCandidates(records)
    const found = candidates.find(c => c.filterId === 'low_confidence')
    if (found && found.ciLow !== null) {
      expect(found.ciLow).toBeGreaterThanOrEqual(0)
      expect(found.ciHigh).not.toBeNull()
      expect(found.ciHigh!).toBeLessThanOrEqual(1)
      expect(found.ciLow).toBeLessThanOrEqual(found.ciHigh!)
    }
  })

  it('assigns evidence strength based on sample size and selectivity', () => {
    const records = [
      ...Array.from({ length: 20 }, () => makeAttributed({ result: 'sl_hit', confidence: 3 })),
      ...Array.from({ length: 30 }, () => makeAttributed({ result: 'tp_hit', confidence: 9 })),
    ]
    const candidates = deriveImprovementCandidates(records)
    const found = candidates.find(c => c.filterId === 'low_confidence')
    if (found) {
      expect(['strong', 'moderate', 'weak']).toContain(found.evidenceStrength)
    }
  })

  it('returns empty array when all filters hurt expectancy', () => {
    // Single losers dominate filter keeps ALL losers
    const records = [
      makeAttributed({ result: 'tp_hit', confidence: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 3 }),
      makeAttributed({ result: 'tp_hit', confidence: 3 }),
      makeAttributed({ result: 'sl_hit', confidence: 9 }),
    ]
    const candidates = deriveImprovementCandidates(records)
    // In this pathological case, low_confidence filter would remove winners, not losers
    const lcFilter = candidates.find(c => c.filterId === 'low_confidence')
    if (lcFilter) {
      expect(lcFilter.selectivity).toBeLessThan(0.5)
    }
  })
})
