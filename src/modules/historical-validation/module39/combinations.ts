/**
 * Module 39 — Combination analysis.
 *
 * Finds 2-way and 3-way signal combinations that consistently lose or win.
 * Only resolved trades (tp_hit / sl_hit) are analysed.
 * Results are sorted by win rate (bad = ascending, good = descending).
 */
import type { AttributedRecord, FeatureCombination } from './types'

// ── Signal definitions ────────────────────────────────────────────────────────

interface SignalDef {
  key: string
  label: string
  test: (ar: AttributedRecord) => boolean
}

const NEGATIVE_SIGNALS: SignalDef[] = [
  {
    key: 'low_trust',
    label: 'Low Trust',
    test: ar => {
      const v = ar.record.snapshot.pipeline.traderReview.verdict
      return v === 'Wait' || v === 'Avoid' || v === 'Reduce Position'
    },
  },
  {
    key: 'mtf_conflict',
    label: 'MTF Conflict',
    test: ar => {
      const { contradictionIntelligence, sanityAudit } = ar.record.snapshot.pipeline
      return contradictionIntelligence.overallSeverity === 'major' || sanityAudit.hasIssues
    },
  },
  {
    key: 'weak_volume',
    label: 'Weak Volume',
    test: ar => ar.record.snapshot.pipeline.analysis.volumeContext.overallStrength <= 3,
  },
  {
    key: 'weak_trend',
    label: 'Weak Trend',
    test: ar => {
      const t = ar.record.snapshot.pipeline.analysis.fullTrend.trend
      return t.includes('weak') || t === 'ranging'
    },
  },
  {
    key: 'counter_trend',
    label: 'Counter Trend',
    test: ar => {
      const { direction } = ar.record.snapshot
      const t = ar.record.snapshot.pipeline.analysis.fullTrend.trend
      return (direction === 'bullish' && t.includes('bearish')) ||
             (direction === 'bearish' && t.includes('bullish'))
    },
  },
  {
    key: 'weak_ema',
    label: 'Weak EMA',
    test: ar => {
      const { direction } = ar.record.snapshot
      const ema = ar.record.snapshot.pipeline.analysis.emaContext.emaAlignment
      return (direction === 'bullish' && (ema === 'bearish_stack' || ema === 'unavailable')) ||
             (direction === 'bearish' && (ema === 'bullish_stack'  || ema === 'unavailable'))
    },
  },
  {
    key: 'low_confidence',
    label: 'Low Confidence',
    test: ar => ar.record.snapshot.pipeline.confidence.score < 4.5,
  },
  {
    key: 'poor_rr',
    label: 'Poor R:R',
    test: ar => {
      const rr = ar.record.snapshot.pipeline.tradePlan.riskRewardRatio
      return rr !== null && rr < 1.5
    },
  },
  {
    key: 'momentum_failure',
    label: 'Momentum Failure',
    test: ar => {
      const { direction } = ar.record.snapshot
      const rsic  = ar.record.snapshot.pipeline.analysis.indicatorSummary.rsi.classification
      const macdb = ar.record.snapshot.pipeline.analysis.indicatorSummary.macd.bias
      return (direction === 'bullish' && (rsic === 'overbought' || macdb === 'bearish')) ||
             (direction === 'bearish' && (rsic === 'oversold'   || macdb === 'bullish'))
    },
  },
]

