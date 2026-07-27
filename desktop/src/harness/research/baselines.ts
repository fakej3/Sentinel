/**
 * Trivial baselines. Every claimed improvement is measured against these.
 *
 * A hit rate, an expectancy or a Sharpe means nothing in isolation. The
 * question is always "compared to what?", and the honest comparator set
 * includes strategies that require no analysis at all. If Sentinel does not
 * beat a coin flip, an EMA cross and buy-and-hold, the ~15,000 lines of engine
 * between the candles and the call are not earning their place.
 *
 * All baselines are computed on the SAME observations, with the SAME stop
 * distances, at the SAME horizons — so a difference is a difference in
 * direction selection and nothing else. Where a baseline needs a lookback it
 * reads only recorded features, which are causal by construction.
 */
import type { Observation } from '../types'
import { rng } from '../sources'

export interface BaselineDef {
  readonly name: string
  readonly description: string
  /** +1 long, −1 short, 0 flat. */
  readonly direction: (o: Observation, r: () => number) => number
}

export const BASELINES: readonly BaselineDef[] = [
  {
    name: 'always_long',
    description: 'Long on every bar. The majority-class baseline in an up regime.',
    direction: () => 1,
  },
  {
    name: 'always_short',
    description: 'Short on every bar.',
    direction: () => -1,
  },
  {
    name: 'random',
    description: 'Fair coin, seeded. The zero-information benchmark.',
    direction: (_o, r) => (r() < 0.5 ? 1 : -1),
  },
  {
    name: 'ema_cross',
    description: 'Long when EMA20 sits above EMA50. The canonical trend-following rule.',
    // dist_emaN = (price − EMA_N)/price, so dist20 > dist50 ⟺ EMA20 < EMA50.
    // The comparison is written in EMA terms to keep the sign unambiguous.
    direction: (o) => {
      const d20 = o.features.dist_ema20
      const d50 = o.features.dist_ema50
      if (typeof d20 !== 'number' || typeof d50 !== 'number') return 0
      // EMA20 − EMA50 has the opposite sign to dist20 − dist50.
      const emaSpread = d50 - d20
      return emaSpread > 0 ? 1 : emaSpread < 0 ? -1 : 0
    },
  },
  {
    name: 'momentum_ema200',
    description: 'Long above the 200-period EMA. The simplest possible regime filter.',
    direction: (o) => {
      const d = o.features.dist_ema200
      if (typeof d !== 'number') return 0
      return d > 0 ? 1 : -1
    },
  },
  {
    name: 'mean_reversion_rsi',
    description: 'Long when RSI < 30, short when RSI > 70. The canonical fade rule.',
    direction: (o) => {
      const rsi = o.features.rsi
      if (typeof rsi !== 'number') return 0
      return rsi < 30 ? 1 : rsi > 70 ? -1 : 0
    },
  },
  {
    name: 'mean_reversion_vwap',
    description: 'Fade the distance from session VWAP.',
    direction: (o) => {
      const d = o.features.dist_vwap
      if (typeof d !== 'number') return 0
      return d > 0 ? -1 : d < 0 ? 1 : 0
    },
  },
  {
    name: 'buy_and_hold',
    description: 'Long on every bar — identical to always_long under a per-bar accounting, reported separately because it is the benchmark a user actually compares against.',
    direction: () => 1,
  },
]

export interface BaselineOutcome {
  readonly name: string
  /** Direction per observation, aligned with the input array. 0 = flat. */
  readonly directions: readonly number[]
}

/**
 * Directions for every baseline over one observation set.
 *
 * The RNG is seeded once per baseline and consumed in observation order, so
 * `random` is reproducible and independent of how many other baselines run.
 */
export function baselineDirections(
  observations: readonly Observation[],
  seed = 4242,
): BaselineOutcome[] {
  return BASELINES.map((b, i) => {
    const r = rng(seed + i * 1013)
    return { name: b.name, directions: observations.map(o => b.direction(o, r)) }
  })
}

/** Sentinel's own direction, in the same shape, for a paired comparison. */
export function sentinelDirections(observations: readonly Observation[]): number[] {
  return observations.map(o =>
    o.categorical.direction === 'long' ? 1 : o.categorical.direction === 'short' ? -1 : 0)
}
