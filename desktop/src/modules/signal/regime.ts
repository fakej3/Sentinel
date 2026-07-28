/**
 * Regime estimation — the rate channel the engine does not have.
 *
 * Phase 6 measured that four of the five conditions driving trend are POSITION
 * tests (price against a moving reference) and exactly one is a RATE test
 * (MACD separation), whose information coefficient was 0.0055 — indistinguish-
 * able from zero at n = 26,460. Phase 4 then measured that the engine cannot
 * profit from AR(1) return persistence at any strength up to phi = 0.5, which
 * is roughly ten times anything a liquid market exhibits.
 *
 * Those two findings are the same finding: a trend-following rule set whose
 * only rate channel is empty cannot detect persistence, because nothing it
 * computes is a function of the autocorrelation structure.
 *
 * This module computes three statistics that ARE functions of that structure.
 * It classifies nothing — every output is continuous and nullable — because a
 * threshold here would rebuild the bottleneck the layer exists to remove.
 *
 * IMPORTANT: none of these is claimed to predict returns. Phase 8 found no
 * detectable predictive information in the engine's inputs on real data, and
 * nothing here contradicts that. They are diagnostics of the process, which the
 * engine currently cannot observe at all.
 */
import type { Candle } from '../market/types'
import type { RegimeState } from './types'

/**
 * Minimum bars for a variance-ratio estimate.
 *
 * PROVENANCE: derived. Lo–MacKinlay's VR(q) uses ⌊n/q⌋ non-overlapping q-bar
 * blocks; its standard error under the null is ≈ √(2(2q−1)(q−1)/(3qn)). For the
 * estimate to distinguish VR = 1.2 from 1.0 at two standard errors with q = 4
 * requires n ≳ 120. Below that the statistic exists but cannot separate a trend
 * from a coin, so it is not emitted.
 */
export const MIN_REGIME_BARS = 120

/** Lag used for the variance ratio. PROVENANCE: the shortest measured horizon (4 bars). */
export const VR_LAG = 4

/**
 * Windows for the realised-volatility ratio.
 *
 * PROVENANCE: 20 and 100 bars — a 1:5 ratio, the conventional short/long split
 * for a volatility regime comparison, and the same 20-period window the engine
 * already uses for `volumeMA` and Bollinger. Not fitted.
 */
export const VOL_SHORT = 20
export const VOL_LONG = 100

function logReturns(candles: readonly Candle[]): number[] {
  const out: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const a = candles[i - 1].close
    const b = candles[i].close
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b)) out.push(Math.log(b / a))
  }
  return out
}

function meanOf(xs: readonly number[]): number {
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

/**
 * Lo–MacKinlay variance ratio, VR(q) = Var(q-bar return) / (q · Var(1-bar return)).
 *
 * VR > 1  — returns are positively autocorrelated; moves persist. The regime a
 *           trend-following engine is built for.
 * VR = 1  — random walk. No linear structure to exploit.
 * VR < 1  — mean reversion; moves retrace.
 *
 * Uses NON-OVERLAPPING q-bar blocks. Overlapping blocks give a lower-variance
 * estimator but introduce serial dependence between the blocks themselves,
 * which requires a correction this module would then have to carry. The
 * non-overlapping form is the one whose null distribution is stated above.
 *
 * Returns null when fewer than `MIN_REGIME_BARS` returns exist, when fewer than
 * two complete blocks fit, or when single-bar variance is zero.
 */
export function varianceRatio(candles: readonly Candle[], q = VR_LAG): number | null {
  if (!Number.isInteger(q) || q < 2) throw new Error(`varianceRatio: q must be an integer >= 2, got ${q}`)
  const r = logReturns(candles)
  if (r.length < MIN_REGIME_BARS) return null

  const m1 = meanOf(r)
  let v1 = 0
  for (const x of r) v1 += (x - m1) ** 2
  v1 /= r.length - 1
  if (!(v1 > 0)) return null

  const blocks: number[] = []
  for (let i = 0; i + q <= r.length; i += q) {
    let s = 0
    for (let k = 0; k < q; k++) s += r[i + k]
    blocks.push(s)
  }
  if (blocks.length < 2) return null

  const mq = meanOf(blocks)
  let vq = 0
  for (const x of blocks) vq += (x - mq) ** 2
  vq /= blocks.length - 1

  return vq / (q * v1)
}

/**
 * Lag-1 autocorrelation of log returns.
 *
 * The quantity the Phase 4 AR(1) regimes varied directly. Positive means a
 * move raises the odds the next move goes the same way.
 *
 * Real liquid markets sit near zero — that is what makes them liquid — so a
 * large reading on real data is more likely a data artefact than an
 * opportunity. This module reports it; it does not act on it.
 */
export function returnAutocorrelation(candles: readonly Candle[], lag = 1): number | null {
  if (!Number.isInteger(lag) || lag < 1) throw new Error(`returnAutocorrelation: lag must be >= 1, got ${lag}`)
  const r = logReturns(candles)
  if (r.length < MIN_REGIME_BARS || r.length <= lag + 1) return null

  const m = meanOf(r)
  let num = 0
  let den = 0
  for (let i = lag; i < r.length; i++) num += (r[i] - m) * (r[i - lag] - m)
  for (const x of r) den += (x - m) ** 2
  if (!(den > 0)) return null
  return num / den
}

/**
 * Realised volatility over the last `short` bars divided by the last `long`.
 *
 * > 1 = volatility expanding, < 1 = contracting. A regime statement, not a
 * directional one; it is reported so a consumer can condition on it explicitly
 * rather than inheriting an ADX threshold buried in a condition.
 */
export function volatilityRatio(
  candles: readonly Candle[],
  short = VOL_SHORT,
  long = VOL_LONG,
): number | null {
  if (short >= long) throw new Error(`volatilityRatio: short (${short}) must be < long (${long})`)
  const r = logReturns(candles)
  if (r.length < long) return null

  const rms = (xs: readonly number[]): number => {
    const m = meanOf(xs)
    let ss = 0
    for (const x of xs) ss += (x - m) ** 2
    return Math.sqrt(ss / (xs.length - 1))
  }
  const s = rms(r.slice(r.length - short))
  const l = rms(r.slice(r.length - long))
  if (!(l > 0)) return null
  return s / l
}

/** All three statistics for one window. Every field independently nullable. */
export function estimateRegime(candles: readonly Candle[]): RegimeState {
  const n = Math.max(0, candles.length - 1)
  return {
    varianceRatio: varianceRatio(candles),
    returnAutocorr: returnAutocorrelation(candles),
    volatilityRatio: volatilityRatio(candles),
    sampleSize: n,
  }
}

/**
 * Standard error of VR(q) under the random-walk null (Lo–MacKinlay,
 * homoscedastic case):
 *
 *     SE = sqrt( 2(2q − 1)(q − 1) / (3 q n) )
 *
 * Exposed so a consumer can ask whether a VR reading is distinguishable from 1
 * rather than comparing it to a threshold. Phase 8's central lesson is that an
 * effect without an interval is not a measurement.
 */
export function varianceRatioStdError(n: number, q = VR_LAG): number | null {
  if (n < MIN_REGIME_BARS || q < 2) return null
  return Math.sqrt((2 * (2 * q - 1) * (q - 1)) / (3 * q * n))
}
