/**
 * Module 38 CLI entry point.
 * Run with: node_modules/.bin/tsx src/modules/historical-validation/module38/bin.ts
 */
import { resolve } from 'node:path'
import { runModule38 } from './run.js'

const outPath = resolve(process.cwd(), 'module38-report.html')
console.log('Module 38 — Ground Truth Validation')
console.log('10 symbols × 3 timeframes × synthetic multi-regime candles\n')

runModule38({ outputPath: outPath, verbose: true }).then(({ metrics }) => {
  const { overall, productionReadinessScore: score, productionReadinessVerdict } = metrics
  console.log('\n═══ Summary ═══')
  console.log(`Snapshots     : ${overall.totalSnapshots}`)
  console.log(`Actionable    : ${overall.actionableCount} (${(overall.signalRate * 100).toFixed(0)}%)`)
  console.log(`Win Rate      : ${overall.winRate !== null ? (overall.winRate * 100).toFixed(1) + '%' : 'n/a'}`)
  console.log(`Expectancy    : ${overall.expectancy !== null ? overall.expectancy.toFixed(2) + 'R' : 'n/a'}`)
  console.log(`Score         : ${score}/100`)
  console.log(`Verdict       : ${productionReadinessVerdict}`)
  console.log(`\nReport written to: ${outPath}`)
}).catch(err => {
  console.error('Module 38 failed:', err)
  process.exit(1)
})
