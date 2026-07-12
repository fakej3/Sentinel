/**
 * Module 39 — Filter simulator.
 *
 * Defines 16 candidate filters and simulates each one's impact on
 * expectancy, win rate, and average RR. Only resolves against actionable
 * records (tp_hit / sl_hit / neither).
 *
 * Optimization target: EXPECTANCY, not win rate.
 * E = win_rate × avg_setup_rr − (1 − win_rate) × 1.0
 */
import type { AttributedRecord, FilterDef, FilterId, FilterSimulationResult, FilterStats } from './types'

// ── Filter definitions ────────────────────────────────────────────────────────

export const FILTERS: FilterDef[] = [
  {
    id: 'low_confidence',
    label: 'Ignore Low Confidence',
    description: 'Exclude trades where confidence score < 4.5',
    keep: ar => ar.record.snapshot.pipeline.confidence.score >= 4.5,
  },
  {
    id: 'weak_trend',
    label: 'Ignore Weak Trend',
    description: 'Exclude trades where trend is weak or ranging',
    keep: ar => {
      const t = ar.record.snapshot.pipeline.analysis.fullTrend.trend
      return !t.includes('weak') && t !== 'ranging'
    },
  },
  {
    id: 'low_volume',
    label: 'Ignore Low Volume',
    description: 'Exclude trades where relative volume < 0.7',
    keep: ar => ar.record.snapshot.pipeline.analysis.volumeContext.relativeVolume >= 0.7,
  },
  {
    id: 'low_trust',
    label: 'Ignore Low Trust',
    description: "Exclude trades where trader review is 'Wait', 'Avoid', or 'Reduce Position'",
    keep: ar => {
      const v = ar.record.snapshot.pipeline.traderReview.verdict
      return v !== 'Wait' && v !== 'Avoid' && v !== 'Reduce Position'
    },
  },
  {
    id: 'counter_trend',
    label: 'Ignore Counter Trend',
    description: 'Exclude trades where direction opposes the dominant trend',
    keep: ar => {
      const { direction } = ar.record.snapshot
      const t = ar.record.snapshot.pipeline.analysis.fullTrend.trend
      if (direction === 'bullish' && t.includes('bearish')) return false
      if (direction === 'bearish' && t.includes('bullish')) return false
      return true
    },
  },
  {
    id: 'mtf_conflict',
    label: 'Ignore MTF Conflict',
    description: 'Exclude trades with major contradictions or sanity issues',
    keep: ar => {
      const { contradictionIntelligence, sanityAudit } = ar.record.snapshot.pipeline
      return contradictionIntelligence.overallSeverity !== 'major' && !sanityAudit.hasIssues
    },
  },
  {
    id: 'poor_rr',
    label: 'Ignore Poor R:R',
    description: 'Exclude trades where planned RR < 1.5',
    keep: ar => {
      const rr = ar.record.snapshot.pipeline.tradePlan.riskRewardRatio
      return rr === null || rr >= 1.5
    },
  },
  {
    id: 'weak_structure',
    label: 'Ignore Weak Structure',
    description: 'Exclude trades where market structure strength is weak with low confidence',
    keep: ar => {
      const ms = ar.record.snapshot.pipeline.marketStructure
      return !(ms.strength === 'weak' && ms.confidence < 40)
    },
  },
  {
    id: 'weak_ema',
    label: 'Ignore Weak EMA',
    description: 'Exclude trades where EMA alignment opposes direction',
    keep: ar => {
      const { direction } = ar.record.snapshot
      const ema = ar.record.snapshot.pipeline.analysis.emaContext.emaAlignment
      if (direction === 'bullish' && (ema === 'bearish_stack' || ema === 'unavailable')) return false
      if (direction === 'bearish' && (ema === 'bullish_stack' || ema === 'unavailable')) return false
      return true
    },
  },
  {
    id: 'range',
    label: 'Ignore Range',
    description: "Exclude trades taken when market trend is 'ranging'",
    keep: ar => ar.record.snapshot.pipeline.analysis.fullTrend.trend !== 'ranging',
  },
  {
    id: 'no_bos',
    label: 'Ignore No BOS',
    description: 'Exclude trades where no Break of Structure was detected',
    keep: ar => ar.record.snapshot.pipeline.marketStructure.bos.detected,
  },
  {
    id: 'weak_momentum',
    label: 'Ignore Weak Momentum',
    description: 'Exclude trades where RSI or MACD opposes direction',
    keep: ar => {
      const { direction } = ar.record.snapshot
      const { rsi, macd } = ar.record.snapshot.pipeline.analysis.indicatorSummary
      const rsic  = rsi.classification
      const macdb = macd.bias
      if (direction === 'bullish' && (rsic === 'overbought' || macdb === 'bearish')) return false
      if (direction === 'bearish' && (rsic === 'oversold'   || macdb === 'bullish')) return false
      return true
    },
  },
  {
    id: 'high_volatility',
    label: 'Ignore High Volatility',
    description: 'Exclude trades where ATR% > 3.5 (unpredictable whipsaw conditions)',
    keep: ar => {
      const atr = ar.record.snapshot.pipeline.indicators.atrPercent
      return atr === null || atr <= 3.5
    },
  },
  {
    id: 'low_volatility',
    label: 'Ignore Low Volatility',
    description: 'Exclude trades where ATR% < 0.5 (insufficient movement)',
    keep: ar => {
      const atr = ar.record.snapshot.pipeline.indicators.atrPercent
      return atr === null || atr >= 0.5
    },
  },
  {
    id: 'poor_setup',
    label: 'Ignore Poor Setup',
    description: "Exclude trades where setup quality is 'poor' or 'avoid'",
    keep: ar => {
      const q = ar.record.snapshot.pipeline.tradePlan.setupQuality
      return q !== 'poor' && q !== 'avoid'
    },
  },
  {
    id: 'sanity_issues',
    label: 'Ignore Sanity Issues',
    description: 'Exclude trades where the confidence sanity audit flagged issues',
    keep: ar => !ar.record.snapshot.pipeline.sanityAudit.hasIssues,
  },
]

