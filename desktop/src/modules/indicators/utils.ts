/**
 * Returns the full EMA series. result[0] = SMA seed at index period-1;
 * result[k] = EMA at candle index period-1+k.
 * Returns [] when values.length < period.
 */
export function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period
  const result: number[] = [ema]
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

/**
 * Returns the full RSI series using Wilder's smoothing.
 * result[0] = first RSI value computed from closes[0..period] (period+1 closes needed).
 * result[k] corresponds to closes[period+k].
 * Returns [] when closes.length < period+1.
 */
export function rsiSeries(closes: number[], period: number): number[] {
  if (closes.length < period + 1) return []

  const changes = closes.slice(1).map((c, i) => c - closes[i])

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period

  const toRsi = (g: number, l: number) => g === 0 && l === 0 ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l)
  const result: number[] = [toRsi(avgGain, avgLoss)]

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.abs(Math.min(changes[i], 0))) / period
    result.push(toRsi(avgGain, avgLoss))
  }

  return result
}
