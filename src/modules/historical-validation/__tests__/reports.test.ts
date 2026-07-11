import { describe, it, expect } from 'vitest'
import {
  buildConfidenceCalibrationReport,
  buildTrustValidationReport,
  buildEvidenceReport,
  buildTradePlanReport,
  buildPostValidationReport,
} from '../reports'
import type { ValidationRecord, ValidationSnapshot, TradeOutcome } from '../types'
import type { PipelineResult } from '../../pipeline/types'

// ── Stub helpers ──────────────────────────────────────────────────────────────

function makeOutcome(
  result: TradeOutcome['result'],
  opts: Partial<TradeOutcome> = {},
): TradeOutcome {
  return {
    snapshotId: 'test',
    result,
    barsToOutcome: result === 'tp_hit' || result === 'sl_hit' ? 5 : null,
    mfe: result === 'tp_hit' ? 10 : 5,
    mfePct: result === 'tp_hit' ? 1.0 : 0.5,
    mae: result === 'sl_hit' ? 10 : 2,
    maePct: result === 'sl_hit' ? 1.0 : 0.2,
    actualRR: result === 'tp_hit' ? 2.5 : result === 'sl_hit' ? -1.0 : null,
    entryPrice: result !== 'no_trade' ? 100 : null,
    stopPrice:  95,
    targetPrice: 115,
    ...opts,
  }
}

function makePipeline(
  confidenceScore: number,
  trustScore: number,
  trend: string,
  setupQuality: PipelineResult['tradePlan']['setupQuality'] = 'excellent',
  rr: number | null = 2.5,
  evidenceFactors: Array<{ factor: string; direction: 'bullish' | 'bearish' | 'neutral' }> = [],
): PipelineResult {
  const actionable = setupQuality === 'excellent' || setupQuality === 'good' || setupQuality === 'average'
  return {
    confidence: {
      score: confidenceScore,
      grade: 'strong',
      reasons: [],
      penalties: [],
      warnings: [],
      trust: { score: trustScore, level: 'high', factors: [], reductions: [] },
    },
    analysis: {
      fullTrend: { trend, bullishConditionsMet: 3, bearishConditionsMet: 0, neutralConditionsMet: 0, conditions: {} },
      evidence: evidenceFactors.map(e => ({
        factor: e.factor,
        direction: e.direction,
        impact: 'medium' as const,
        description: e.factor,
        source: 'indicators' as const,
      })),
      // Fields consumed by buildBinancePost
      indicatorSummary: {
        rsi:  { value: 60, classification: 'healthy_bullish' },
        macd: { histogram: 0.5, bias: 'bullish' },
        adx:  { adx: 28, trendStrength: 'strong', dominantDirection: 'bullish' },
        bollinger: { bandwidth: 2, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 0.6, d: 0.55, zone: 'neutral' },
      },
      volumeContext: {
        relativeVolume: 1.2,
        volumeClassification: 'normal',
        confirmsCurrentMove: true,
        climaxSignal: 'none',
        accDistState: 'neutral',
        priceAboveVWAP: true,
        vwapDistancePercent: 0.5,
        respectingVWAP: true,
        obvDirection: 'bullish',
        obvConfirmingPrice: true,
        overallStrength: 6,
      },
      marketStructure: {
        trend: 'bullish',
        bos:          { detected: false, events: [], last: null },
        choch:        { detected: false, events: [], last: null },
        consolidation: { detected: false, rangeHigh: null, rangeLow: null, rangePercent: null, barsInRange: 0 },
      },
      srContext: {
        nearestSupportDistance: -2,
        nearestResistanceDistance: 5,
        insideSupport: false,
        insideResistance: false,
        approachingSupport: false,
        approachingResistance: false,
        strongestActiveSupport: null,
        strongestActiveResistance: null,
      },
    },
    tradePlan: {
      setupQuality,
      riskRewardRatio: rr,
      actionable,
      entryZone: actionable ? { lower: 98, upper: 102 } : null,
      invalidationLevel: actionable ? 95 : null,
      targetLevel: actionable ? 115 : null,
      setupQualityReason: 'test',
      patienceMessage: 'test',
    },
    validation: { passed: true, clean: true, criticalCount: 0, warningCount: 0, infoCount: 0, issues: [], summary: '' },
    marketContext: { phase: 'trending_bullish', secondaryPhases: [], description: '', volatility: 'normal', isTrending: true },
    invalidationScenarios: [{ type: 'price_level', severity: 'critical', description: 'A close below key support invalidates the bullish thesis' }],
    // minimally typed — other fields not needed for report tests
  } as unknown as PipelineResult
}

