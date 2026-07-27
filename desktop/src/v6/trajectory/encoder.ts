/**
 * TrajectoryEncoder — turns candles into a scale-free SEQUENCE.
 *
 * This is the module that exists to fix V5's root defect. V5's indicator layer
 * reduces ~500 candles to 18 last-value scalars before any reasoning begins;
 * every downstream layer then reasons about the residue, and no amount of
 * downstream sophistication recovers the discarded shape.
 *
 * The encoder discards nothing about shape. It removes only two things, both
 * deliberately: absolute price level and absolute volume level. What remains is
 * the market's *behaviour*, expressed in its own units.
 *
 * SCALE INVARIANCE IS EXACT IN R, NOT IN BINARY64. Every field is a ratio whose
 * scale factor cancels algebraically, but (k*a - k*b)/(k*c) is not bitwise
 * equal to (a - b)/c. Measured worst deviation across scale factors 1e-6..1e6
 * is 3.6e-14 absolute. Tests assert invariance to that tolerance rather than
 * to equality; claiming exactness would be false.
 *
 * CAUSALITY. Every value at bar i is computed from candles[0..i] only. The ATR
 * used to normalise bar i is the ATR that was knowable at bar i (see
 * atrSeries' index contract), and the volume z-score uses a trailing window
 * ending at i. This is what makes the encoding replay-safe and backtestable;
 * a single forward-looking normalisation would silently invalidate every
 * historical analog built on top of it.
 */
import type { Candle } from '../../modules/market/types'
import type { Unavailable } from '../../modules/common/availability'
import { unavailable } from '../../modules/common/availability'
import { atrSeries } from '../../modules/indicators/utils'
import type {
  Trajectory, TrajectoryConfig, TrajectoryPoint, TrajectoryResult,
} from './types'
import { DEFAULT_TRAJECTORY_CONFIG } from './types'

/**
 * Ratio of consecutive opens above which the spacing is treated as a data gap.
 *
 * PROVENANCE: derived. For uniform data the ratio is exactly 1; one missing bar
 * makes it exactly 2. There is no third value, so 1.5 is the midpoint of the
 * only two reachable ones — the boundary maximally tolerant of timestamp
 * jitter in both directions.
 */
const GAP_RATIO = 1.5

function fail(code: Parameters<typeof unavailable>[0], detail: string): TrajectoryResult {
  return { ok: false, trajectory: null, unavailable: unavailable(code, detail) }
}

/**
 * Bar duration in ms, derived from the candles rather than from a Timeframe
 * label, so the encoder carries no provider vocabulary and can notice when the
 * data disagrees with its label.
 *
 * Primary source is `closeTime - openTime + 1` (Binance reports an inclusive
 * close). Fallback is the MINIMUM spacing over the last few opens: gaps only
 * ever make a spacing larger, so the minimum is the gap-immune estimator —
 * using the final pair alone would infer 2x the true duration whenever the
 * window happened to end just after a missing bar, making the result depend on
 * where the window ends.
 */
function inferBarDuration(candles: readonly Candle[]): number | null {
  const last = candles[candles.length - 1]
  const fromClose = last.closeTime - last.openTime + 1
  if (Number.isFinite(fromClose) && fromClose > 1) return fromClose

  const SAMPLES = 5
  let min = Infinity
  for (let i = candles.length - 1; i > 0 && i > candles.length - 1 - SAMPLES; i--) {
    const d = candles[i].openTime - candles[i - 1].openTime
    if (Number.isFinite(d) && d > 0 && d < min) min = d
  }
  if (min !== Infinity) return min
  return Number.isFinite(fromClose) && fromClose > 0 ? fromClose : null
}

/** Trailing mean and population standard deviation over `values[from..to]`. */
function trailingStats(values: readonly number[], to: number, window: number): { mean: number; sd: number } {
  const from = Math.max(0, to - window + 1)
  const n = to - from + 1
  let sum = 0
  for (let i = from; i <= to; i++) sum += values[i]
  const mean = sum / n
  let acc = 0
  for (let i = from; i <= to; i++) acc += (values[i] - mean) ** 2
  return { mean, sd: Math.sqrt(acc / n) }
}

/**
 * Encode candles into a scale-free trajectory.
 *
 * Returns a structured reason rather than a degraded result when the input
 * cannot support an honest encoding — the encoder never fills in a default.
 */
