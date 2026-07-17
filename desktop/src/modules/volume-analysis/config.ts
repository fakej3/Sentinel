import type { VolumeAnalysisConfig } from './types'

/**
 * Default thresholds — all values documented in ENGINE_RULES.md §13.
 * Override any field via the `config` parameter of `computeVolumeAnalysis`.
 */
export const DEFAULT_CONFIG: VolumeAnalysisConfig = {
  relativeVolumePeriod: 20,
  relativeVolumeVeryLow: 0.5,
  relativeVolumeLow: 0.7,
  relativeVolumeHigh: 1.5,
  relativeVolumeVeryHigh: 2.5,
  volumeTrendWindow: 10,
  volumeSlopeThreshold: 0.01,
  pressureWindow: 10,
  pressureBalanceThreshold: 10.0,
  confirmationThreshold: 1.2,
  climaxThreshold: 2.0,
  climaxBodyRatio: 0.6,
  exhaustionBodyRatio: 0.3,
  vwapProximityPercent: 0.5,
}
