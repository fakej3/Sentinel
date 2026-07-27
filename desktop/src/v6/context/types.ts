import type { Timeframe } from '../../modules/market/types'
import type { Trajectory } from '../trajectory/types'
import type { Unavailable } from '../../modules/common/availability'

/**
 * Where price sits inside a reference range, and how wide that range is.
 *
 * Both fields are scale-free. `position` is the coordinate a trader reads
 * first — "am I at the top, the bottom, or the middle" — and it is the single
 * fastest disqualifier that exists, because the middle of a range offers no
 * asymmetry in either direction.
 */
export interface RangePosition {
  /** (price − low) / (high − low) over the lookback, in [0, 1]. */
  readonly position: number
  /** Range width in ATR units — a wide range and a tight one are different worlds. */
  readonly widthInAtr: number
  /** Bars used to establish the range. */
  readonly lookback: number
}

/**
 * Current volatility against this market's own recent norm.
 *
 * A ratio, not a label. Naming it 'expanding' is the SituationEncoder's job;
 * this layer only measures. Keeping measurement and naming in separate modules
 * is what stops V6 from acquiring the 55 independent trend-classifiers V5 has.
 */
export interface VolatilityContext {
  /** short-window ATR / long-window ATR. 1.0 = at its own norm. */
  readonly ratio: number
  readonly shortWindow: number
  readonly longWindow: number
}

/** One timeframe's view. Coordinates only — never a conclusion, never a vote. */
export interface TimeframeView {
  readonly timeframe: Timeframe
  readonly trajectory: Trajectory
  readonly range: RangePosition
  readonly volatility: VolatilityContext
}

/**
 * The same market seen at several horizons.
 *
 * V5 had a multi-timeframe module that produced an `agreement` verdict and was
 * never wired into the pipeline. V6 deliberately produces no verdict: higher
 * timeframes supply *coordinates* for the base timeframe's situation, and
 * agreement is something the AnalogEngine can discover empirically if it
 * exists, not something declared here.
 */
export interface MultiTimeframeContext {
  /** The timeframe being analysed. Higher ones exist to locate it. */
  readonly base: Timeframe
  readonly views: readonly TimeframeView[]
}

export type ContextResult =
  | { readonly ok: true; readonly context: MultiTimeframeContext; readonly unavailable: null }
  | { readonly ok: false; readonly context: null; readonly unavailable: Unavailable }

export interface ContextConfig {
  /**
   * Bars used to establish the reference range.
   *
   * PROVENANCE: heuristic. Long enough to contain several swings, short enough
   * that the range describes the current market rather than its history.
   * Calibration target for Phase 3.
   */
  readonly rangeLookback: number
  /**
   * Windows for the volatility ratio.
   *
   * PROVENANCE: heuristic. The ratio is meaningful for any short < long; these
   * particular values are not forced. Calibration target.
   */
  readonly volShortWindow: number
  readonly volLongWindow: number
}

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  rangeLookback: 60,
  volShortWindow: 10,
  volLongWindow: 60,
}
