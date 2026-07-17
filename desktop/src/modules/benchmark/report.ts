import type { BenchmarkResult } from './types'

export function generateReport(result: BenchmarkResult): string {
  const { symbol, interval, metrics, comparisons, passed, score, summary } = result
  const lines: string[] = []

  lines.push(`# Benchmark Report — ${symbol} / ${interval}`)
  lines.push('')
  lines.push(`**Status:** ${passed ? 'PASS ✓' : 'FAIL ✗'}`)
  lines.push(`**Score:** ${score.toFixed(1)} / 100`)
  lines.push(`**Accuracy:** ${metrics.accuracy.toFixed(1)}%`)
  lines.push(
    `**Fields:** ${metrics.passedFields} passed` +
    ` / ${metrics.failedFields} failed` +
    ` / ${metrics.missingFields} missing` +
    ` / ${metrics.extraFields} extra` +
    ` / ${metrics.totalFields} total`,
  )
  lines.push(`**Replay time:** ${metrics.timings.replayTime}ms`)
  lines.push(`**Compare time:** ${metrics.timings.compareTime}ms`)
  lines.push(`**Total time:** ${metrics.timings.totalTime}ms`)
  lines.push('')
  lines.push(`**Summary:** ${summary}`)

  const failures = comparisons.filter(c => c.status !== 'PASS')
  if (failures.length > 0) {
    lines.push('')
    lines.push('## Differences')
    lines.push('')
    for (const f of failures) {
      lines.push(`### \`${f.field}\` — ${f.status}`)
      if (f.message) {
        lines.push(`> ${f.message}`)
      }
      if (f.status !== 'MISSING') {
        lines.push(`- **Expected:** \`${JSON.stringify(f.expected)}\``)
        lines.push(`- **Actual:**   \`${JSON.stringify(f.actual)}\``)
      } else {
        lines.push('- Field path not found in pipeline output.')
      }
      lines.push('')
    }
  } else {
    lines.push('')
    lines.push('All compared fields match expected output.')
  }

  return lines.join('\n')
}
