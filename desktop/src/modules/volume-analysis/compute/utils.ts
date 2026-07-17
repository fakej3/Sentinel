/**
 * Ordinary least-squares linear regression over an array of y-values.
 * x-axis is implicitly 0, 1, 2, ..., n-1.
 *
 * Returns { slope, r2 }:
 *   slope — change in y per unit of x (same units as y)
 *   r2    — coefficient of determination (0–1); measures fraction of variance
 *            explained by the linear fit (1 = perfect line, 0 = pure noise).
 *
 * Edge cases:
 *   n < 2         → slope = 0, r2 = 0 (cannot fit a line to fewer than 2 points)
 *   SSxx = 0      → slope = 0, r2 = 0 (only one unique x-value, shouldn't happen for n ≥ 2)
 *   SSyy = 0      → all y equal (perfectly flat), slope = 0, r2 = 1
 */
export function linearRegression(values: number[]): { slope: number; r2: number } {
  const n = values.length
  if (n < 2) return { slope: 0, r2: 0 }

  const xMean = (n - 1) / 2
  let ySum = 0
  for (let i = 0; i < n; i++) ySum += values[i]
  const yMean = ySum / n

  let ssxx = 0
  let ssxy = 0
  let ssyy = 0
  for (let i = 0; i < n; i++) {
    const dx = i - xMean
    const dy = values[i] - yMean
    ssxx += dx * dx
    ssxy += dx * dy
    ssyy += dy * dy
  }

  if (ssxx === 0) return { slope: 0, r2: 0 }
  if (ssyy === 0) return { slope: 0, r2: 1 }

  const slope = ssxy / ssxx
  const r2 = (ssxy * ssxy) / (ssxx * ssyy)
  return { slope, r2: Math.min(1, Math.max(0, r2)) }
}

/**
 * Compute an OBV series from scratch for the given candles window.
 * Starts at 0; each bar adds or subtracts its volume based on close direction.
 * Returns an array of length candles.length.
 */
export function localOBVSeries(candles: { close: number; volume: number }[]): number[] {
  const result: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close
    const curr = candles[i].close
    const vol = candles[i].volume
    if (curr > prev) result.push(result[i - 1] + vol)
    else if (curr < prev) result.push(result[i - 1] - vol)
    else result.push(result[i - 1])
  }
  return result
}
