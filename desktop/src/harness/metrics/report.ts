/**
 * Report rendering: JSON, CSV, Markdown.
 *
 * JSON is lossless and is the archive. CSV is one row per slice × horizon, for
 * anything outside this codebase. Markdown is for a human, and is the only one
 * of the three that makes editorial choices — which it states.
 *
 * ONE EDITORIAL CHOICE IS LOAD-BEARING: the "best" and "worst" sections rank
 * slices by measured performance and report the extremes. That is a selection
 * effect. With S slices searched, the top slice is high partly because it is
 * genuinely better and partly because it got lucky, and the expected gap
 * between the best of S noisy estimates and the truth grows with S. The
 * Markdown report therefore always prints how many slices were searched and a
 * rough noise scale, so the reader can discount accordingly. It does not
 * silently present the winner as a finding.
 */
import type { MetricsReport, SliceMetrics } from './types'

const NA = '—'

function f(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NA
  return v.toFixed(digits)
}

function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NA
  return `${(v * 100).toFixed(digits)}%`
}

// ── JSON ──────────────────────────────────────────────────────────────────────

export function toJson(report: MetricsReport): string {
  return JSON.stringify(report, null, 2) + '\n'
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function num(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '' : String(v)
}

/**
 * One row per slice × horizon. Absent metrics are EMPTY fields, never 0 —
 * the same rule the observation export follows, for the same reason.
 */
export function toCsv(report: MetricsReport): string {
  const header = [
    'dimension', 'slice', 'horizon_bars', 'n',
    // forced up/down
    'ud_accuracy', 'ud_precision', 'ud_recall', 'ud_f1', 'ud_balanced_accuracy', 'ud_mcc', 'ud_base_rate',
    // three-way
    'tw_accuracy', 'tw_balanced_accuracy', 'tw_macro_f1', 'tw_weighted_f1', 'tw_mcc',
    // directional
    'dir_n', 'dir_hit_rate',
    // probability
    'prob_n', 'brier', 'brier_skill', 'log_loss', 'roc_auc', 'ece', 'mce',
    // ranking
    'spearman_score_outcome', 'spearman_score_return', 'monotonic', 'monotonicity_breaks',
    // trading
    'trades', 'win_rate', 'expectancy_r', 'avg_win_r', 'avg_loss_r', 'payoff_ratio', 'profit_factor',
    'median_r', 'stdev_r', 'sharpe_per_trade', 'sortino_per_trade', 'max_drawdown_r', 'recovery_factor',
    'total_r', 'avg_return_pct', 'stop_touched_rate', 'target_touched_rate',
    'excluded_no_stop', 'excluded_no_direction', 'excluded_no_outcome', 'overlapping',
  ]

  const lines = [header.map(csvField).join(',')]
  for (const s of report.slices) {
    const row = [
      s.dimension, s.slice, String(s.horizonBars), String(s.n),
      num(s.binaryUpDown.accuracy), num(s.binaryUpDown.precision), num(s.binaryUpDown.recall),
      num(s.binaryUpDown.f1), num(s.binaryUpDown.balancedAccuracy), num(s.binaryUpDown.mcc), num(s.binaryUpDown.baseRate),
      num(s.threeWay.accuracy), num(s.threeWay.balancedAccuracy), num(s.threeWay.macroF1),
      num(s.threeWay.weightedF1), num(s.threeWay.mcc),
      String(s.directional.n), num(s.directional.accuracy),
      String(s.probability.n), num(s.probability.brier), num(s.probability.brierSkillScore),
      num(s.probability.logLoss), num(s.probability.rocAuc),
      num(s.probability.calibrationEqualWidth.ece), num(s.probability.calibrationEqualWidth.mce),
      num(s.ranking.spearmanScoreOutcome), num(s.ranking.spearmanScoreReturn),
      s.ranking.monotonic === null ? '' : String(s.ranking.monotonic),
      String(s.ranking.monotonicityBreaks.length),
      String(s.trading.n), num(s.trading.winRate), num(s.trading.expectancyR),
      num(s.trading.averageWinR), num(s.trading.averageLossR), num(s.trading.payoffRatio), num(s.trading.profitFactor),
      num(s.trading.medianR), num(s.trading.stdevR), num(s.trading.sharpePerTrade), num(s.trading.sortinoPerTrade),
      num(s.trading.maxDrawdownR), num(s.trading.recoveryFactor),
      num(s.trading.totalR), num(s.trading.averageReturnPct),
      num(s.trading.stopTouchedRate), num(s.trading.targetTouchedRate),
      String(s.trading.excludedNoStop), String(s.trading.excludedNoDirection), String(s.trading.excludedNoOutcome),
      String(s.trading.overlapping),
    ]
    lines.push(row.map(csvField).join(','))
  }
  return lines.join('\n') + '\n'
}

/** Calibration bins, long format: one row per slice × horizon × bin. */
export function calibrationCsv(report: MetricsReport): string {
  const header = ['dimension', 'slice', 'horizon_bars', 'method', 'bin_lower', 'bin_upper', 'n', 'mean_predicted', 'observed_frequency', 'hits']
  const lines = [header.join(',')]
  for (const s of report.slices) {
    for (const [method, cal] of [
      ['equal-width', s.probability.calibrationEqualWidth],
      ['quantile', s.probability.calibrationQuantile],
    ] as const) {
      for (const b of cal.bins) {
        lines.push([
          csvField(s.dimension), csvField(s.slice), String(s.horizonBars), method,
          String(b.lower), String(b.upper), String(b.n),
          num(b.meanPredicted), num(b.observedFrequency), String(b.hits),
        ].join(','))
      }
    }
  }
  return lines.join('\n') + '\n'
}

/** Confidence buckets, long format: one row per slice × horizon × bucket. */
export function bucketCsv(report: MetricsReport): string {
  const header = ['dimension', 'slice', 'horizon_bars', 'bucket', 'lower', 'upper', 'n', 'hit_rate', 'ci_lower', 'ci_upper', 'avg_return_pct', 'avg_r', 'mean_score']
  const lines = [header.join(',')]
  for (const s of report.slices) {
    for (const b of s.ranking.buckets) {
      lines.push([
        csvField(s.dimension), csvField(s.slice), String(s.horizonBars), csvField(b.label),
        String(b.lower), String(b.upper), String(b.n),
        num(b.hitRate), num(b.hitRateCI?.lower), num(b.hitRateCI?.upper),
        num(b.averageReturnPct), num(b.averageR), num(b.meanScore),
      ].join(','))
    }
  }
  return lines.join('\n') + '\n'
}

// ── Markdown ──────────────────────────────────────────────────────────────────

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const out = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`]
  for (const r of rows) out.push(`| ${r.join(' | ')} |`)
  return out.join('\n')
}

function pick(report: MetricsReport, dimension: string, horizon: number): SliceMetrics[] {
  return report.slices.filter(s => s.dimension === dimension && s.horizonBars === horizon)
}

function overall(report: MetricsReport, horizon: number): SliceMetrics | undefined {
  return report.slices.find(s => s.dimension === 'overall' && s.horizonBars === horizon)
}

const SLICE_HEADERS = [
  'slice', 'n', 'trades', 'hit rate', 'expectancy R', 'profit factor', 'Sharpe/trade', 'max DD (R)', 'ROC AUC', 'ECE',
] as const

function sliceRow(s: SliceMetrics): string[] {
  return [
    s.slice, String(s.n), String(s.trading.n),
    pct(s.directional.accuracy), f(s.trading.expectancyR), f(s.trading.profitFactor),
    f(s.trading.sharpePerTrade), f(s.trading.maxDrawdownR, 1),
    f(s.probability.rocAuc), f(s.probability.calibrationEqualWidth.ece),
  ]
}

/** Minimum trades before a slice is eligible for the best/worst ranking. */
export const MIN_TRADES_FOR_RANKING = 50

export function toMarkdown(report: MetricsReport): string {
  const out: string[] = []
  const h = report.horizons

  out.push('# Sentinel — measured performance')
  out.push('')
  out.push(`Source: \`${report.sourceName}\`  `)
  out.push(`Generated: ${report.generatedAt}  `)
  out.push(`Observations: ${report.totalObservations}  `)
  out.push(`Horizons: ${h.join(', ')} bars  `)
  out.push(`Confidence → probability mapping: ${report.predictionMapping}  `)
  out.push(`Forward windows overlap: **${report.overlapping ? 'yes' : 'no'}**`)
  out.push('')
  if (report.overlapping) {
    out.push('> Overlapping windows mean consecutive observations share bars. Counts are')
    out.push('> not independent samples: dispersion statistics (Sharpe, Sortino, max')
    out.push('> drawdown) are computed on dependent data and standard errors implied by')
    out.push('> `n` are optimistic. Annualisation is refused for this reason.')
    out.push('')
  }
  out.push('> All figures are **gross**: no fees, funding or slippage. Trades exit at the')
  out.push('> horizon, not at the plan\'s stop or target — MFE/MAE record the extremes but')
  out.push('> not their order, so a bracket exit cannot be resolved without assuming one.')
  out.push('')

  // ── Overall, per horizon ─────────────────────────────────────────────────
  out.push('## Overall summary')
  out.push('')
  out.push('Horizons are never aggregated: they have different base rates and different')
  out.push('noise levels, and a single blended number would describe neither.')
  out.push('')
  out.push(table(
    ['horizon', 'n', 'up base rate', 'up/down acc', 'up/down MCC', '3-way bal. acc', '3-way MCC', 'directional hit rate'],
    h.map(hb => {
      const s = overall(report, hb)
      if (s === undefined) return [String(hb), NA, NA, NA, NA, NA, NA, NA]
      return [
        `${hb} bars`, String(s.n), pct(s.binaryUpDown.baseRate),
        pct(s.binaryUpDown.accuracy), f(s.binaryUpDown.mcc),
        pct(s.threeWay.balancedAccuracy), f(s.threeWay.mcc),
        pct(s.directional.accuracy),
      ]
    }),
  ))
  out.push('')
  out.push('### Probability quality')
  out.push('')
  out.push('Brier skill is measured against always forecasting the base rate. A negative')
  out.push('value means the confidence score, read as a probability, is worse than a')
  out.push('constant. ROC AUC measures ranking only and is unaffected by miscalibration.')
  out.push('')
  out.push(table(
    ['horizon', 'n', 'Brier', 'Brier skill', 'log loss', 'ROC AUC', 'ECE (equal-width)', 'ECE (quantile)', 'MCE'],
    h.map(hb => {
      const s = overall(report, hb)
      if (s === undefined) return [String(hb), NA, NA, NA, NA, NA, NA, NA, NA]
      const p = s.probability
      return [
        `${hb} bars`, String(p.n), f(p.brier), f(p.brierSkillScore), f(p.logLoss), f(p.rocAuc),
        f(p.calibrationEqualWidth.ece), f(p.calibrationQuantile.ece), f(p.calibrationEqualWidth.mce),
      ]
    }),
  ))
  out.push('')
  out.push('### Trading')
  out.push('')
  out.push(table(
    ['horizon', 'trades', 'win rate', 'expectancy R', 'avg win R', 'avg loss R', 'payoff', 'profit factor', 'Sharpe/trade', 'Sortino/trade', 'max DD (R)', 'recovery'],
    h.map(hb => {
      const s = overall(report, hb)
      if (s === undefined) return [String(hb), ...Array(11).fill(NA)]
      const t = s.trading
      return [
        `${hb} bars`, String(t.n), pct(t.winRate), f(t.expectancyR), f(t.averageWinR), f(t.averageLossR),
        f(t.payoffRatio), f(t.profitFactor), f(t.sharpePerTrade), f(t.sortinoPerTrade),
        f(t.maxDrawdownR, 1), f(t.recoveryFactor),
      ]
    }),
  ))
  out.push('')

  // ── Confidence ───────────────────────────────────────────────────────────
  out.push('## Confidence validation')
  out.push('')
  out.push('Does a higher score mean a better outcome? Buckets are the engine\'s own grade')
  out.push('thresholds, so a break here is a break in a distinction the product shows the')
  out.push('user. Intervals are 95%, on the log-odds scale.')
  out.push('')
  for (const hb of h) {
    const s = overall(report, hb)
    if (s === undefined) continue
    out.push(`### ${hb} bars`)
    out.push('')
    out.push(table(
      ['grade bucket', 'n', 'hit rate', '95% CI', 'avg return', 'avg R', 'mean score'],
      s.ranking.buckets.map(b => [
        b.label, String(b.n), pct(b.hitRate),
        b.hitRateCI === null ? NA : `${pct(b.hitRateCI.lower)} – ${pct(b.hitRateCI.upper)}`,
        pct(b.averageReturnPct, 2), f(b.averageR), f(b.meanScore, 2),
      ]),
    ))
    out.push('')
    out.push(`Spearman(score, correct) = **${f(s.ranking.spearmanScoreOutcome)}**  `)
    out.push(`Spearman(score, return) = **${f(s.ranking.spearmanScoreReturn)}**  `)
    out.push(`Monotonic across eligible buckets (n ≥ ${s.ranking.minBucketCount}): **${s.ranking.monotonic === null ? 'not testable' : s.ranking.monotonic}**`)
    if (s.ranking.monotonicityBreaks.length > 0) {
      out.push('')
      out.push('Breaks:')
      for (const b of s.ranking.monotonicityBreaks) {
        out.push(`- \`${b.from}\` → \`${b.to}\`: hit rate falls by ${pct(b.drop)}`)
      }
    }
    out.push('')
    out.push('Reliability (equal-width bins, probability = mapped score):')
    out.push('')
    out.push(table(
      ['bin', 'n', 'mean predicted', 'observed', 'gap'],
      s.probability.calibrationEqualWidth.bins.filter(b => b.n > 0).map(b => [
        `[${b.lower.toFixed(2)}, ${b.upper.toFixed(2)})`, String(b.n),
        f(b.meanPredicted), f(b.observedFrequency),
        f(b.observedFrequency! - b.meanPredicted!),
      ]),
    ))
    out.push('')
  }

  // ── Per-dimension tables ────────────────────────────────────────────────
  const dimensions: Array<[string, string]> = [
    ['symbol', 'Per symbol'],
    ['timeframe', 'Per timeframe'],
    ['regime_structure', 'Regime — trending vs ranging'],
    ['regime_trend_strength', 'Regime — trend strength (ADX)'],
    ['regime_volatility', 'Regime — volatility'],
    ['regime_actionable', 'Regime — engine marked the setup actionable'],
    ['trend', 'Per trend label'],
    ['grade', 'Per confidence grade'],
    ['setup_quality', 'Per setup quality'],
    ['direction', 'Per direction'],
  ]
  for (const [dim, title] of dimensions) {
    const anyRows = report.slices.some(s => s.dimension === dim)
    if (!anyRows) continue
    out.push(`## ${title}`)
    out.push('')
    for (const hb of h) {
      const rows = pick(report, dim, hb)
      if (rows.length === 0) continue
      out.push(`**${hb} bars**`)
      out.push('')
      out.push(table(SLICE_HEADERS, rows.map(sliceRow)))
      out.push('')
    }
  }

  // ── Best / worst ─────────────────────────────────────────────────────────
  const eligible = report.slices.filter(
    s => s.dimension !== 'overall' && s.trading.n >= MIN_TRADES_FOR_RANKING && s.trading.expectancyR !== null,
  )
  out.push('## Best and worst performing areas')
  out.push('')
  out.push(`Ranked by expectancy in R, among ${eligible.length} slice × horizon combinations`)
  out.push(`with at least ${MIN_TRADES_FOR_RANKING} trades.`)
  out.push('')
  out.push('> **This ranking is a selection effect.** The top slice is high partly because')
  out.push('> it is better and partly because it was lucky, and searching more slices makes')
  out.push('> the gap wider. Read the extremes as hypotheses to test out of sample, not as')
  out.push('> findings. The per-trade standard deviation of R is shown so the reader can')
  out.push('> judge how much of each gap the sample size can support.')
  out.push('')
  const ranked = [...eligible].sort((a, b) => b.trading.expectancyR! - a.trading.expectancyR!)
  const extremeHeaders = ['dimension', 'slice', 'horizon', 'trades', 'expectancy R', 'SE of mean R', 'win rate', 'profit factor'] as const
  const extremeRow = (s: SliceMetrics): string[] => [
    s.dimension, s.slice, `${s.horizonBars}b`, String(s.trading.n),
    f(s.trading.expectancyR),
    s.trading.stdevR === null ? NA : f(s.trading.stdevR / Math.sqrt(s.trading.n)),
    pct(s.trading.winRate), f(s.trading.profitFactor),
  ]
  out.push('### Best')
  out.push('')
  out.push(table(extremeHeaders, ranked.slice(0, 10).map(extremeRow)))
  out.push('')
  out.push('### Worst')
  out.push('')
  out.push(table(extremeHeaders, ranked.slice(-10).reverse().map(extremeRow)))
  out.push('')

  return out.join('\n')
}
