import { emaSeries } from '../utils'
import type { MACDResult } from '../types'

/**
 * MACD(12, 26, 9).
 * Returns null when closes.length < 34 (26 for EMA26 + 9 for signal - 1).
 */
export function computeMacd(closes: number[]): MACDResult | null {
  const ema12 = emaSeries(closes, 12) // result[k] = EMA12 at closes[11+k]
  const ema26 = emaSeries(closes, 26) // result[k] = EMA26 at closes[25+k]

  if (ema26.length === 0) return null

  // Align: ema26[k] and ema12[k+14] are both at closes[25+k]
  const macdLine = ema26.map((e26, k) => ema12[k + 14] - e26)

  const signalSeries = emaSeries(macdLine, 9)
  if (signalSeries.length === 0) return null

  const lastMacd = macdLine[macdLine.length - 1]
  const lastSignal = signalSeries[signalSeries.length - 1]
  const histogram = lastMacd - lastSignal
  const bias: MACDResult['bias'] = histogram > 0 ? 'bullish' : histogram < 0 ? 'bearish' : 'neutral'

  // previousHistogram: null only at minimum candle count (exactly 34 closes → signalSeries.length === 1)
  const previousHistogram: number | null = signalSeries.length >= 2
    ? (macdLine[macdLine.length - 2] - signalSeries[signalSeries.length - 2])
    : null

  return { macdLine: lastMacd, signalLine: lastSignal, histogram, previousHistogram, bias }
}
