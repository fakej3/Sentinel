/**
 * Commodity Channel Index (CCI, period 20).
 * Returns null when closes.length < period.
 */
export function computeCci(highs: number[], lows: number[], closes: number[], period = 20): number | null {
  if (closes.length < period) return null

  const sliceH = highs.slice(-period)
  const sliceL = lows.slice(-period)
  const sliceC = closes.slice(-period)

  const tps = sliceC.map((c, i) => (sliceH[i] + sliceL[i] + c) / 3)
  const meanTp = tps.reduce((s, v) => s + v, 0) / period
  const meanDev = tps.reduce((s, v) => s + Math.abs(v - meanTp), 0) / period

  if (meanDev === 0) return 0
  return (tps[period - 1] - meanTp) / (0.015 * meanDev)
}
