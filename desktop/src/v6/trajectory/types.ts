import type { Unavailable } from '../../modules/common/availability'

/**
 * One bar, encoded scale-free.
 *
 * Every field is either a ratio of two prices, a multiple of ATR, or a share of
 * a total. Nothing carries price units, so the same market shape at $9,000 and
 * at $90,000 produces byte-identical points. That property is what makes
 * historical analogy possible at all — without it, a 2019 BTC pattern could
 * never be compared with a 2024 one.
 *
 * These are DESCRIPTIONS OF A BAR, not judgements about it. There is
 * deliberately no `bullish`, no `strong`, no score. Interpretation is the
 * SituationEncoder's job, and prediction is the AnalogEngine's.
 */
export interface TrajectoryPoint {
  /** Index of this bar in the source candle array. */
  readonly index: number
  /** Bar open time (UTC ms), carried so analogs can be located in history. */
  readonly openTime: number

  /**
   * Close-to-close displacement in ATR units: (close − prevClose) / ATR.
   *
   * ATR rather than percent because it answers the question that matters —
   * "was this move large *for this market right now*" — which a percentage
   * cannot, since 1% is enormous for one asset and noise for another.
   */
  readonly displacement: number

  /** Bar range (high − low) in ATR units. How much ground the bar covered. */
  readonly range: number

  /**
   * |close − open| / (high − low). The share of the bar's range that the body
   * occupies, in [0, 1]. Near 1 = directional bar; near 0 = indecision or
   * rejection. Unitless by construction.
   */
  readonly bodyShare: number

  /**
   * (close − low) / (high − low), in [0, 1]. WHERE in its own range the bar
   * closed. This is the single most information-dense bar statistic available
   * from OHLCV: 0.95 after a push into resistance is rejection; 0.05 is
   * acceptance of lower prices. A boolean cannot express it; a scalar summary
   * of the whole window destroys it.
   */
  readonly closePosition: number

  /**
   * Opening gap from the previous close, in ATR units. Non-zero mostly at
   * session boundaries and after data gaps.
   */
  readonly gap: number

  /**
   * Volume as a z-score against a trailing window ending at this bar.
   * Scale-free across assets and across eras of a single asset.
   * `null` when the trailing window has no dispersion (constant volume).
   */
  readonly volumeZ: number | null

  /**
   * takerBuyVolume / volume, in [0, 1]. The genuine aggressor split Binance
   * publishes — the closest thing to order flow available without L2 data.
   * `null` when the bar traded nothing.
   *
   * NOT an "institutional footprint". It says which side crossed the spread,
   * nothing more, and it must never be narrated as more than that.
   */
  readonly aggressorShare: number | null
}

/**
 * A dense, scale-free encoding of a contiguous run of bars.
 *
 * Dense rather than aligned-to-input (with nulls for warmup) because the
 * consumer is analog retrieval, which needs contiguous vectors. `originIndex`
 * maps back to the source array so nothing is lost.
 */
export interface Trajectory {
  /** Encoded bars, oldest first. Never contains a non-finite number. */
  readonly points: readonly TrajectoryPoint[]
  /** Source-array index of `points[0]`. Bars before this could not be encoded. */
  readonly originIndex: number
  /** Bar duration in ms, derived from the candles themselves. */
  readonly barDuration: number
}

export type TrajectoryResult =
  | { readonly ok: true; readonly trajectory: Trajectory; readonly unavailable: null }
  | { readonly ok: false; readonly trajectory: null; readonly unavailable: Unavailable }

export interface TrajectoryConfig {
  /**
   * ATR period used as the normalisation unit.
   *
   * PROVENANCE: heuristic (Wilder's 14). Retained because every other ATR
   * consumer in the codebase uses it, so trajectories and V5 levels are
   * expressed in the same unit and remain comparable during migration.
   * Calibration target for Phase 3.
   */
  readonly atrPeriod: number
  /**
   * Trailing window for the volume z-score.
   *
   * PROVENANCE: heuristic. Must be long enough for a stable mean and short
   * enough to track participation regime changes. Calibration target.
   */
  readonly volumeWindow: number
}

export const DEFAULT_TRAJECTORY_CONFIG: TrajectoryConfig = {
  atrPeriod: 14,
  volumeWindow: 20,
}
