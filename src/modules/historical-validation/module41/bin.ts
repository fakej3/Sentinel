/**
 * Module 41 CLI entry point.
 *
 * Usage (from repo root):
 *   npx ts-node src/modules/historical-validation/module41/bin.ts [output.html]
 */
import { runModule41 } from './run'

const outputPath = process.argv[2] ?? 'module41-report.html'

runModule41({ outputPath, verbose: true }).catch((err: unknown) => {
  console.error('Module 41 failed:', err)
  process.exit(1)
})
