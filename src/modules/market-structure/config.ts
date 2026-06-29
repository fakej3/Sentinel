import type { MarketStructureConfig } from './types'

/**
 * Default configuration values aligned with ENGINE_RULES.md.
 * All values are documented in MarketStructureConfig.
 */
export const DEFAULT_CONFIG: MarketStructureConfig = {
  swingLookback: 2,
  consolidationSwings: 5,
  consolidationThreshold: 3.0,
  breakoutVolumeMultiplier: 1.3,
  minSwingsForTrend: 4,
  equalThreshold: 0.1,
}
