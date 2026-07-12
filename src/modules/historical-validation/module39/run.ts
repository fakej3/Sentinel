/**
 * Module 39 — Trade Intelligence Lab runner.
 *
 * Reuses the same synthetic multi-regime dataset as Module 38,
 * then layers multi-label attribution, filter simulation, feature
 * importance, combination analysis, and improvement candidates on top.
 */
import { writeFileSync } from 'node:fs'
import type { Timeframe } from '../../binance/types'
import { walkCandles } from '../walk'
import { SYMBOLS, TIMEFRAMES, generateMultiRegimeCandles } from '../module38/scenarios'
import type { ValidationRecord } from '../types'
import type { TradeIntelligenceReport } from './types'
import { LOSS_REASON_LABELS, WIN_REASON_LABELS } from './types'
import { attributeRecords } from './attribution'
import { simulateFilters } from './filters'
import { computeFeatureImportance } from './importance'
import { findCombinations } from './combinations'
import { deriveImprovementCandidates } from './candidates'
import { generateTradeIntelligenceReport } from './report'

export interface Module39Output {
  report: TradeIntelligenceReport
  html:   string
}

// ── Loss / win distribution helpers ──────────────────────────────────────────

function lossDistribution(
  records: ReturnType<typeof attributeRecords>,
): TradeIntelligenceReport['lossAttribution'] {
  const counts = new Map<string, number>()
  let totalLosses = 0
  for (const ar of records) {
    if (ar.record.outcome.result !== 'sl_hit') continue
    totalLosses++
    for (const r of ar.lossReasons) {
      counts.set(r, (counts.get(r) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason: reason as keyof typeof LOSS_REASON_LABELS,
      label: LOSS_REASON_LABELS[reason as keyof typeof LOSS_REASON_LABELS] ?? reason,
      count,
      pct: totalLosses > 0 ? count / totalLosses : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function winDistribution(
  records: ReturnType<typeof attributeRecords>,
): TradeIntelligenceReport['winAttribution'] {
  const counts = new Map<string, number>()
  let totalWins = 0
  for (const ar of records) {
    if (ar.record.outcome.result !== 'tp_hit') continue
    totalWins++
    for (const r of ar.winReasons) {
      counts.set(r, (counts.get(r) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason: reason as keyof typeof WIN_REASON_LABELS,
      label: WIN_REASON_LABELS[reason as keyof typeof WIN_REASON_LABELS] ?? reason,
      count,
      pct: totalWins > 0 ? count / totalWins : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runModule39(options?: {
  outputPath?: string
  stepSize?: number
  forwardLookBars?: number
  minCandleCount?: number
  verbose?: boolean
}): Promise<Module39Output> {
  const {
    outputPath,
    stepSize        = 10,
    forwardLookBars = 20,
    minCandleCount  = 50,
    verbose         = false,
  } = options ?? {}

  // ── Collect raw validation records ─────────────────────────────────────────
  const allRecords: ValidationRecord[] = []
  const total = SYMBOLS.length * TIMEFRAMES.length
  let n = 0

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES as Timeframe[]) {
      n++
      if (verbose) process.stdout.write(`  [${String(n).padStart(2,'0')}/${total}] ${symbol} ${timeframe} ... `)

      const candles = generateMultiRegimeCandles(symbol, timeframe)
      const records = await walkCandles(symbol, timeframe, candles, {
        minCandleCount,
        stepSize,
        forwardLookBars,
      })

      allRecords.push(...records)

      if (verbose) {
        const act    = records.filter(r => r.outcome.result !== 'no_trade')
        const wins   = act.filter(r => r.outcome.result === 'tp_hit').length
        const losses = act.filter(r => r.outcome.result === 'sl_hit').length
        const wr     = wins + losses > 0 ? (wins / (wins + losses) * 100).toFixed(1) : 'n/a'
        console.log(`${records.length} snapshots, ${act.length} trades, WR=${wr}%`)
      }
    }
  }

  if (verbose) console.log(`\nTotal records: ${allRecords.length}`)

  // ── Attribution ────────────────────────────────────────────────────────────
  if (verbose) process.stdout.write('Attributing records ... ')
  const attributed = attributeRecords(allRecords)
  if (verbose) console.log('done')

  // ── Aggregate counts ───────────────────────────────────────────────────────
  const actionable = allRecords.filter(r => r.outcome.result !== 'no_trade')
  const wins       = allRecords.filter(r => r.outcome.result === 'tp_hit')
  const losses     = allRecords.filter(r => r.outcome.result === 'sl_hit')
  const neither    = allRecords.filter(r => r.outcome.result === 'neither')
  const resolved   = wins.length + losses.length
  const winRate    = resolved > 0 ? wins.length / resolved : null

  const setupRRs   = actionable
    .map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio)
    .filter((v): v is number => v !== null)
  const avgSetupRR = setupRRs.length > 0 ? setupRRs.reduce((s, v) => s + v, 0) / setupRRs.length : null
  const overallExpectancy = winRate !== null && avgSetupRR !== null
    ? winRate * avgSetupRR - (1 - winRate) * 1.0
    : null

  // ── Analysis modules ────────────────────────────────────────────────────────
  if (verbose) process.stdout.write('Running filter simulation ... ')
  const filterSimulations = simulateFilters(attributed)
  if (verbose) console.log('done')

  if (verbose) process.stdout.write('Computing feature importance ... ')
  const featureImportance = computeFeatureImportance(attributed)
  if (verbose) console.log('done')

  if (verbose) process.stdout.write('Analysing combinations ... ')
  const { badCombinations, goodCombinations } = findCombinations(attributed)
  if (verbose) console.log(`done (${badCombinations.length} bad, ${goodCombinations.length} good)`)

  if (verbose) process.stdout.write('Deriving improvement candidates ... ')
  const improvementCandidates = deriveImprovementCandidates(attributed)
  if (verbose) console.log(`done (${improvementCandidates.length} candidates)`)

  // ── Build report ───────────────────────────────────────────────────────────
  const report: TradeIntelligenceReport = {
    totalRecords:         allRecords.length,
    actionableCount:      actionable.length,
    winCount:             wins.length,
    lossCount:            losses.length,
    neitherCount:         neither.length,
    overallWinRate:       winRate,
    overallExpectancy,
    lossAttribution:      lossDistribution(attributed),
    winAttribution:       winDistribution(attributed),
    filterSimulations,
    featureImportance,
    badCombinations,
    goodCombinations,
    improvementCandidates,
  }

  const html = generateTradeIntelligenceReport(report)

  if (outputPath) {
    writeFileSync(outputPath, html, 'utf-8')
    if (verbose) console.log(`Report written to: ${outputPath}`)
  }

  return { report, html }
}
