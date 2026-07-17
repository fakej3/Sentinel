/**
 * Module 38 — Extended metrics beyond the base CalibrationDashboard.
 *
 * Computes:
 *   - Loss categorization (12 categories) for every sl_hit record
 *   - Precision, recall proxy, F1 approximation
 *   - Expectancy per dataset and aggregate
 *   - Per-regime win rates (from snapshot candle-index mapping)
 *   - MTF agreement analysis (cross-timeframe direction correlation per symbol)
 *   - Production readiness score (0-100) and verdict
 */
import type { ValidationRecord } from '../types'
import type { MarketRegime } from './scenarios'
import { getRegimeAtIndex } from './scenarios'
import { computeMTFAgreement } from '../../pipeline/compute/mtf-agreement'
import type { MTFTimeframeInput } from '../../pipeline/types'

// ── Loss categories ───────────────────────────────────────────────────────────

export type LossCategory =
  | 'normal_loss'
  | 'late_entry'
  | 'weak_trend'
  | 'false_breakout'
  | 'low_volume'
  | 'bad_rr'
  | 'support_resistance_failure'
  | 'unexpected_reversal'
  | 'news_event'
  | 'stop_too_tight'
  | 'target_unrealistic'
  | 'other'

export const LOSS_CATEGORY_LABELS: Record<LossCategory, string> = {
  normal_loss:                  'Normal Loss',
  late_entry:                   'Late Entry',
  weak_trend:                   'Weak Trend',
  false_breakout:               'False Breakout',
  low_volume:                   'Low Volume',
  bad_rr:                       'Bad R:R',
  support_resistance_failure:   'S/R Failure',
  unexpected_reversal:          'Unexpected Reversal',
  news_event:                   'News Event',
  stop_too_tight:               'Stop Too Tight',
  target_unrealistic:           'Target Unrealistic',
  other:                        'Other',
}

