import type { ValidationConfig } from './types'

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  zoneCenterTolerance: 0.001,
  minEvidenceItems: 3,
  minHighImpactEvidence: 1,
  failOnWarning: false,
  rsiBullishMin: 45,
  rsiBearishMax: 55,
  adxWeakThreshold: 20,
  rsiNeutralLow: 40,
  rsiNeutralHigh: 60,
  minBullishSwingsForTrend: 2,
  minBearishSwingsForTrend: 2,
}
