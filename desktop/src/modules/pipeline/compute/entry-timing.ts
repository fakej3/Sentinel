import type { TradePlan } from '../types'

/**
 * Returns true only when the computed trade plan is actionable and the current
 * market price is inside its directional entry zone. A directional bias outside
 * the entry zone is a WAIT, not an executable Buy/Sell signal.
 */
export function isEntryExecutable(currentPrice: number, tradePlan: TradePlan): boolean {
  if (!tradePlan.actionable || tradePlan.entryZone === null || tradePlan.direction === null) {
    return false
  }

  const { lower, upper } = tradePlan.entryZone
  if (tradePlan.direction === 'long') {
    return currentPrice >= lower && currentPrice <= upper
  }
  return currentPrice >= lower && currentPrice <= upper
}
