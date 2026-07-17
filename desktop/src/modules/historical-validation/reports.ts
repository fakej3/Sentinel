import type {
  ValidationRecord,
  ConfidenceCalibrationReport,
  ConfidenceBucket,
  TrustValidationReport,
  TrustTier,
  EvidenceReport,
  EvidenceFactorStats,
  TradePlanReport,
  PostValidationReport,
  PostValidationResult,
  PostTraceabilityCheck,
} from './types'
import { buildBinancePost } from '../writer/binance-post'
import type { BinancePostInput } from '../writer/binance-post'
import type { TradeSetupQuality } from '../pipeline/types'
import { avg, avgOrNull } from './math'

// ── Confidence Calibration ────────────────────────────────────────────────────

const CONFIDENCE_BUCKETS: Array<{ label: string; lower: number; upper: number }> = [
  { label: '9-10', lower: 9,  upper: 10 },
  { label: '8-9',  lower: 8,  upper: 9  },
  { label: '7-8',  lower: 7,  upper: 8  },
  { label: '6-7',  lower: 6,  upper: 7  },
  { label: '5-6',  lower: 5,  upper: 6  },
  { label: '4-5',  lower: 4,  upper: 5  },
  { label: '3-4',  lower: 3,  upper: 4  },
  { label: '2-3',  lower: 2,  upper: 3  },
  { label: '1-2',  lower: 1,  upper: 2  },
  { label: '0-1',  lower: 0,  upper: 1  },
]

export function buildConfidenceCalibrationReport(
  records: ValidationRecord[],
): ConfidenceCalibrationReport {
  const buckets: ConfidenceBucket[] = CONFIDENCE_BUCKETS.map(({ label, lower, upper }) => {
    // upper bound is exclusive except for the 9-10 bucket (score can be exactly 10)
    const inBucket = records.filter(r => {
      const s = r.snapshot.pipeline.confidence.score
      return upper === 10 ? s >= lower && s <= upper : s >= lower && s < upper
    })

    const trades       = inBucket.filter(r => r.outcome.result !== 'no_trade')
    const wins         = trades.filter(r => r.outcome.result === 'tp_hit')
    const losses       = trades.filter(r => r.outcome.result === 'sl_hit')
    const inconclusive = trades.filter(r => r.outcome.result === 'neither')
    const resolved     = wins.length + losses.length

    const winRRs  = wins.map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio ?? 0)
    const mfeVals = trades.map(r => r.outcome.mfe)
    const maeVals = trades.map(r => r.outcome.mae)

    return {
      label,
      lowerBound:      lower,
      upperBound:      upper,
      totalTrades:     trades.length,
      wins:            wins.length,
      losses:          losses.length,
      inconclusiveCount: inconclusive.length,
      winRate:         resolved > 0 ? wins.length / resolved : null,
      averageRR:       avgOrNull(winRRs),
      averageMAE:      avg(maeVals),
      averageMFE:      avg(mfeVals),
    }
  })

  const allTrades  = records.filter(r => r.outcome.result !== 'no_trade')
  const allWins    = allTrades.filter(r => r.outcome.result === 'tp_hit').length
  const allLosses  = allTrades.filter(r => r.outcome.result === 'sl_hit').length
  const allResolved = allWins + allLosses
  const overallWinRate   = allResolved > 0 ? allWins / allResolved : null
  const overallAverageRR = avgOrNull(
    allTrades.filter(r => r.outcome.result === 'tp_hit')
      .map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio ?? 0),
  )

  // Correlation check: do buckets with higher confidence have higher win rates?
  const resolvedBuckets = buckets.filter(b => b.winRate !== null && b.totalTrades >= 3)
  let confidenceCorrelatesWithWins = false
  if (resolvedBuckets.length >= 2) {
    const sorted = [...resolvedBuckets].sort((a, b) => a.lowerBound - b.lowerBound)
    let risingPairs = 0
    for (let i = 0; i < sorted.length - 1; i++) {
      if ((sorted[i + 1].winRate ?? 0) > (sorted[i].winRate ?? 0)) risingPairs++
    }
    confidenceCorrelatesWithWins = risingPairs / (sorted.length - 1) >= 0.6
  }

  const note = overallWinRate === null
    ? 'Insufficient resolved trades to assess confidence calibration.'
    : confidenceCorrelatesWithWins
    ? 'Higher confidence scores correlate with higher win rates — calibration looks healthy.'
    : 'Confidence score does not consistently predict win rate — review confidence weighting.'

  return { buckets, overallWinRate, overallAverageRR, confidenceCorrelatesWithWins, note }
}

// ── Trust Validation ──────────────────────────────────────────────────────────

const TRUST_TIERS: Array<{ label: string; lower: number; upper: number }> = [
  { label: '>80%',   lower: 80,  upper: 101 },
  { label: '60-80%', lower: 60,  upper: 80  },
  { label: '<60%',   lower: 0,   upper: 60  },
]

