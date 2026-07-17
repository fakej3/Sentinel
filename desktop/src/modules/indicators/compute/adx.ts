import type { ADXResult } from '../types'

/**
 * ADX(14) with +DI and -DI.
 * Uses Wilder's smoothing for TR, +DM, -DM, and DX.
 * Returns null when closes.length < period * 2 (need period for TR seed + period for DX seed).
 */
export function computeAdx(highs: number[], lows: number[], closes: number[], period = 14): ADXResult | null {
  if (closes.length < period * 2) return null

  const trs: number[] = []
  const plusDms: number[] = []
  const minusDms: number[] = []

  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ))

    const upMove = highs[i] - highs[i - 1]
    const downMove = lows[i - 1] - lows[i]
    plusDms.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDms.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  // Seed with average of first period values
  let smoothedTr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  let smoothedPlusDm = plusDms.slice(0, period).reduce((s, v) => s + v, 0) / period
  let smoothedMinusDm = minusDms.slice(0, period).reduce((s, v) => s + v, 0) / period

  const toDi = (dm: number, tr: number) => tr === 0 ? 0 : (dm / tr) * 100
  let diPlus = toDi(smoothedPlusDm, smoothedTr)
  let diMinus = toDi(smoothedMinusDm, smoothedTr)

  const toDx = (dp: number, dm: number) => {
    const sum = dp + dm
    return sum === 0 ? 0 : (Math.abs(dp - dm) / sum) * 100
  }

  const dxValues: number[] = [toDx(diPlus, diMinus)]

  for (let i = period; i < trs.length; i++) {
    smoothedTr = (smoothedTr * (period - 1) + trs[i]) / period
    smoothedPlusDm = (smoothedPlusDm * (period - 1) + plusDms[i]) / period
    smoothedMinusDm = (smoothedMinusDm * (period - 1) + minusDms[i]) / period

    diPlus = toDi(smoothedPlusDm, smoothedTr)
    diMinus = toDi(smoothedMinusDm, smoothedTr)
    dxValues.push(toDx(diPlus, diMinus))
  }

  if (dxValues.length < period) return null

  // Seed ADX from average of first period DX values
  let adx = dxValues.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period
  }

  return { adx, diPlus, diMinus }
}
