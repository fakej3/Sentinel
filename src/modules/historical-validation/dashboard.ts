import type { Timeframe } from '../binance/types'
import type {
  ValidationRecord,
  CalibrationDashboard,
  DashboardOverallStats,
} from './types'
import {
  buildConfidenceCalibrationReport,
  buildTrustValidationReport,
  buildEvidenceReport,
  buildTradePlanReport,
  buildPostValidationReport,
} from './reports'
import { avg, avgOrNull } from './math'

/**
 * Aggregate all validation records into a calibration dashboard.
 * All computation is deterministic and reproducible.
 */
export function buildDashboard(
  records: ValidationRecord[],
  symbol: string,
  interval: Timeframe,
  totalCandlesAnalyzed: number,
): CalibrationDashboard {
  const actionable = records.filter(r => r.outcome.result !== 'no_trade')
  const wins       = actionable.filter(r => r.outcome.result === 'tp_hit')
  const losses     = actionable.filter(r => r.outcome.result === 'sl_hit')
  const inconclusive = actionable.filter(r => r.outcome.result === 'neither')
  const resolved   = wins.length + losses.length

  const setupRRs    = actionable.map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio).filter((v): v is number => v !== null)
  const achievedRRs = actionable.map(r => r.outcome.actualRR).filter((v): v is number => v !== null)

  const overall: DashboardOverallStats = {
    totalSnapshots:      records.length,
    actionableTradeCount: actionable.length,
    winCount:            wins.length,
    lossCount:           losses.length,
    inconclusiveCount:   inconclusive.length,
    winRate:             resolved > 0 ? wins.length / resolved : null,
    averageSetupRR:      avgOrNull(setupRRs),
    averageAchievedRR:   avgOrNull(achievedRRs),
    averageMAE:          avg(actionable.map(r => r.outcome.mae)),
    averageMFE:          avg(actionable.map(r => r.outcome.mfe)),
  }

  // Phase win-rate analysis
  const phaseMap = new Map<string, { wins: number; losses: number }>()
  for (const r of actionable) {
    const phase = r.snapshot.pipeline.marketContext.phase
    if (!phaseMap.has(phase)) phaseMap.set(phase, { wins: 0, losses: 0 })
    const entry = phaseMap.get(phase)!
    if (r.outcome.result === 'tp_hit') entry.wins++
    if (r.outcome.result === 'sl_hit') entry.losses++
  }

  const phaseRates: Array<{ phase: string; winRate: number }> = []
  for (const [phase, { wins: w, losses: l }] of phaseMap) {
    if (w + l >= 3) phaseRates.push({ phase, winRate: w / (w + l) })
  }
  phaseRates.sort((a, b) => b.winRate - a.winRate)

  const topPerformingPhases  = phaseRates.slice(0, 3).map(p => p.phase)
  const worstPerformingPhases = [...phaseRates].reverse().slice(0, 3).map(p => p.phase)

  // Most common failure reasons (from critical invalidation scenarios on SL hits)
  const failureTypeCount = new Map<string, number>()
  for (const r of losses) {
    const criticalScenario = r.snapshot.pipeline.invalidationScenarios
      .find(s => s.severity === 'critical')
    if (criticalScenario) {
      const t = criticalScenario.type
      failureTypeCount.set(t, (failureTypeCount.get(t) ?? 0) + 1)
    }
  }
  const mostCommonFailureReasons = [...failureTypeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k)

  return {
    symbol,
    interval,
    totalCandlesAnalyzed,
    generatedAt: Date.now(),
    overall,
    confidence:      buildConfidenceCalibrationReport(records),
    trust:           buildTrustValidationReport(records),
    evidence:        buildEvidenceReport(records),
    tradePlan:       buildTradePlanReport(records),
    postValidation:  buildPostValidationReport(records),
    topPerformingPhases,
    worstPerformingPhases,
    mostCommonFailureReasons,
  }
}