export function buildTrustValidationReport(records: ValidationRecord[]): TrustValidationReport {
  const tiers: TrustTier[] = TRUST_TIERS.map(({ label, lower, upper }) => {
    const inTier   = records.filter(r => {
      const t = r.snapshot.pipeline.confidence.trust.score
      return t >= lower && t < upper
    })
    const trades   = inTier.filter(r => r.outcome.result !== 'no_trade')
    const wins     = trades.filter(r => r.outcome.result === 'tp_hit').length
    const losses   = trades.filter(r => r.outcome.result === 'sl_hit').length
    const resolved = wins + losses

    return {
      label,
      lowerBound: lower,
      upperBound: upper,
      totalTrades: trades.length,
      wins,
      losses,
      winRate: resolved > 0 ? wins / resolved : null,
    }
  })

  const resolvedTiers = tiers.filter(t => t.winRate !== null && t.totalTrades >= 3)
  let trustCorrelatesWithWins = false
  if (resolvedTiers.length >= 2) {
    const sorted = [...resolvedTiers].sort((a, b) => a.lowerBound - b.lowerBound)
    let ascending = true
    for (let i = 0; i < sorted.length - 1; i++) {
      if ((sorted[i + 1].winRate ?? 0) <= (sorted[i].winRate ?? 0)) {
        ascending = false
        break
      }
    }
    trustCorrelatesWithWins = ascending
  }

  const note = resolvedTiers.length < 2
    ? 'Insufficient data across trust tiers to assess correlation.'
    : trustCorrelatesWithWins
    ? 'Higher trust scores correlate with higher win rates — trust scoring is predictive.'
    : 'Trust score does not consistently predict win rate — review trust weighting.'

  return { tiers, trustCorrelatesWithWins, note }
}

// ── Evidence Report ───────────────────────────────────────────────────────────

export function buildEvidenceReport(records: ValidationRecord[]): EvidenceReport {
  // key = "factorName::direction"
  type FactorEntry = {
    direction: 'bullish' | 'bearish' | 'neutral'
    emitCount: number
    tradeRecords: ValidationRecord[]
  }
  const factorMap = new Map<string, FactorEntry>()

  for (const record of records) {
    const evidence = record.snapshot.pipeline.analysis.evidence
    const seen = new Set<string>()

    for (const ev of evidence) {
      const key = `${ev.factor}::${ev.direction}`
      if (seen.has(key)) continue
      seen.add(key)

      if (!factorMap.has(key)) {
        factorMap.set(key, { direction: ev.direction, emitCount: 0, tradeRecords: [] })
      }
      const entry = factorMap.get(key)!
      entry.emitCount++
      if (record.outcome.result !== 'no_trade') {
        entry.tradeRecords.push(record)
      }
    }
  }

  const factors: EvidenceFactorStats[] = []
  for (const [key, data] of factorMap) {
    const factorName = key.split('::')[0]
    const trades     = data.tradeRecords
    const wins       = trades.filter(r => r.outcome.result === 'tp_hit').length
    const losses     = trades.filter(r => r.outcome.result === 'sl_hit').length
    const resolved   = wins + losses

    const winRRs = trades
      .filter(r => r.outcome.result === 'tp_hit')
      .map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio ?? 0)

    factors.push({
      factor:          factorName,
      direction:       data.direction,
      timesEmitted:    data.emitCount,
      timesWithTrade:  trades.length,
      wins,
      losses,
      winRate:         resolved > 0 ? wins / resolved : null,
      averageRR:       avgOrNull(winRRs),
      falsePositiveRate: resolved > 0 ? losses / resolved : null,
    })
  }

  const rankedByWinRate = factors
    .filter(f => f.winRate !== null)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))

  const weakSignals = factors.filter(f =>
    f.falsePositiveRate !== null
    && f.falsePositiveRate > 0.5
    && f.timesWithTrade >= 5,
  )

  return { factors, rankedByWinRate, weakSignals }
}

// ── Trade Plan Report ─────────────────────────────────────────────────────────

const ALL_QUALITIES: TradeSetupQuality[] = [
  'excellent', 'good', 'average', 'poor', 'avoid', 'no_setup',
]