export function categorizeLoss(record: ValidationRecord): LossCategory {
  const { snapshot, outcome } = record
  const { pipeline } = snapshot
  const { tradePlan, analysis, confidence } = pipeline
  const { volumeContext, srContext, fullTrend, marketStructure } = analysis
  const { entryPrice, stopPrice, targetPrice, mae, mfe, barsToOutcome } = outcome

  // low_volume: primary signal quality issue
  if (volumeContext.relativeVolume < 0.7) return 'low_volume'

  // bad_rr: setup never warranted the risk
  if (tradePlan.riskRewardRatio !== null && tradePlan.riskRewardRatio < 1.5) return 'bad_rr'

  // false_breakout: confirmed breakout that failed quickly
  if (
    marketStructure.breakout.confirmed &&
    barsToOutcome !== null &&
    barsToOutcome <= 6
  ) return 'false_breakout'

  // weak_trend: confidence or trend was marginal
  if (
    confidence.score < 4.5 ||
    fullTrend.trend.includes('weak') ||
    fullTrend.trend === 'ranging'
  ) return 'weak_trend'

  // stop_too_tight: stop was less than 0.5% from entry
  if (
    entryPrice !== null && stopPrice !== null &&
    Math.abs(entryPrice - stopPrice) / entryPrice < 0.005
  ) return 'stop_too_tight'

  // unexpected_reversal: price made it 50%+ toward target then reversed
  if (
    entryPrice !== null && targetPrice !== null &&
    mfe > 0 &&
    mfe / Math.max(1e-12, Math.abs(targetPrice - entryPrice)) > 0.5
  ) return 'unexpected_reversal'

  // late_entry: adverse move was > 1.8× the stop distance from the start
  if (
    entryPrice !== null && stopPrice !== null &&
    mae > Math.abs(entryPrice - stopPrice) * 1.8
  ) return 'late_entry'

  // support_resistance_failure: entered near a zone that gave way
  if (snapshot.direction === 'bullish' && (srContext.insideSupport || srContext.approachingSupport))
    return 'support_resistance_failure'
  if (snapshot.direction === 'bearish' && (srContext.insideResistance || srContext.approachingResistance))
    return 'support_resistance_failure'

  // target_unrealistic: price barely moved toward target (< 20% coverage)
  if (
    entryPrice !== null && targetPrice !== null &&
    mfe / Math.max(1e-12, Math.abs(targetPrice - entryPrice)) < 0.2
  ) return 'target_unrealistic'

  return 'normal_loss'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DatasetResult {
  symbol: string
  timeframe: string
  records: ValidationRecord[]
}

export interface DatasetSummary {
  symbol: string
  timeframe: string
  totalSnapshots: number
  actionableCount: number
  winCount: number
  lossCount: number
  neitherCount: number
  noTradeCount: number
  winRate: number | null
  avgSetupRR: number | null
  avgAchievedRR: number | null
  expectancy: number | null
  signalRate: number
}

export interface LossCategoryRow {
  category: LossCategory
  label: string
  count: number
  pct: number
}

export interface RegimeStats {
  regime: MarketRegime
  label: string
  totalSnapshots: number
  actionableCount: number
  winCount: number
  lossCount: number
  winRate: number | null
}

export interface MtfBin {
  symbol: string
  positionBin: number // 0-9 (decile)
  directions: Array<'bullish' | 'bearish' | 'neutral'>
  grades: Array<MTFTimeframeInput['grade']>
  scores: number[]
  outcomes: Array<'tp_hit' | 'sl_hit' | 'neither' | 'no_trade'>
}

export interface MtfAgreementStats {
  agreement: string
  count: number
  wins: number
  losses: number
  winRate: number | null
}

export interface ExtendedMetrics {
  overall: {
    totalSnapshots: number
    actionableCount: number
    winCount: number
    lossCount: number
    neitherCount: number
    winRate: number | null
    avgSetupRR: number | null
    avgAchievedRR: number | null
    expectancy: number | null
    signalRate: number
    precision: number | null
    f1Approx: number | null
  }
  datasets: DatasetSummary[]
  lossCategoryBreakdown: LossCategoryRow[]
  regimeStats: RegimeStats[]
  mtfAgreementStats: MtfAgreementStats[]
  productionReadinessScore: number
  productionReadinessVerdict: string
  productionReadinessDetails: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avgOrNull(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null
}

function computeExpectancy(winRate: number | null, avgRR: number | null): number | null {
  if (winRate === null || avgRR === null) return null
  const lossRate = 1 - winRate
  return winRate * avgRR - lossRate * 1.0
}

const REGIME_LABELS: Record<MarketRegime, string> = {
  range:           'Ranging / Sideways',
  bull:            'Bull Trend',
  distribution:    'Distribution (Topping)',
  high_volatility: 'High Volatility',
  bear:            'Bear Trend',
  low_volatility:  'Low Volatility',
  accumulation:    'Accumulation (Bottoming)',
  breakout:        'Breakout',
  reversal:        'Reversal',
}

// ── Core computation ──────────────────────────────────────────────────────────

function summarizeDataset(symbol: string, timeframe: string, records: ValidationRecord[]): DatasetSummary {
  const actionable = records.filter(r => r.outcome.result !== 'no_trade')
  const wins       = actionable.filter(r => r.outcome.result === 'tp_hit')
  const losses     = actionable.filter(r => r.outcome.result === 'sl_hit')
  const neither    = actionable.filter(r => r.outcome.result === 'neither')
  const resolved   = wins.length + losses.length

  const setupRRs    = actionable.map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio)
    .filter((v): v is number => v !== null)
  const achievedRRs = actionable.map(r => r.outcome.actualRR)
    .filter((v): v is number => v !== null)

  const winRate     = resolved > 0 ? wins.length / resolved : null
  const avgSetupRR  = avgOrNull(setupRRs)
  const avgAchievedRR = avgOrNull(achievedRRs)
  const expectancy  = computeExpectancy(winRate, avgSetupRR)

  return {
    symbol, timeframe,
    totalSnapshots:  records.length,
    actionableCount: actionable.length,
    winCount:        wins.length,
    lossCount:       losses.length,
    neitherCount:    neither.length,
    noTradeCount:    records.length - actionable.length,
    winRate,
    avgSetupRR,
    avgAchievedRR,
    expectancy,
    signalRate: records.length > 0 ? actionable.length / records.length : 0,
  }
}

function buildRegimeStats(allRecords: ValidationRecord[]): RegimeStats[] {
  const map = new Map<MarketRegime, { total: number; actionable: number; wins: number; losses: number }>()

  for (const r of allRecords) {
    const idx    = r.snapshot.snapshotCandleIndex
    const regime = getRegimeAtIndex(idx)
    if (!map.has(regime)) map.set(regime, { total: 0, actionable: 0, wins: 0, losses: 0 })
    const entry = map.get(regime)!
    entry.total++
    if (r.outcome.result !== 'no_trade') {
      entry.actionable++
      if (r.outcome.result === 'tp_hit') entry.wins++
      if (r.outcome.result === 'sl_hit') entry.losses++
    }
  }

  return Array.from(map.entries()).map(([regime, s]) => ({
    regime,
    label:           REGIME_LABELS[regime],
    totalSnapshots:  s.total,
    actionableCount: s.actionable,
    winCount:        s.wins,
    lossCount:       s.losses,
    winRate:         s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : null,
  }))
}

function buildMtfStats(results: DatasetResult[]): MtfAgreementStats[] {
  // Group results by symbol
  const bySymbol = new Map<string, DatasetResult[]>()
  for (const d of results) {
    const existing = bySymbol.get(d.symbol) ?? []
    existing.push(d)
    bySymbol.set(d.symbol, existing)
  }

  const agreementMap = new Map<string, { wins: number; losses: number; count: number }>()

  for (const [, datasets] of bySymbol) {
    if (datasets.length < 2) continue

    // Bin snapshots by decile of total candles (0-9)
    const BINS = 10
    const totalCandles = 540 // TOTAL_CANDLES
    const binSize = totalCandles / BINS

    for (let bin = 0; bin < BINS; bin++) {
      const binStart = bin * binSize
      const binEnd   = binStart + binSize

      const tfInputs: MTFTimeframeInput[] = []
      const binOutcomes: Array<'tp_hit' | 'sl_hit'> = []

      for (const dataset of datasets) {
        const inBin = dataset.records.filter(r => {
          const idx = r.snapshot.snapshotCandleIndex
          return idx >= binStart && idx < binEnd
        })
        if (inBin.length === 0) continue

        // Representative record from this bin (middle one)
        const rep = inBin[Math.floor(inBin.length / 2)]
        const { confidence } = rep.snapshot.pipeline

        tfInputs.push({
          label:     dataset.timeframe,
          direction: rep.snapshot.direction,
          grade:     confidence.grade,
          score:     confidence.score,
        })

        for (const r of inBin) {
          if (r.outcome.result === 'tp_hit') binOutcomes.push('tp_hit')
          else if (r.outcome.result === 'sl_hit') binOutcomes.push('sl_hit')
        }
      }

      if (tfInputs.length < 2) continue

      const { agreement } = computeMTFAgreement(tfInputs)
      const key = agreement

      if (!agreementMap.has(key)) agreementMap.set(key, { wins: 0, losses: 0, count: 0 })
      const entry = agreementMap.get(key)!
      entry.count++
      for (const o of binOutcomes) {
        if (o === 'tp_hit') entry.wins++
        else entry.losses++
      }
    }
  }

  const ORDER: string[] = ['aligned', 'mostly_aligned', 'mixed', 'strong_conflict']
  return ORDER.map(agreement => {
    const e = agreementMap.get(agreement)
    if (!e) return { agreement, count: 0, wins: 0, losses: 0, winRate: null }
    const resolved = e.wins + e.losses
    return { agreement, count: e.count, wins: e.wins, losses: e.losses, winRate: resolved > 0 ? e.wins / resolved : null }
  }).filter(e => e.count > 0)
}

function productionScore(
  winRate: number | null,
  expectancy: number | null,
  confCorrelates: boolean,
  signalRate: number,
  lossCats: LossCategoryRow[],
): { score: number; verdict: string; details: string[] } {
  const details: string[] = []
  let score = 0

  // Win rate (25 pts)
  if (winRate !== null) {
    if (winRate >= 0.60) {
      score += 25
      details.push(`Win rate ${(winRate * 100).toFixed(1)}% ≥ 60% — Excellent (+25)`)
    } else if (winRate >= 0.50) {
      score += 15
      details.push(`Win rate ${(winRate * 100).toFixed(1)}% ≥ 50% — Acceptable (+15)`)
    } else {
      details.push(`Win rate ${(winRate * 100).toFixed(1)}% < 50% — Below break-even (+0)`)
    }
  }

  // Expectancy (25 pts)
  if (expectancy !== null) {
    if (expectancy >= 1.0) {
      score += 25
      details.push(`Expectancy ${expectancy.toFixed(2)}R ≥ 1.0R — Strong edge (+25)`)
    } else if (expectancy >= 0.3) {
      score += 15
      details.push(`Expectancy ${expectancy.toFixed(2)}R ≥ 0.3R — Positive edge (+15)`)
    } else if (expectancy >= 0) {
      score += 8
      details.push(`Expectancy ${expectancy.toFixed(2)}R ≥ 0 — Marginal edge (+8)`)
    } else {
      details.push(`Expectancy ${expectancy.toFixed(2)}R < 0 — Negative expectancy (+0)`)
    }
  }

  // Confidence calibration (20 pts)
  if (confCorrelates) {
    score += 20
    details.push('Confidence score correlates with win rate — calibration is working (+20)')
  } else {
    score += 5
    details.push('Confidence score does NOT clearly correlate with win rate — needs tuning (+5)')
  }

  // Signal rate validity (15 pts) — too high or too low both bad
  if (signalRate >= 0.15 && signalRate <= 0.55) {
    score += 15
    details.push(`Signal rate ${(signalRate * 100).toFixed(0)}% (15–55%) — appropriate selectivity (+15)`)
  } else if (signalRate > 0.55 && signalRate <= 0.75) {
    score += 7
    details.push(`Signal rate ${(signalRate * 100).toFixed(0)}% > 55% — too many trades, possibly noisy (+7)`)
  } else if (signalRate < 0.15 && signalRate > 0.05) {
    score += 7
    details.push(`Signal rate ${(signalRate * 100).toFixed(0)}% < 15% — very selective, possibly over-filtered (+7)`)
  } else {
    details.push(`Signal rate ${(signalRate * 100).toFixed(0)}% — extreme, may indicate a systematic issue (+0)`)
  }

  // Loss quality — systematic vs random losses (15 pts)
  const totalLosses = lossCats.reduce((s, c) => s + c.count, 0)
  const badCats = ['bad_rr', 'stop_too_tight', 'target_unrealistic', 'late_entry']
  const systemicCount = lossCats
    .filter(c => badCats.includes(c.category))
    .reduce((s, c) => s + c.count, 0)
  const systemicPct = totalLosses > 0 ? systemicCount / totalLosses : 0

  if (systemicPct <= 0.2) {
    score += 15
    details.push(`Systematic loss categories (bad R:R, tight stop, etc.) = ${(systemicPct * 100).toFixed(0)}% ≤ 20% (+15)`)
  } else if (systemicPct <= 0.4) {
    score += 7
    details.push(`Systematic loss categories = ${(systemicPct * 100).toFixed(0)}% (20–40%) — room to improve trade planning (+7)`)
  } else {
    details.push(`Systematic loss categories = ${(systemicPct * 100).toFixed(0)}% > 40% — trade plan needs significant rework (+0)`)
  }

  const verdict = score >= 75 ? 'TRUSTED — publish without manual editing'
    : score >= 55 ? 'CONDITIONALLY TRUSTED — review high-stakes signals before publishing'
    : score >= 35 ? 'NEEDS TUNING — manual review required for all publications'
    : 'NOT RECOMMENDED — significant improvements needed before production use'

  return { score, verdict, details }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeExtendedMetrics(results: DatasetResult[]): ExtendedMetrics {
  const datasets = results.map(r => summarizeDataset(r.symbol, r.timeframe, r.records))

  // Aggregate all records across all datasets
  const allRecords = results.flatMap(r => r.records)
  const allActionable = allRecords.filter(r => r.outcome.result !== 'no_trade')
  const allWins       = allActionable.filter(r => r.outcome.result === 'tp_hit')
  const allLosses     = allActionable.filter(r => r.outcome.result === 'sl_hit')
  const allNeither    = allActionable.filter(r => r.outcome.result === 'neither')
  const resolved      = allWins.length + allLosses.length

  const allSetupRRs    = allActionable.map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio)
    .filter((v): v is number => v !== null)
  const allAchievedRRs = allActionable.map(r => r.outcome.actualRR)
    .filter((v): v is number => v !== null)

  const winRate       = resolved > 0 ? allWins.length / resolved : null
  const avgSetupRR    = avgOrNull(allSetupRRs)
  const avgAchievedRR = avgOrNull(allAchievedRRs)
  const expectancy    = computeExpectancy(winRate, avgSetupRR)

  const precision  = winRate  // P(win | actionable) = win rate
  const f1Approx   = (() => {
    const sigRate = allRecords.length > 0 ? allActionable.length / allRecords.length : 0
    if (precision === null || sigRate === 0) return null
    return 2 * precision * sigRate / (precision + sigRate + 1e-12)
  })()

  // Loss categorization — only for sl_hit records
  const lossRecords   = allLosses
  const catCounts     = new Map<LossCategory, number>()
  for (const r of lossRecords) {
    const cat = categorizeLoss(r)
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
  }
  const totalLosses = lossRecords.length

  const ALL_CATS: LossCategory[] = [
    'normal_loss', 'late_entry', 'weak_trend', 'false_breakout',
    'low_volume', 'bad_rr', 'support_resistance_failure', 'unexpected_reversal',
    'news_event', 'stop_too_tight', 'target_unrealistic', 'other',
  ]
  const lossCategoryBreakdown: LossCategoryRow[] = ALL_CATS
    .map(cat => ({
      category: cat,
      label:    LOSS_CATEGORY_LABELS[cat],
      count:    catCounts.get(cat) ?? 0,
      pct:      totalLosses > 0 ? ((catCounts.get(cat) ?? 0) / totalLosses) * 100 : 0,
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)

  const regimeStats = buildRegimeStats(allRecords)
  const mtfAgreementStats = buildMtfStats(results)

  // For production score, check if confidence calibration correlates
  // Use the dashboard's confidence report if available via the datasets
  // (we derive this from the win rates of high vs low confidence snapshots)
  const highConfidence  = allRecords.filter(r => r.snapshot.pipeline.confidence.score >= 7 && r.outcome.result !== 'no_trade')
  const lowConfidence   = allRecords.filter(r => r.snapshot.pipeline.confidence.score < 5  && r.outcome.result !== 'no_trade')
  const highConfWins    = highConfidence.filter(r => r.outcome.result === 'tp_hit').length
  const highConfLosses  = highConfidence.filter(r => r.outcome.result === 'sl_hit').length
  const lowConfWins     = lowConfidence.filter(r => r.outcome.result === 'tp_hit').length
  const lowConfLosses   = lowConfidence.filter(r => r.outcome.result === 'sl_hit').length
  const highWinRate     = highConfWins + highConfLosses > 2 ? highConfWins / (highConfWins + highConfLosses) : null
  const lowWinRate      = lowConfWins  + lowConfLosses  > 2 ? lowConfWins  / (lowConfWins  + lowConfLosses)  : null
  const confCorrelates  = highWinRate !== null && lowWinRate !== null && highWinRate > lowWinRate + 0.05

  const signalRate = allRecords.length > 0 ? allActionable.length / allRecords.length : 0

  const { score, verdict, details } = productionScore(winRate, expectancy, confCorrelates, signalRate, lossCategoryBreakdown)

  return {
    overall: {
      totalSnapshots:  allRecords.length,
      actionableCount: allActionable.length,
      winCount:        allWins.length,
      lossCount:       allLosses.length,
      neitherCount:    allNeither.length,
      winRate, avgSetupRR, avgAchievedRR, expectancy, signalRate, precision, f1Approx,
    },
    datasets,
    lossCategoryBreakdown,
    regimeStats,
    mtfAgreementStats,
    productionReadinessScore:    score,
    productionReadinessVerdict:  verdict,
    productionReadinessDetails:  details,
  }
}