export function encodeTrajectory(
  candles: readonly Candle[],
  config: TrajectoryConfig = DEFAULT_TRAJECTORY_CONFIG,
): TrajectoryResult {
  const { atrPeriod, volumeWindow } = config
  const n = candles.length

  // A trajectory needs the ATR seed (atrPeriod + 1 candles) plus at least one
  // bar to describe. Below that there is no encoding, not a partial one.
  const minimum = atrPeriod + 2
  if (n < minimum) {
    return fail('insufficient-history',
      `Trajectory encoding needs at least ${minimum} candles (ATR seed ${atrPeriod + 1} plus one bar); received ${n}.`)
  }

  const barDuration = inferBarDuration(candles)
  if (barDuration === null) {
    return fail('malformed-input', 'Candle timestamps do not describe a positive bar duration.')
  }

  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)

  // atrSeries[k] is the ATR AT candle index atrPeriod + k, using candles[0..k+atrPeriod].
  const atr = atrSeries(highs, lows, closes, atrPeriod)
  if (atr.length === 0) {
    return fail('insufficient-history', `ATR series is empty for period ${atrPeriod} over ${n} candles.`)
  }

  // First encodable bar: the first one with a knowable ATR. Bars before it
  // cannot be normalised, so they are excluded rather than approximated.
  const originIndex = atrPeriod
  const points: TrajectoryPoint[] = []

  for (let i = originIndex; i < n; i++) {
    const a = atr[i - atrPeriod]
    // A non-positive ATR means the market has not moved at all over the seed
    // window. Dividing by it would manufacture infinities, so the bar is
    // skipped; a flat market legitimately has no scale to measure against.
    if (!Number.isFinite(a) || a <= 0) continue

    const c = candles[i]
    const prev = candles[i - 1]
    const span = c.high - c.low

    // A zero-span bar (high === low) has no internal geometry. bodyShare and
    // closePosition are undefined there, not zero; 0.5 is the only neutral
    // value that asserts nothing, and it is used with that meaning.
    const bodyShare = span > 0 ? Math.abs(c.close - c.open) / span : 0
    const closePosition = span > 0 ? (c.close - c.low) / span : 0.5

    const { mean, sd } = trailingStats(volumes, i, volumeWindow)
    const volumeZ = sd > 0 ? (volumes[i] - mean) / sd : null

    const aggressorShare = c.volume > 0 ? c.takerBuyVolume / c.volume : null

    // Gap only means something when the previous bar is genuinely adjacent.
    // Across a data gap the "gap" is an artifact of missing bars, not a
    // market event, so it is reported as zero rather than as a huge jump.
    const adjacent = c.openTime - prev.openTime < GAP_RATIO * barDuration
    const gap = adjacent ? (c.open - prev.close) / a : 0

    const point: TrajectoryPoint = {
      index: i,
      openTime: c.openTime,
      displacement: (c.close - prev.close) / a,
      range: span / a,
      bodyShare,
      closePosition,
      gap,
      volumeZ: volumeZ !== null && Number.isFinite(volumeZ) ? volumeZ : null,
      aggressorShare: aggressorShare !== null && Number.isFinite(aggressorShare) ? aggressorShare : null,
    }

    // Structural guarantee rather than an assumption: a non-finite field would
    // poison every distance computation in analog retrieval, silently.
    if (!Number.isFinite(point.displacement) || !Number.isFinite(point.range)
      || !Number.isFinite(point.bodyShare) || !Number.isFinite(point.closePosition)
      || !Number.isFinite(point.gap)) {
      continue
    }
    points.push(point)
  }

  if (points.length === 0) {
    return fail('malformed-input', 'No bar in the window could be encoded; prices or volatility are degenerate.')
  }

  const trajectory: Trajectory = {
    points,
    originIndex: points[0].index,
    barDuration,
  }
  return { ok: true, trajectory, unavailable: null }
}

/** The most recent `count` points, oldest first. Fewer if the trajectory is shorter. */
export function tail(trajectory: Trajectory, count: number): readonly TrajectoryPoint[] {
  if (count <= 0) return []
  return trajectory.points.slice(Math.max(0, trajectory.points.length - count))
}

export type { Trajectory, TrajectoryPoint, TrajectoryResult, TrajectoryConfig } from './types'
export { DEFAULT_TRAJECTORY_CONFIG } from './types'
export type { Unavailable }
