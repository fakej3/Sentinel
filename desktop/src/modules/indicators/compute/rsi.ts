import { rsiSeries } from '../utils'

/**
 * RSI using Wilder's smoothing (period 14).
 * Returns null when closes.length < period + 1.
 */
export function computeRsi(closes: number[], period = 14): number | null {
  const series = rsiSeries(closes, period)
  return series.length === 0 ? null : series[series.length - 1]
}
