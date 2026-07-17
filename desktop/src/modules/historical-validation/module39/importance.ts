/**
 * Module 39 — Feature importance ranking.
 *
 * Measures how predictive each engine signal is by comparing win rates
 * between trades where the feature is "active" vs "inactive".
 *
 * Importance score = lift × log(n_active + 1)
 *   lift = win_rate_active / win_rate_inactive   (bounded to [0, 50])
 *
 * Only uses resolved trades (tp_hit or sl_hit).
 */
import type { AttributedRecord, FeatureImportanceRow } from './types'

// ── Feature definitions ───────────────────────────────────────────────────────

interface FeatureDef {
  feature: string
  label: string
  /** Returns true when the feature is in its "positive / bullish-for-trade" state */
  active: (ar: AttributedRecord) => boolean
}

const FEATURES: FeatureDef[] = [
  {
    feature: 'confidence_high',
    label: 'Confidence ≥ 7',
    active: ar => ar.record.snapshot.pipeline.confidence.score >= 7,
  },
  {
    feature: 'confidence_very_high',
    label: 'Confidence ≥ 8.5 (very strong)',
    active: ar => ar.record.snapshot.pipeline.confidence.score >= 8.5,
  },
  {
    feature: 'trust_positive',
    label: 'Trust: Aggressive/Conservative entry',
    active: ar => {
      const v = ar.record.snapshot.pipeline.traderReview.verdict
      return v === 'Aggressive Buy' || v === 'Conservative Buy' ||
             v === 'Aggressive Sell' || v === 'Conservative Sell'
    },
  },
  {
    feature: 'trend_strong',
    label: 'Trend: Strong (bullish or bearish)',
    active: ar => ar.record.snapshot.pipeline.analysis.fullTrend.trend.includes('strong'),
  },
  {
    feature: 'trend_not_ranging',
    label: 'Trend: Not ranging',
    active: ar => ar.record.snapshot.pipeline.analysis.fullTrend.trend !== 'ranging',
  },
  {
    feature: 'ema_aligned',
    label: 'EMA: Stack aligned with direction',
    active: ar => {
      const { direction } = ar.record.snapshot
      const e = ar.record.snapshot.pipeline.analysis.emaContext.emaAlignment
      return (direction === 'bullish' && e === 'bullish_stack') ||
             (direction === 'bearish' && e === 'bearish_stack')
    },
  },
  {
    feature: 'structure_strong',
    label: 'Market Structure: Strong',
    active: ar => ar.record.snapshot.pipeline.marketStructure.strength === 'strong',
  },
  {
    feature: 'bos_detected',
    label: 'Break of Structure detected',
    active: ar => ar.record.snapshot.pipeline.marketStructure.bos.detected,
  },
  {
    feature: 'choch_detected',
    label: 'Change of Character detected',
    active: ar => ar.record.snapshot.pipeline.marketStructure.choch.detected,
  },
  {
    feature: 'rsi_favorable',
    label: 'RSI: Favorable classification for direction',
    active: ar => {
      const { direction } = ar.record.snapshot
      const rsic = ar.record.snapshot.pipeline.analysis.indicatorSummary.rsi.classification
      return (direction === 'bullish' && (rsic === 'healthy_bullish' || rsic === 'oversold')) ||
             (direction === 'bearish' && (rsic === 'weak_bearish' || rsic === 'overbought'))
    },
  },
  {
    feature: 'macd_aligned',
    label: 'MACD: Bias aligned with direction',
    active: ar => {
      const { direction } = ar.record.snapshot
      const b = ar.record.snapshot.pipeline.analysis.indicatorSummary.macd.bias
      return (direction === 'bullish' && b === 'bullish') ||
             (direction === 'bearish' && b === 'bearish')
    },
  },
  {
    feature: 'adx_strong',
    label: 'ADX: Strong or very strong trend',
    active: ar => {
      const s = ar.record.snapshot.pipeline.analysis.indicatorSummary.adx.trendStrength
      return s === 'strong' || s === 'very_strong' || s === 'extreme'
    },
  },
  {
    feature: 'volume_confirms',
    label: 'Volume confirms current move',
    active: ar => ar.record.snapshot.pipeline.analysis.volumeContext.confirmsCurrentMove,
  },
  {
    feature: 'high_rel_volume',
    label: 'Relative volume ≥ 1.3×',
    active: ar => ar.record.snapshot.pipeline.analysis.volumeContext.relativeVolume >= 1.3,
  },
  {
    feature: 'obv_confirming',
    label: 'OBV confirming price direction',
    active: ar => ar.record.snapshot.pipeline.analysis.volumeContext.obvConfirmingPrice,
  },
  {
    feature: 'sr_zone_active',
    label: 'S/R: Inside or approaching relevant zone',
    active: ar => {
      const { direction } = ar.record.snapshot
      const sr = ar.record.snapshot.pipeline.analysis.srContext
      return (direction === 'bullish' && (sr.insideSupport || sr.approachingSupport)) ||
             (direction === 'bearish' && (sr.insideResistance || sr.approachingResistance))
    },
  },
  {
    feature: 'good_rr',
    label: 'Planned R:R ≥ 2.0',
    active: ar => {
      const rr = ar.record.snapshot.pipeline.tradePlan.riskRewardRatio
      return rr !== null && rr >= 2.0
    },
  },
  {
    feature: 'excellent_opportunity',
    label: 'Opportunity: Excellent',
    active: ar => ar.record.snapshot.pipeline.opportunityAssessment.tradingOpportunity === 'excellent',
  },
  {
    feature: 'no_contradictions',
    label: 'No major contradictions (severity = none)',
    active: ar => ar.record.snapshot.pipeline.contradictionIntelligence.overallSeverity === 'none',
  },
  {
    feature: 'breakout_confirmed',
    label: 'Breakout structure confirmed',
    active: ar => ar.record.snapshot.pipeline.marketStructure.breakout.confirmed,
  },
]

// ── Computation ───────────────────────────────────────────────────────────────

function winRate(resolved: AttributedRecord[]): number | null {
  const wins   = resolved.filter(r => r.record.outcome.result === 'tp_hit').length
  const losses = resolved.filter(r => r.record.outcome.result === 'sl_hit').length
  const total  = wins + losses
  return total > 0 ? wins / total : null
}

export function computeFeatureImportance(records: AttributedRecord[]): FeatureImportanceRow[] {
  const resolved = records.filter(
    r => r.record.outcome.result === 'tp_hit' || r.record.outcome.result === 'sl_hit',
  )

  return FEATURES.map(({ feature, label, active }) => {
    const pos = resolved.filter(r =>  active(r))
    const neg = resolved.filter(r => !active(r))

    const wrPos = winRate(pos)
    const wrNeg = winRate(neg)

    const lift = (wrPos !== null && wrNeg !== null && wrNeg > 0)
      ? Math.min(50, wrPos / wrNeg)
      : null

    const importanceScore = lift !== null
      ? lift * Math.log(pos.length + 1)
      : 0

    return {
      feature,
      label,
      winRateActive:   wrPos,
      nActive:         pos.length,
      winRateInactive: wrNeg,
      nInactive:       neg.length,
      lift,
      importanceScore,
    }
  }).sort((a, b) => b.importanceScore - a.importanceScore)
}
