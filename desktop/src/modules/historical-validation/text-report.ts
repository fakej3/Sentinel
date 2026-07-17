import type { CalibrationDashboard } from './types'

function pct(value: number | null): string {
  if (value === null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

function num(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A'
  return value.toFixed(decimals)
}

/**
 * Generate a human-readable markdown report from a CalibrationDashboard.
 * All numbers are taken directly from the dashboard — nothing is fabricated.
 */
export function generateTextReport(dashboard: CalibrationDashboard): string {
  const { overall, confidence, trust, evidence, tradePlan, postValidation } = dashboard
  const lines: string[] = []

  lines.push(`# Sentinel Calibration Report — ${dashboard.symbol} / ${dashboard.interval}`)
  lines.push(`Generated: ${new Date(dashboard.generatedAt).toISOString()}`)
  lines.push(`Candles analyzed: ${dashboard.totalCandlesAnalyzed}`)
  lines.push(`Snapshots: ${overall.totalSnapshots}`)
  lines.push('')

  // ── Overall stats ──────────────────────────────────────────────────────────
  lines.push('## Overall Statistics')
  lines.push(`- Actionable trades: ${overall.actionableTradeCount}`)
  lines.push(`- Wins (TP hit): ${overall.winCount}`)
  lines.push(`- Losses (SL hit): ${overall.lossCount}`)
  lines.push(`- Inconclusive (neither): ${overall.inconclusiveCount}`)
  lines.push(`- Win rate (resolved): ${pct(overall.winRate)}`)
  lines.push(`- Average setup RR: ${num(overall.averageSetupRR)}`)
  lines.push(`- Average achieved RR: ${num(overall.averageAchievedRR)}`)
  lines.push(`- Average MAE: ${num(overall.averageMAE)}`)
  lines.push(`- Average MFE: ${num(overall.averageMFE)}`)
  lines.push('')

  // ── Confidence calibration ─────────────────────────────────────────────────
  lines.push('## Confidence Calibration')
  lines.push(confidence.note)
  lines.push('')

  const activeBuckets = confidence.buckets.filter(b => b.totalTrades > 0)
  if (activeBuckets.length > 0) {
    lines.push('| Confidence | Trades | Wins | Losses | Win Rate | Avg RR | Avg MAE | Avg MFE |')
    lines.push('|-----------|--------|------|--------|----------|--------|---------|---------|')
    for (const b of activeBuckets) {
      lines.push(
        `| ${b.label} | ${b.totalTrades} | ${b.wins} | ${b.losses} | ${pct(b.winRate)} | ${num(b.averageRR)} | ${num(b.averageMAE)} | ${num(b.averageMFE)} |`,
      )
    }
  } else {
    lines.push('No trades with resolved outcomes.')
  }
  lines.push('')

  // ── Trust validation ───────────────────────────────────────────────────────
  lines.push('## Trust Validation')
  lines.push(trust.note)
  lines.push('')

  const activeTiers = trust.tiers.filter(t => t.totalTrades > 0)
  if (activeTiers.length > 0) {
    lines.push('| Trust Tier | Trades | Wins | Losses | Win Rate |')
    lines.push('|-----------|--------|------|--------|----------|')
    for (const t of activeTiers) {
      lines.push(`| ${t.label} | ${t.totalTrades} | ${t.wins} | ${t.losses} | ${pct(t.winRate)} |`)
    }
  } else {
    lines.push('No trades with resolved outcomes.')
  }
  lines.push('')

  // ── Evidence ranking ───────────────────────────────────────────────────────
  lines.push('## Evidence Factor Ranking')

  if (evidence.rankedByWinRate.length === 0) {
    lines.push('No evidence factors with resolved trade outcomes.')
  } else {
    lines.push('| Factor | Direction | Emitted | Trades | Win Rate | Avg RR | FP Rate |')
    lines.push('|--------|-----------|---------|--------|----------|--------|---------|')
    for (const f of evidence.rankedByWinRate.slice(0, 20)) {
      lines.push(
        `| ${f.factor} | ${f.direction} | ${f.timesEmitted} | ${f.timesWithTrade} | ${pct(f.winRate)} | ${num(f.averageRR)} | ${pct(f.falsePositiveRate)} |`,
      )
    }
  }
  lines.push('')

  if (evidence.weakSignals.length > 0) {
    lines.push('### Weak Signals (FP rate > 50%, ≥5 trades)')
    for (const f of evidence.weakSignals) {
      lines.push(`- **${f.factor}** (${f.direction}): FP rate ${pct(f.falsePositiveRate)}, ${f.timesWithTrade} trades`)
    }
    lines.push('')
  }

  // ── Trade plan stats ───────────────────────────────────────────────────────
  lines.push('## Trade Plan Statistics')
  lines.push(`- Total snapshots: ${tradePlan.totalSnapshots}`)
  lines.push(`- Actionable: ${tradePlan.actionableCount}`)
  lines.push(`- TP hit: ${tradePlan.tpHitCount} (${pct(tradePlan.tpHitRate)})`)
  lines.push(`- SL hit: ${tradePlan.slHitCount} (${pct(tradePlan.slHitRate)})`)
  lines.push(`- Neither: ${tradePlan.neitherCount}`)
  lines.push(`- No trade: ${tradePlan.noTradeCount}`)
  lines.push(`- Win rate (resolved): ${pct(tradePlan.overallWinRate)}`)
  lines.push(`- Avg setup RR: ${num(tradePlan.averageSetupRR)}`)
  lines.push(`- Avg achieved RR: ${num(tradePlan.averageAchievedRR)}`)
  lines.push(`- Avg MAE: ${num(tradePlan.averageMAE)}`)
  lines.push(`- Avg MFE: ${num(tradePlan.averageMFE)}`)
  lines.push(`- Avg bars to outcome: ${num(tradePlan.averageBarsToOutcome, 1)}`)
  lines.push('')

  if (tradePlan.byQuality.length > 0) {
    lines.push('### By Setup Quality')
    lines.push('| Quality | Count | Wins | Losses | Win Rate | Avg RR |')
    lines.push('|---------|-------|------|--------|----------|--------|')
    for (const q of tradePlan.byQuality) {
      lines.push(`| ${q.quality} | ${q.count} | ${q.wins} | ${q.losses} | ${pct(q.winRate)} | ${num(q.averageRR)} |`)
    }
    lines.push('')
  }

  // ── Post validation ────────────────────────────────────────────────────────
  lines.push('## Binance Post Validation (Traceability)')
  lines.push(`- Total checked: ${postValidation.totalChecked}`)
  lines.push(`- All pass: ${postValidation.allPassCount}`)
  lines.push(`- Failures: ${postValidation.failCount}`)

  if (postValidation.failCount > 0) {
    lines.push('')
    lines.push('### Failed Checks')
    for (const result of postValidation.results) {
      if (!result.allPass) {
        lines.push(`**Snapshot ${result.snapshotId}:**`)
        for (const check of result.checks) {
          if (!check.matched) {
            lines.push(`  - ${check.field}: expected \`${JSON.stringify(check.expected)}\` — FAILED`)
          }
        }
      }
    }
  }
  lines.push('')

  // ── Phase analysis ─────────────────────────────────────────────────────────
  if (dashboard.topPerformingPhases.length > 0) {
    lines.push('## Market Phase Analysis')
    lines.push(`Top performing phases: ${dashboard.topPerformingPhases.join(', ')}`)
    if (dashboard.worstPerformingPhases.length > 0) {
      lines.push(`Worst performing phases: ${dashboard.worstPerformingPhases.join(', ')}`)
    }
    lines.push('')
  }

  if (dashboard.mostCommonFailureReasons.length > 0) {
    lines.push('## Most Common Failure Reasons (from invalidation scenarios on SL hits)')
    for (const r of dashboard.mostCommonFailureReasons) {
      lines.push(`- ${r}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
