/**
 * On-Balance Volume (OBV).
 * Always returns a value (0 when closes.length < 2).
 */
export function computeObv(closes: number[], volumes: number[]): number {
  let obv = 0
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i]
    else if (closes[i] < closes[i - 1]) obv -= volumes[i]
  }
  return obv
}