const POSITIVE_SIGNALS: SignalDef[] = [
  {
    key: 'excellent_opportunity',
    label: 'Excellent Opportunity',
    test: ar => ar.record.snapshot.pipeline.opportunityAssessment.tradingOpportunity === 'excellent',
  },
  {
    key: 'high_trust',
    label: 'High Trust',
    test: ar => {
      const v = ar.record.snapshot.pipeline.traderReview.verdict
      return v === 'Aggressive Buy' || v === 'Conservative Buy' ||
             v === 'Aggressive Sell' || v === 'Conservative Sell'
    },
  },
  {
    key: 'aligned_mtf',
    label: 'Aligned MTF',
    test: ar => {
      const { contradictionIntelligence, sanityAudit } = ar.record.snapshot.pipeline
      return contradictionIntelligence.overallSeverity === 'none' && !sanityAudit.hasIssues
    },
  },
  {
    key: 'high_confidence',
    label: 'High Confidence',
    test: ar => ar.record.snapshot.pipeline.confidence.score >= 7,
  },
  {
    key: 'strong_trend',
    label: 'Strong Trend',
    test: ar => ar.record.snapshot.pipeline.analysis.fullTrend.trend.includes('strong'),
  },
  {
    key: 'perfect_ema',
    label: 'Perfect EMA',
    test: ar => {
      const { direction } = ar.record.snapshot
      const ema = ar.record.snapshot.pipeline.analysis.emaContext.emaAlignment
      return (direction === 'bullish' && ema === 'bullish_stack') ||
             (direction === 'bearish' && ema === 'bearish_stack')
    },
  },
  {
    key: 'strong_structure',
    label: 'Strong Structure + BOS',
    test: ar => {
      const ms = ar.record.snapshot.pipeline.marketStructure
      return ms.strength === 'strong' && ms.bos.detected
    },
  },
  {
    key: 'good_rr',
    label: 'Good R:R (≥ 2.5)',
    test: ar => {
      const rr = ar.record.snapshot.pipeline.tradePlan.riskRewardRatio
      return rr !== null && rr >= 2.5
    },
  },
  {
    key: 'strong_momentum',
    label: 'Strong Momentum',
    test: ar => {
      const { direction } = ar.record.snapshot
      const rsic  = ar.record.snapshot.pipeline.analysis.indicatorSummary.rsi.classification
      const macdb = ar.record.snapshot.pipeline.analysis.indicatorSummary.macd.bias
      return (direction === 'bullish' && (rsic === 'healthy_bullish' || rsic === 'oversold') && macdb === 'bullish') ||
             (direction === 'bearish' && (rsic === 'weak_bearish'    || rsic === 'overbought') && macdb === 'bearish')
    },
  },
]

// ── Combination engine ────────────────────────────────────────────────────────

const MIN_SAMPLE = 5

function buildCombos(
  signals: SignalDef[],
  maxArity: number,
): Array<SignalDef[]> {
  const combos: Array<SignalDef[]> = []

  // 2-way
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      combos.push([signals[i], signals[j]])
    }
  }

  // 3-way (only if maxArity ≥ 3)
  if (maxArity >= 3) {
    for (let i = 0; i < signals.length; i++) {
      for (let j = i + 1; j < signals.length; j++) {
        for (let k = j + 1; k < signals.length; k++) {
          combos.push([signals[i], signals[j], signals[k]])
        }
      }
    }
  }

  return combos
}

function evalCombo(
  resolved: AttributedRecord[],
  combo: SignalDef[],
): FeatureCombination | null {
  const matching = resolved.filter(ar => combo.every(s => s.test(ar)))
  if (matching.length < MIN_SAMPLE) return null

  const wins   = matching.filter(ar => ar.record.outcome.result === 'tp_hit').length
  const losses = matching.filter(ar => ar.record.outcome.result === 'sl_hit').length
  const total  = wins + losses
  if (total < MIN_SAMPLE) return null

  return {
    features: combo.map(s => s.key),
    labels:   combo.map(s => s.label),
    n:        total,
    wins,
    losses,
    winRate: wins / total,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CombinationAnalysis {
  badCombinations:  FeatureCombination[]
  goodCombinations: FeatureCombination[]
}

export function findCombinations(
  records: AttributedRecord[],
  maxArity = 3,
): CombinationAnalysis {
  const resolved = records.filter(
    r => r.record.outcome.result === 'tp_hit' || r.record.outcome.result === 'sl_hit',
  )

  const negCombos = buildCombos(NEGATIVE_SIGNALS, maxArity)
  const posCombos = buildCombos(POSITIVE_SIGNALS, maxArity)

  const bad = negCombos
    .map(c => evalCombo(resolved, c))
    .filter((c): c is FeatureCombination => c !== null && c.winRate < 0.40)
    .sort((a, b) => a.winRate - b.winRate)

  const good = posCombos
    .map(c => evalCombo(resolved, c))
    .filter((c): c is FeatureCombination => c !== null && c.winRate > 0.60)
    .sort((a, b) => b.winRate - a.winRate)

  return { badCombinations: bad, goodCombinations: good }
}
