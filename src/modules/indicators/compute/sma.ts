/** Returns the current SMA (average of the last N closes), or null if insufficient data. */
export function computeSma(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / period
}
