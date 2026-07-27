/**
 * MultiTimeframeContext — locates the base timeframe inside larger horizons.
 *
 * This module measures. It does not conclude. There is no `agreement` field, no
 * `dominantTrend`, no vote — deliberately. V5 accumulated 55 modules that each
 * independently decided bullish/bearish, which is the mechanical reason its
 * output can contradict itself; V6 keeps measurement and interpretation in
 * separate modules so that cannot recur.
 *
 * Everything here is scale-free: a position in [0,1] and a volatility ratio.
 * Neither carries price units, so a 15m view of BTC and a 4h view of a
 * microcap are directly comparable — the property analog retrieval depends on.
 */
import type { Candle, Timeframe } from '../../modules/market/types'
import { unavailable } from '../../modules/common/availability'
import { atrSeries } from '../../modules/indicators/utils'
import { encodeTrajectory } from '../trajectory/encoder'
import type { TrajectoryConfig } from '../trajectory/types'
import { DEFAULT_TRAJECTORY_CONFIG } from '../trajectory/types'
import type {
  ContextConfig, ContextResult, MultiTimeframeContext, RangePosition,
  TimeframeView, VolatilityContext,
} from './types'
import { DEFAULT_CONTEXT_CONFIG } from './types'

/** Candles for one timeframe, as supplied by the caller. */
export interface TimeframeInput {
  readonly timeframe: Timeframe
  readonly candles: readonly Candle[]
}

/**
 * Reference range over the trailing `lookback` bars, ending at the last bar.
 *
 * Causal by construction: it reads a trailing window only, so the value at the
 * end of a prefix equals the value at the same bar of the full array.
 */
function computeRangePosition(
  candles: readonly Candle[], lookback: number, atrNow: number,
): RangePosition | null {
  const n = candles.length
  const from = Math.max(0, n - lookback)
  let high = -Infinity
  let low = Infinity
  for (let i = from; i < n; i++) {
    if (candles[i].high > high) high = candles[i].high
    if (candles[i].low < low) low = candles[i].low
  }
  const span = high - low
  if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(atrNow) || atrNow <= 0) return null

  const price = candles[n - 1].close
  // Clamped because price can sit fractionally outside its own trailing range
  // on the final bar; the coordinate is still 0 or 1, not out of bounds.
  const position = Math.min(1, Math.max(0, (price - low) / span))
  return { position, widthInAtr: span / atrNow, lookback: n - from }
}

/**
 * Volatility now against this market's own norm.
 *
 * Mean of the last `short` ATR values over the mean of the last `long`. Both
 * windows end at the same bar, so the ratio is causal and unit-free.
 */
function computeVolatility(
  atr: readonly number[], shortWindow: number, longWindow: number,
): VolatilityContext | null {
  if (atr.length === 0) return null
  const meanOfLast = (k: number): number => {
    const from = Math.max(0, atr.length - k)
    let s = 0
    for (let i = from; i < atr.length; i++) s += atr[i]
    return s / (atr.length - from)
  }
  const shortMean = meanOfLast(shortWindow)
  const longMean = meanOfLast(longWindow)
  if (!Number.isFinite(shortMean) || !Number.isFinite(longMean) || longMean <= 0) return null
  return { ratio: shortMean / longMean, shortWindow, longWindow }
}

/**
 * Build the multi-timeframe context.
 *
 * `inputs[0]` is the base timeframe — the one being analysed. Later entries are
 * higher horizons that locate it. A timeframe that cannot be encoded is
 * omitted rather than approximated; if the BASE cannot be encoded there is no
 * context at all, and that is reported rather than papered over.
 */
export function buildContext(
  inputs: readonly TimeframeInput[],
  config: ContextConfig = DEFAULT_CONTEXT_CONFIG,
  trajectoryConfig: TrajectoryConfig = DEFAULT_TRAJECTORY_CONFIG,
): ContextResult {
  if (inputs.length === 0) {
    return { ok: false, context: null, unavailable: unavailable('insufficient-history', 'No timeframes supplied.') }
  }

  const views: TimeframeView[] = []
  for (const input of inputs) {
    const encoded = encodeTrajectory(input.candles, trajectoryConfig)
    if (!encoded.ok) continue

    const atr = atrSeries(
      input.candles.map(c => c.high),
      input.candles.map(c => c.low),
      input.candles.map(c => c.close),
      trajectoryConfig.atrPeriod,
    )
    const atrNow = atr[atr.length - 1]
    const range = computeRangePosition(input.candles, config.rangeLookback, atrNow)
    const volatility = computeVolatility(atr, config.volShortWindow, config.volLongWindow)
    if (range === null || volatility === null) continue

    views.push({ timeframe: input.timeframe, trajectory: encoded.trajectory, range, volatility })
  }

  const base = inputs[0].timeframe
  if (!views.some(v => v.timeframe === base)) {
    return {
      ok: false,
      context: null,
      unavailable: unavailable('insufficient-history',
        `The base timeframe ${base} could not be encoded; higher timeframes cannot substitute for it.`),
    }
  }

  return { ok: true, context: { base, views }, unavailable: null }
}

/** The base timeframe's view. Present whenever `buildContext` returned ok. */
export function baseView(context: MultiTimeframeContext): TimeframeView {
  const v = context.views.find(x => x.timeframe === context.base)
  if (v === undefined) {
    // Unreachable via buildContext, which validates this before returning ok.
    // Thrown rather than defaulted: a missing base view is a broken invariant,
    // not a degraded input, and silently substituting another timeframe would
    // make every downstream claim describe the wrong market.
    throw new Error(`MultiTimeframeContext invariant violated: no view for base timeframe ${context.base}`)
  }
  return v
}

/** Views above the base, in the order supplied. */
export function higherViews(context: MultiTimeframeContext): readonly TimeframeView[] {
  return context.views.filter(v => v.timeframe !== context.base)
}

export type {
  MultiTimeframeContext, TimeframeView, RangePosition, VolatilityContext, ContextResult, ContextConfig,
} from './types'
export { DEFAULT_CONTEXT_CONFIG } from './types'
