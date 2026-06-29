/**
 * Rolling VWAP over the entire candle set provided.
 * Always returns a value (falls back to last close when total volume is 0).
 */
export function computeVwap(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumulativeTPV = 0
  let cumulativeVolume = 0

  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3
    cumulativeTPV += tp * volumes[i]
    cumulativeVolume += volumes[i]
  }

  return cumulativeVolume === 0 ? closes[closes.length - 1] : cumulativeTPV / cumulativeVolume
}
