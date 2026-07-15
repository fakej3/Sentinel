/**
 * Module 38 — Ground Truth Validation runner.
 *
 * Runs the full walk-forward validation across 10 symbols × 3 timeframes
 * using deterministic synthetic multi-regime candle data.
 * Produces extended metrics (loss categorization, expectancy, MTF agreement)
 * and an HTML production readiness report.
 *
 * Usage (from repo root):
 *   npx ts-node -e "require('./src/modules/historical-validation/module38/run').runModule38()"
 *
 * Or import and call from a test:
 *   import { runModule38 } from './run'
 *   const { metrics, html } = await runModule38()
 */
import { writeFileSync } from 'node:fs'
import type { Timeframe } from '../../market/types'
import type { CalibrationDashboard } from '../types'
import { walkCandles } from '../walk'
import { buildDashboard } from '../dashboard'
import { SYMBOLS, TIMEFRAMES, generateMultiRegimeCandles } from './scenarios'
import { computeExtendedMetrics } from './extended-metrics'
import type { DatasetResult, ExtendedMetrics } from './extended-metrics'
import { generateHtmlReport } from './report'

export interface Module38Output {
  results:    DatasetResult[]
  dashboards: CalibrationDashboard[]
  metrics:    ExtendedMetrics
  html:       string
}

/**
 * Run Module 38 validation.
 *
 * @param outputPath - If provided, write the HTML report to this path.
 * @param walkConfig - Optional overrides for the walk-forward config.
 */
export async function runModule38(options?: {
  outputPath?: string
  stepSize?: number
  forwardLookBars?: number
  minCandleCount?: number
  verbose?: boolean
}): Promise<Module38Output> {
  const {
    outputPath,
    stepSize        = 10,
    forwardLookBars = 20,
    minCandleCount  = 50,
    verbose         = false,
  } = options ?? {}

  const results: DatasetResult[] = []
  const dashboards: CalibrationDashboard[] = []

  const totalDatasets = SYMBOLS.length * TIMEFRAMES.length
  let processed = 0

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES as Timeframe[]) {
      if (verbose) {
        process.stdout.write(`  [${String(++processed).padStart(2,'0')}/${totalDatasets}] ${symbol} ${timeframe} ... `)
      } else {
        processed++
      }

      const candles = generateMultiRegimeCandles(symbol, timeframe)

      const records = await walkCandles(symbol, timeframe, candles, {
        minCandleCount,
        stepSize,
        forwardLookBars,
      })

      const dashboard = buildDashboard(records, symbol, timeframe, candles.length)

      results.push({ symbol, timeframe, records })
      dashboards.push(dashboard)

      if (verbose) {
        const act = records.filter(r => r.outcome.result !== 'no_trade')
        const wins = act.filter(r => r.outcome.result === 'tp_hit')
        const losses = act.filter(r => r.outcome.result === 'sl_hit')
        const wr = wins.length + losses.length > 0
          ? (wins.length / (wins.length + losses.length) * 100).toFixed(1)
          : 'n/a'
        console.log(`${records.length} snapshots, ${act.length} trades, win=${wr}%`)
      }
    }
  }

  const metrics = computeExtendedMetrics(results)
  const html    = generateHtmlReport(results, metrics, dashboards)

  if (outputPath) {
    writeFileSync(outputPath, html, 'utf-8')
    if (verbose) console.log(`\nReport written to: ${outputPath}`)
  }

  return { results, dashboards, metrics, html }
}

