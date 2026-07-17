/**
 * Money Flow Index (MFI, period 14).
 * Requires period+1 candles (need previous TP for comparison).
 * Returns null when insufficient data.
 */
export function computeMfi(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period = 14,
): number | null {
  if (closes.length < period + 1) return null

  const tps = closes.map((c, i) => (highs[i] + lows[i] + c) / 3)
  const start = closes.length - period - 1

  let positiveFlow = 0
  let negativeFlow = 0

  for (let i = start + 1; i < closes.length; i++) {
    const rawFlow = tps[i] * volumes[i]
    if (tps[i] > tps[i - 1]) positiveFlow += rawFlow
    else if (tps[i] < tps[i - 1]) negativeFlow += rawFlow
  }

  if (positiveFlow === 0 && negativeFlow === 0) return 50
  if (negativeFlow === 0) return 100
  return 100 - 100 / (1 + positiveFlow / negativeFlow)
}