function makeRecord(
  result: TradeOutcome['result'],
  confidenceScore = 7.5,
  trustScore = 90,
  trend = 'strong bullish',
  quality: PipelineResult['tradePlan']['setupQuality'] = 'excellent',
  rr: number | null = 2.5,
  evidenceFactors: Array<{ factor: string; direction: 'bullish' | 'bearish' | 'neutral' }> = [],
): ValidationRecord {
  const pipeline = makePipeline(confidenceScore, trustScore, trend, quality, rr, evidenceFactors)
  const snapshot: ValidationSnapshot = {
    id: `snap-${confidenceScore}-${trustScore}`,
    symbol: 'BTCUSDT',
    interval: '1h',
    timestamp: 0,
    snapshotCandleIndex: 100,
    pipeline,
    direction: trend.includes('bullish') ? 'bullish' : trend.includes('bearish') ? 'bearish' : 'neutral',
  }
  return { snapshot, outcome: makeOutcome(result) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Calibration
// ─────────────────────────────────────────────────────────────────────────────

describe('buildConfidenceCalibrationReport', () => {
  it('returns 10 buckets', () => {
    const report = buildConfidenceCalibrationReport([])
    expect(report.buckets).toHaveLength(10)
  })

  it('places a record in the correct bucket', () => {
    const records = [makeRecord('tp_hit', 7.5)]
    const report = buildConfidenceCalibrationReport(records)
    const bucket = report.buckets.find(b => b.label === '7-8')!
    expect(bucket.totalTrades).toBe(1)
    expect(bucket.wins).toBe(1)
  })

  it('win rate is wins / (wins + losses)', () => {
    const records = [
      makeRecord('tp_hit', 8.0),
      makeRecord('tp_hit', 8.2),
      makeRecord('sl_hit', 8.5),
    ]
    const report = buildConfidenceCalibrationReport(records)
    const bucket = report.buckets.find(b => b.label === '8-9')!
    expect(bucket.winRate).toBeCloseTo(2 / 3, 4)
  })

  it('no_trade records are excluded from bucket totals', () => {
    const records = [makeRecord('no_trade', 7.5)]
    const report = buildConfidenceCalibrationReport(records)
    const bucket = report.buckets.find(b => b.label === '7-8')!
    expect(bucket.totalTrades).toBe(0)
  })

  it('overallWinRate is null when no resolved trades', () => {
    const report = buildConfidenceCalibrationReport([])
    expect(report.overallWinRate).toBeNull()
  })

  it('overallWinRate counts all resolved trades across buckets', () => {
    const records = [
      makeRecord('tp_hit', 9.0),
      makeRecord('sl_hit', 5.0),
      makeRecord('sl_hit', 7.0),
    ]
    const report = buildConfidenceCalibrationReport(records)
    expect(report.overallWinRate).toBeCloseTo(1 / 3, 4)
  })

  it('note mentions insufficient data when no resolved trades', () => {
    const report = buildConfidenceCalibrationReport([])
    expect(report.note.toLowerCase()).toContain('insufficient')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Trust Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTrustValidationReport', () => {
  it('returns 3 tiers', () => {
    const report = buildTrustValidationReport([])
    expect(report.tiers).toHaveLength(3)
  })

  it('places record in correct tier', () => {
    const records = [makeRecord('tp_hit', 7.0, 85)]
    const report = buildTrustValidationReport(records)
    const tier = report.tiers.find(t => t.label === '>80%')!
    expect(tier.wins).toBe(1)
  })

  it('winRate is wins / resolved in tier', () => {
    const records = [
      makeRecord('tp_hit', 7.0, 70),
      makeRecord('sl_hit', 7.0, 75),
    ]
    const report = buildTrustValidationReport(records)
    const tier = report.tiers.find(t => t.label === '60-80%')!
    expect(tier.winRate).toBeCloseTo(0.5, 4)
  })

  it('note mentions insufficient data when no resolved tiers', () => {
    const report = buildTrustValidationReport([])
    expect(report.note.toLowerCase()).toContain('insufficient')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Report
// ─────────────────────────────────────────────────────────────────────────────

describe('buildEvidenceReport', () => {
  it('returns empty factors for empty records', () => {
    const report = buildEvidenceReport([])
    expect(report.factors).toHaveLength(0)
    expect(report.rankedByWinRate).toHaveLength(0)
    expect(report.weakSignals).toHaveLength(0)
  })

  it('counts a factor correctly across records', () => {
    const evFactor = { factor: 'RSI bullish', direction: 'bullish' as const }
    const records = [
      makeRecord('tp_hit', 7.0, 90, 'strong bullish', 'excellent', 2.5, [evFactor]),
      makeRecord('sl_hit', 7.0, 90, 'strong bullish', 'excellent', 2.5, [evFactor]),
    ]
    const report = buildEvidenceReport(records)
    const f = report.factors.find(f => f.factor === 'RSI bullish')!
    expect(f.timesEmitted).toBe(2)
    expect(f.wins).toBe(1)
    expect(f.losses).toBe(1)
    expect(f.winRate).toBeCloseTo(0.5, 4)
  })

  it('deduplicates the same factor within one snapshot', () => {
    const evFactor = { factor: 'RSI bullish', direction: 'bullish' as const }
    // Pipeline has the factor twice in evidence array — should be counted once per snapshot
    const pipeline = makePipeline(7.0, 90, 'strong bullish', 'excellent', 2.5, [evFactor, evFactor])
    const snapshot: ValidationSnapshot = {
      id: 'dup-test', symbol: 'BTCUSDT', interval: '1h',
      timestamp: 0, snapshotCandleIndex: 100,
      pipeline, direction: 'bullish',
    }
    const record: ValidationRecord = { snapshot, outcome: makeOutcome('tp_hit') }
    const report = buildEvidenceReport([record])
    const f = report.factors.find(f => f.factor === 'RSI bullish')!
    expect(f.timesEmitted).toBe(1) // deduplicated to 1
  })

  it('no_trade records still count evidence emissions but not in trade results', () => {
    const evFactor = { factor: 'MACD bullish', direction: 'bullish' as const }
    const records = [makeRecord('no_trade', 7.0, 90, 'strong bullish', 'excellent', 2.5, [evFactor])]
    const report = buildEvidenceReport(records)
    const f = report.factors.find(f => f.factor === 'MACD bullish')!
    expect(f.timesEmitted).toBe(1)
    expect(f.timesWithTrade).toBe(0)
  })

  it('rankedByWinRate sorts descending by win rate', () => {
    const records = [
      makeRecord('tp_hit', 7.0, 90, 'strong bullish', 'excellent', 2.5, [{ factor: 'A', direction: 'bullish' }]),
      makeRecord('sl_hit', 7.0, 90, 'strong bullish', 'excellent', 2.5, [{ factor: 'B', direction: 'bullish' }]),
    ]
    const report = buildEvidenceReport(records)
    // A has winRate=1.0, B has winRate=0.0
    expect(report.rankedByWinRate[0].factor).toBe('A')
    expect(report.rankedByWinRate[1].factor).toBe('B')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Trade Plan Report
// ─────────────────────────────────────────────────────────────────────────────

describe('buildTradePlanReport', () => {
  it('counts totals correctly', () => {
    const records = [
      makeRecord('tp_hit'),
      makeRecord('sl_hit'),
      makeRecord('neither'),
      makeRecord('no_trade'),
    ]
    const report = buildTradePlanReport(records)
    expect(report.totalSnapshots).toBe(4)
    expect(report.actionableCount).toBe(3)
    expect(report.tpHitCount).toBe(1)
    expect(report.slHitCount).toBe(1)
    expect(report.neitherCount).toBe(1)
    expect(report.noTradeCount).toBe(1)
  })

  it('win rate = tp_hit / (tp_hit + sl_hit)', () => {
    const records = [
      makeRecord('tp_hit'),
      makeRecord('tp_hit'),
      makeRecord('sl_hit'),
    ]
    const report = buildTradePlanReport(records)
    expect(report.overallWinRate).toBeCloseTo(2 / 3, 4)
  })

  it('win rate is null when no resolved trades', () => {
    const records = [makeRecord('neither'), makeRecord('no_trade')]
    const report = buildTradePlanReport(records)
    expect(report.overallWinRate).toBeNull()
  })

  it('byQuality groups records correctly', () => {
    const records = [
      makeRecord('tp_hit', 7.0, 90, 'strong bullish', 'excellent'),
      makeRecord('sl_hit', 7.0, 90, 'strong bullish', 'excellent'),
      makeRecord('tp_hit', 5.5, 90, 'strong bullish', 'good'),
    ]
    const report = buildTradePlanReport(records)
    const excellent = report.byQuality.find(q => q.quality === 'excellent')!
    const good      = report.byQuality.find(q => q.quality === 'good')!
    expect(excellent.count).toBe(2)
    expect(excellent.winRate).toBeCloseTo(0.5, 4)
    expect(good.count).toBe(1)
    expect(good.winRate).toBeCloseTo(1.0, 4)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Post Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPostValidationReport', () => {
  it('all invariants pass for a clean actionable record', () => {
    const records = [makeRecord('tp_hit', 7.5, 90, 'strong bullish', 'excellent')]
    const report = buildPostValidationReport(records)
    expect(report.totalChecked).toBe(1)
    expect(report.allPassCount).toBe(1)
    expect(report.failCount).toBe(0)
    expect(report.results[0].allPass).toBe(true)
  })

  it('all invariants pass for a no_trade record (not actionable)', () => {
    const records = [makeRecord('no_trade', 4.0, 90, 'ranging', 'no_setup', null)]
    const report = buildPostValidationReport(records)
    expect(report.results[0].allPass).toBe(true)
  })

  it('checks bias for bullish trend', () => {
    const records = [makeRecord('tp_hit', 7.5, 90, 'strong bullish', 'excellent')]
    const report = buildPostValidationReport(records)
    const biasCheck = report.results[0].checks.find(c => c.field === 'bias')!
    expect(biasCheck.matched).toBe(true)
    expect(biasCheck.expected).toBe('bullish')
  })

  it('checks bias for bearish trend', () => {
    const records = [makeRecord('sl_hit', 7.5, 90, 'strong bearish', 'excellent')]
    const report = buildPostValidationReport(records)
    const biasCheck = report.results[0].checks.find(c => c.field === 'bias')!
    expect(biasCheck.expected).toBe('bearish')
  })

  it('evidenceCoverage check always passes (always 100)', () => {
    const records = [makeRecord('tp_hit')]
    const report = buildPostValidationReport(records)
    const coverageCheck = report.results[0].checks.find(c => c.field === 'evidenceCoverage')!
    expect(coverageCheck.matched).toBe(true)
  })

  it('blockReason consistency check passes when publishable', () => {
    const records = [makeRecord('tp_hit', 7.5, 90, 'strong bullish', 'excellent')]
    const report = buildPostValidationReport(records)
    const blockCheck = report.results[0].checks.find(c => c.field === 'blockReason_null_iff_publishable')!
    expect(blockCheck.matched).toBe(true)
  })
})
