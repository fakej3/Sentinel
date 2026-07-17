import { rsiSeries } from '../utils'
import type { StochRSIResult } from '../types'

/**
 * Stochastic RSI: StochRSI = (RSI - LowestRSI(14)) / (HighestRSI(14) - LowestRSI(14))
 * %K = SMA(StochRSI, 3), %D = SMA(%K, 3).
 * Returns null when insufficient data.
 */
export function computeStochRsi(
  closes: number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kSmooth = 3,
  dSmooth = 3,
): StochRSIResult | null {
  const rsiVals = rsiSeries(closes, rsiPeriod)
  if (rsiVals.length < stochPeriod + kSmooth + dSmooth - 2) return null

  // StochRSI values
  const stochVals: number[] = []
  for (let i = stochPeriod - 1; i < rsiVals.length; i++) {
    const window = rsiVals.slice(i - stochPeriod + 1, i + 1)
    const lowest = Math.min(...window)
    const highest = Math.max(...window)
    const range = highest - lowest
    stochVals.push(range === 0 ? 0 : (rsiVals[i] - lowest) / range)
  }

  if (stochVals.length < kSmooth + dSmooth - 1) return null

  // %K = SMA(stochRSI, kSmooth)
  const kVals: number[] = []
  for (let i = kSmooth - 1; i < stochVals.length; i++) {
    kVals.push(stochVals.slice(i - kSmooth + 1, i + 1).reduce((s, v) => s + v, 0) / kSmooth)
  }

  if (kVals.length < dSmooth) return null

  // %D = SMA(%K, dSmooth)
  const d = kVals.slice(-dSmooth).reduce((s, v) => s + v, 0) / dSmooth

  return { k: kVals[kVals.length - 1], d }
}