// ── Stats computation ─────────────────────────────────────────────────────────

function avgOrNull(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null
}

function computeStats(records: AttributedRecord[]): FilterStats {
  const actionable = records.filter(r => r.record.outcome.result !== 'no_trade')
  const wins       = actionable.filter(r => r.record.outcome.result === 'tp_hit')
  const losses     = actionable.filter(r => r.record.outcome.result === 'sl_hit')
  const neither    = actionable.filter(r => r.record.outcome.result === 'neither')
  const resolved   = wins.length + losses.length

  const setupRRs = actionable.map(r => r.record.snapshot.pipeline.tradePlan.riskRewardRatio)
    .filter((v): v is number => v !== null)
  const avgSetupRR = avgOrNull(setupRRs)
  const winRate    = resolved > 0 ? wins.length / resolved : null
  const expectancy = winRate !== null && avgSetupRR !== null
    ? winRate * avgSetupRR - (1 - winRate) * 1.0
    : null

  return {
    totalRecords:    records.length,
    actionableCount: actionable.length,
    winCount:        wins.length,
    lossCount:       losses.length,
    neitherCount:    neither.length,
    winRate,
    avgSetupRR,
    expectancy,
  }
}

// ── Simulator ─────────────────────────────────────────────────────────────────

export function simulateFilters(records: AttributedRecord[]): FilterSimulationResult[] {
  const before = computeStats(records)

  return FILTERS.map(f => {
    const kept  = records.filter(r => f.keep(r))
    const after = computeStats(kept)

    // Count wins/losses removed (only resolved actionable trades)
    const removed    = records.filter(r => !f.keep(r) && r.record.outcome.result !== 'no_trade')
    const winsRemoved   = removed.filter(r => r.record.outcome.result === 'tp_hit').length
    const lossesRemoved = removed.filter(r => r.record.outcome.result === 'sl_hit').length
    const totalRemoved  = winsRemoved + lossesRemoved
    const selectivity   = totalRemoved > 0 ? lossesRemoved / totalRemoved : null

    const expectancyDelta = (after.expectancy !== null && before.expectancy !== null)
      ? after.expectancy - before.expectancy
      : null

    const improvesExpectancy = (
      expectancyDelta !== null && expectancyDelta > 0 &&
      lossesRemoved > winsRemoved
    )

    return {
      filterId:            f.id,
      label:               f.label,
      description:         f.description,
      before,
      after,
      winsRemoved,
      lossesRemoved,
      selectivity,
      expectancyDelta,
      improvesExpectancy,
    }
  })
}
