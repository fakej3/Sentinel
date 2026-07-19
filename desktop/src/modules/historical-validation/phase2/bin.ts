/**
 * Phase 2 CLI entry point.
 * Run with:
 *   node_modules/.bin/tsx src/modules/historical-validation/phase2/bin.ts
 */
import { resolve } from 'node:path'
import { runPhase2 } from './run.js'

const outPath = resolve(process.cwd(), 'phase2-report.html')

console.log('Sentinel Phase 2 — Professional Trading Validation')
console.log('15 symbols × 4 timeframes × synthetic multi-regime candles\n')

runPhase2({ outputPath: outPath, verbose: true }).then(({ metrics, phase4, phase5, phase6 }) => {
  const { overall, productionReadinessScore: score, productionReadinessVerdict } = metrics

  console.log('\n═══ Executive Summary ═════════════════════════════════')
  console.log(`Snapshots  : ${overall.totalSnapshots}`)
  console.log(`Actionable : ${overall.actionableCount} (${(overall.signalRate * 100).toFixed(0)}%)`)
  console.log(`Win Rate   : ${overall.winRate !== null ? (overall.winRate * 100).toFixed(1) + '%' : 'n/a'}`)
  console.log(`Expectancy : ${overall.expectancy !== null ? overall.expectancy.toFixed(3) + 'R' : 'n/a'}`)
  console.log(`Score      : ${score}/100`)
  console.log(`Verdict    : ${productionReadinessVerdict}`)

  console.log('\n═══ Phase 4 Weaknesses ════════════════════════════════')
  if (phase4.weaknesses.length === 0) {
    console.log('  None identified')
  } else {
    for (const w of phase4.weaknesses) {
      console.log(`  [${w.severity.toUpperCase().padEnd(8)}] ${w.description}`)
      console.log(`               ${w.evidence}`)
    }
  }

  console.log('\n═══ Phase 5 Pro Trader Summary ════════════════════════')
  const proWR = phase5.proGradeSetups.winRate
  const allWR = phase5.allSetups.winRate
  console.log(`  All setups   : ${allWR !== null ? (allWR * 100).toFixed(1) + '%' : 'n/a'} WR (${phase5.allSetups.total} trades)`)
  console.log(`  Pro-grade    : ${proWR !== null ? (proWR * 100).toFixed(1) + '%' : 'n/a'} WR (${phase5.proGradeSetups.total} trades)`)
  console.log(`  Entry score  : ${phase5.entryQuality.score}/100`)
  console.log(`  Stop score   : ${phase5.stopQuality.score}/100`)
  console.log(`  Target score : ${phase5.targetQuality.score}/100`)
  for (const insight of phase5.proInsights) {
    console.log(`  › ${insight}`)
  }

  console.log('\n═══ Phase 6 Proposals ════════════════════════════════')
  if (phase6.proposals.length === 0) {
    console.log('  None — engine meets threshold')
  } else {
    for (const p of phase6.proposals) {
      console.log(`  [${p.priority.toUpperCase().padEnd(6)}] ${p.id}: ${p.title}`)
    }
  }

  console.log(`\nReport written to: ${outPath}`)
}).catch(err => {
  console.error('Phase 2 failed:', err)
  process.exit(1)
})
