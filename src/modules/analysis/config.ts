import type { AnalysisConfig } from './types'

/**
 * Default thresholds — all values documented in ENGINE_RULES.md §14.
 * Override any field via the `config` parameter of `computeAnalysis`.
 */
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  emaConfluencePercent: 0.5,
  stochRsiOverboughtThreshold: 0.8,
  stochRsiOversoldThreshold: 0.2,
  adxWeakThreshold: 20,
  adxStrongThreshold: 25,
  rsiNeutralLow: 40,
  rsiNeutralHigh: 60,
  rsiBullishMin: 45,
  rsiBearishMax: 55,
  supportProximityPercent: 2.0,
  resistanceProximityPercent: 2.0,
  minBullishSwingsForTrend: 2,
  minBearishSwingsForTrend: 2,
  bollingerTightThreshold: 4,
  bollingerWideThreshold: 8,
}
