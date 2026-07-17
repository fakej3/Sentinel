import type { BollingerResult } from '../types'

/**
 * Bollinger Bands using SMA(20) ± 2 standard deviations.
 * Returns null when closes.length < period.
 */
export function computeBollinger(closes: number[], period = 20, multiplier = 2): BollingerResult | null {
  if (closes.length < period) return null

  const slice = closes.slice(-period)
  const middle = slice.reduce((s, v) => s + v, 0) / period
  const variance = slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period
  const stdDev = Math.sqrt(variance)

  const upper = middle + multiplier * stdDev
  const lower = middle - multiplier * stdDev
  const bandwidth = upper - lower

  return { upper, middle, lower, bandwidth }
}
