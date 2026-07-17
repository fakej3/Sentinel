import { emaSeries } from '../utils'

/** Returns the current EMA value, or null if insufficient data. */
export function computeEma(closes: number[], period: number): number | null {
  const series = emaSeries(closes, period)
  return series.length === 0 ? null : series[series.length - 1]
}
