import type { SupportResistanceConfig } from './types'

export const DEFAULT_CONFIG: SupportResistanceConfig = {
  atrMultiplier: 0.25,
  mergeTolerance: 0.5,
  minTouchCount: 2,
  maxZoneAge: 200,
  lookback: 100,
  strengthDecayAge: 50,
}
