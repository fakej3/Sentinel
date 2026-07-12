#!/usr/bin/env node
/**
 * Module 39 — CLI entry point.
 * Usage: node_modules/.bin/tsx src/modules/historical-validation/module39/bin.ts [--out <path>] [-v]
 */
import { runModule39 } from './run'

const args  = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outputPath = outIdx !== -1 ? args[outIdx + 1] : 'module39-report.html'
const verbose = args.includes('-v') || args.includes('--verbose')

console.log('Module 39 — Trade Intelligence Lab')
console.log('=====================================')

runModule39({ outputPath, verbose }).then(({ report }) => {
  const r = report
  console.log(`\nResults:`)
  console.log(`  Records:    ${r.totalRecords}`)
  console.log(`  Actionable: ${r.actionableCount}`)
  console.log(`  Wins:       ${r.winCount}`)
  console.log(`  Losses:     ${r.lossCount}`)
  console.log(`  Win Rate:   ${r.overallWinRate !== null ? (r.overallWinRate * 100).toFixed(1) + '%' : '—'}`)
  console.log(`  Expectancy: ${r.overallExpectancy !== null ? r.overallExpectancy.toFixed(3) + 'R' : '—'}`)
  console.log(`  Candidates: ${r.improvementCandidates.length} filter(s) recommended`)
  console.log(`\nReport written to: ${outputPath}`)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