export function buildTradePlanReport(records: ValidationRecord[]): TradePlanReport {
  const noTradeRecords   = records.filter(r => r.outcome.result === 'no_trade')
  const actionable       = records.filter(r => r.outcome.result !== 'no_trade')
  const tpHits           = actionable.filter(r => r.outcome.result === 'tp_hit')
  const slHits           = actionable.filter(r => r.outcome.result === 'sl_hit')
  const neither          = actionable.filter(r => r.outcome.result === 'neither')
  const resolved         = tpHits.length + slHits.length

  const setupRRs     = actionable.map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio).filter((v): v is number => v !== null)
  const achievedRRs  = actionable.map(r => r.outcome.actualRR).filter((v): v is number => v !== null)
  const maes         = actionable.map(r => r.outcome.mae)
  const mfes         = actionable.map(r => r.outcome.mfe)
  const bars         = actionable.map(r => r.outcome.barsToOutcome).filter((v): v is number => v !== null)

  const byQuality = ALL_QUALITIES
    .map(q => {
      const qRecs    = actionable.filter(r => r.snapshot.pipeline.tradePlan.setupQuality === q)
      const qWins    = qRecs.filter(r => r.outcome.result === 'tp_hit').length
      const qLosses  = qRecs.filter(r => r.outcome.result === 'sl_hit').length
      const qResolved = qWins + qLosses
      const qRRs     = qRecs
        .filter(r => r.outcome.result === 'tp_hit')
        .map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio ?? 0)
      return {
        quality:   q,
        count:     qRecs.length,
        wins:      qWins,
        losses:    qLosses,
        winRate:   qResolved > 0 ? qWins / qResolved : null,
        averageRR: avgOrNull(qRRs),
      }
    })
    .filter(q => q.count > 0)

  return {
    totalSnapshots:      records.length,
    actionableCount:     actionable.length,
    tpHitCount:          tpHits.length,
    slHitCount:          slHits.length,
    neitherCount:        neither.length,
    noTradeCount:        noTradeRecords.length,
    tpHitRate:           actionable.length > 0 ? tpHits.length / actionable.length : null,
    slHitRate:           actionable.length > 0 ? slHits.length / actionable.length : null,
    overallWinRate:      resolved > 0 ? tpHits.length / resolved : null,
    averageSetupRR:      avgOrNull(setupRRs),
    averageAchievedRR:   avgOrNull(achievedRRs),
    averageMAE:          avg(maes),
    averageMFE:          avg(mfes),
    averageBarsToOutcome: avgOrNull(bars),
    byQuality,
  }
}

// ── Post Validation ───────────────────────────────────────────────────────────

/**
 * Verify every BinancePost produced from a ValidationRecord's pipeline output
 * is internally consistent with the underlying pipeline values.
 *
 * Checks are structural invariants only — we are not parsing free text:
 *   1. bias matches trend direction
 *   2. confidenceScore matches confidence.score
 *   3. evidenceCoverage === 100
 *   4. publishable === (actionable && no critical validation issues)
 *   5. blockReason is null iff publishable
 */
export function buildPostValidationReport(records: ValidationRecord[]): PostValidationReport {
  const results: PostValidationResult[] = []

  for (const record of records) {
    const { pipeline } = record.snapshot
    const { analysis, validation, confidence, tradePlan, invalidationScenarios } = pipeline

    const input: BinancePostInput = {
      analysis,
      validation,
      confidence,
      tradePlan,
      invalidationScenarios,
    }
    const post = buildBinancePost(input)
    const checks: PostTraceabilityCheck[] = []

    // 1. Bias matches trend direction
    const expectedBias: 'bullish' | 'bearish' | 'neutral' =
      analysis.fullTrend.trend.includes('bullish') ? 'bullish'
      : analysis.fullTrend.trend.includes('bearish') ? 'bearish'
      : 'neutral'
    checks.push({
      field:    'bias',
      expected: expectedBias,
      matched:  post.bias === expectedBias,
    })

    // 2. Confidence score matches
    checks.push({
      field:    'confidenceScore',
      expected: confidence.score,
      matched:  Math.abs(post.confidenceScore - confidence.score) < 0.001,
    })

    // 3. Evidence coverage is always 100
    checks.push({
      field:    'evidenceCoverage',
      expected: 100,
      matched:  post.evidenceCoverage === 100,
    })

    // 4. Publishable = actionable AND no critical validation issues
    const expectedPublishable = tradePlan.actionable && validation.criticalCount === 0
    checks.push({
      field:    'publishable',
      expected: expectedPublishable,
      matched:  post.publishable === expectedPublishable,
      note:     'publishable = tradePlan.actionable && validation.criticalCount === 0',
    })

    // 5. blockReason is null iff publishable
    checks.push({
      field:    'blockReason_null_iff_publishable',
      expected: post.publishable ? null : 'non-null string',
      matched:  post.publishable === (post.blockReason === null),
    })

    const failCount = checks.filter(c => !c.matched).length

    results.push({
      snapshotId:  record.snapshot.id,
      publishable: post.publishable,
      bias:        post.bias,
      checks,
      allPass:     failCount === 0,
      failCount,
    })
  }

  const allPassCount = results.filter(r => r.allPass).length
  return {
    totalChecked: results.length,
    allPassCount,
    failCount: results.length - allPassCount,
    results,
  }
}
