/**
 * ATR using Wilder's smoothing (period 14).
 * Returns null when closes.length < period + 1.
 */
export function computeAtr(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null

  const trs: number[] = []
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ))
  }

  // Seed: average of first period TRs
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period

  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
  }

  return atr
}
