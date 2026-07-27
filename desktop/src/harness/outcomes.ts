/**
 * Forward-outcome measurement.
 *
 * This file is where look-ahead bias would enter if it entered anywhere, so it
 * is kept deliberately small and its contract is stated precisely:
 *
 *   An outcome for decision bar `i` at horizon `h` reads candles (i, i+h] and
 *   NOTHING from bar i or earlier except the decision-bar close and the ATR
 *   knowable at bar i.
 *
 * The decision bar's own high/low are excluded from MFE/MAE: at the moment of
 * decision that bar has closed, so its extremes are already known and counting
 * them would credit the engine with a move it could not have traded.
 */
import type { Candle } from '../modules/market/types'
import type { HorizonOutcome } from './types'

/**
 * Outcome for one horizon, or `null` when there are not enough future bars.
 *
 * Returning `null` rather than a shortened horizon matters: a 48-bar outcome
 * silently computed over 12 bars would be pooled with genuine 48-bar outcomes
 * and would bias every statistic that uses them.
 *
 * @param atrAtDecision ATR knowable at bar `i`. Used only to express results in
 *        scale-free units; must not be recomputed from future bars.
 */
export function computeOutcome(
  candles: readonly Candle[],
  i: number,
  horizonBars: number,
  atrAtDecision: number,
): HorizonOutcome | null {
  if (horizonBars <= 0) return null
  if (i < 0 || i >= candles.length) return null
  if (i + horizonBars >= candles.length) return null
  if (!Number.isFinite(atrAtDecision) || atrAtDecision <= 0) return null

  const entry = candles[i].close
  if (!Number.isFinite(entry) || entry <= 0) return null

  const exit = candles[i + horizonBars].close
  if (!Number.isFinite(exit)) return null

  let hi = -Infinity
  let lo = Infinity
  for (let k = i + 1; k <= i + horizonBars; k++) {
    const c = candles[k]
    if (c.high > hi) hi = c.high
    if (c.low < lo) lo = c.low
  }
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null

  const forwardReturn = (exit - entry) / entry
  const outcome: HorizonOutcome = {
    horizonBars,
    forwardReturn,
    forwardReturnAtr: (exit - entry) / atrAtDecision,
    mfeAtr: (hi - entry) / atrAtDecision,
    maeAtr: (lo - entry) / atrAtDecision,
    up: forwardReturn > 0,
  }

  for (const v of [outcome.forwardReturn, outcome.forwardReturnAtr, outcome.mfeAtr, outcome.maeAtr]) {
    if (!Number.isFinite(v)) return null
  }
  return outcome
}

/** All horizons for one decision bar. Missing horizons are `null`. */
export function computeOutcomes(
  candles: readonly Candle[],
  i: number,
  horizons: readonly number[],
  atrAtDecision: number,
): Record<number, HorizonOutcome | null> {
  const out: Record<number, HorizonOutcome | null> = {}
  for (const h of horizons) out[h] = computeOutcome(candles, i, h, atrAtDecision)
  return out
}

/**
 * The unconditional base rate of `up` at each horizon.
 *
 * Every conditional claim the engine makes has to beat this, and nothing in
 * Sentinel has ever measured it. A "60% up rate" is meaningless until you know
 * whether the marginal is 50% or 58%.
 */
export function baseRates(
  observations: ReadonlyArray<{ outcomes: Readonly<Record<number, HorizonOutcome | null>> }>,
  horizons: readonly number[],
): Record<number, { rate: number; n: number }> {
  const out: Record<number, { rate: number; n: number }> = {}
  for (const h of horizons) {
    let ups = 0
    let n = 0
    for (const o of observations) {
      const r = o.outcomes[h]
      if (r === null || r === undefined) continue
      n++
      if (r.up) ups++
    }
    out[h] = { rate: n > 0 ? ups / n : NaN, n }
  }
  return out
}
