import type { Candle, Timeframe } from '../modules/market/types'

/**
 * Evaluation harness — shared types.
 *
 * The harness answers one question: does Sentinel's output carry information
 * about what happens next? Everything here exists to make that question
 * answerable without look-ahead and without hand-waving.
 *
 * DESIGN RULE: the harness never interprets. It records what the engine said
 * and what the market then did. Turning those into a verdict is the metrics
 * layer's job, and the mapping from engine output to probability is an explicit,
 * configurable assumption rather than something buried in the recorder.
 */

/** Forward horizons, in bars. */
export const DEFAULT_HORIZONS = [4, 12, 24, 48] as const

/**
 * What the market did after a given bar, over one horizon.
 *
 * Every field is scale-free (returns and ATR multiples) so observations from
 * different symbols and eras can be pooled without a price-level confound.
 */
export interface HorizonOutcome {
  readonly horizonBars: number
  /** (close[i+h] − close[i]) / close[i]. */
  readonly forwardReturn: number
  /** Same, expressed in ATR units at the decision bar — comparable across assets. */
  readonly forwardReturnAtr: number
  /** Maximum favourable excursion for a LONG, in ATR units, over (i, i+h]. */
  readonly mfeAtr: number
  /** Maximum adverse excursion for a LONG, in ATR units, over (i, i+h]. */
  readonly maeAtr: number
  /** forwardReturn > 0. The primary binary label. */
  readonly up: boolean
}

/**
 * One decision point: everything the engine knew, and everything that followed.
 *
 * `features` and `categorical` are deliberately flat maps rather than the
 * pipeline's nested result, because Phase 3 (feature importance) needs a design
 * matrix and Phase 2 needs to group by categorical outputs.
 */
export interface Observation {
  readonly symbol: string
  readonly timeframe: Timeframe
  /** Index of the decision bar within the source candle array. */
  readonly barIndex: number
  /** Open time of the decision bar (UTC ms). The observation's identity. */
  readonly asOf: number
  /** Scale-free numeric features. Never contains a raw price. */
  readonly features: Readonly<Record<string, number>>
  /** Categorical engine outputs (trend label, grade, setup quality, direction). */
  readonly categorical: Readonly<Record<string, string>>
  /**
   * Outcomes by horizon. `null` when the horizon extends past available data —
   * never fabricated, never truncated to a shorter horizon.
   */
  readonly outcomes: Readonly<Record<number, HorizonOutcome | null>>
}

/** A contiguous block of candles for one symbol/timeframe. */
export interface Series {
  readonly symbol: string
  readonly timeframe: Timeframe
  readonly candles: readonly Candle[]
}

/** Anything that can supply series. Keeps the harness independent of Binance. */
export interface CandleSource {
  readonly name: string
  list(): Promise<readonly Series[]>
}

export interface RunConfig {
  /**
   * Number of candles handed to the engine at each decision.
   *
   * PROVENANCE: industry convention as instantiated by this codebase —
   * `DEFAULT_CANDLE_LIMIT = 200` in `modules/binance/constants.ts` is what
   * `fetchMarketData` requests, so 200 bars is exactly what the deployed
   * engine ever sees. Measuring on a longer window would measure an engine
   * that does not exist.
   *
   * A FIXED window (rather than a growing prefix) also gives the run a
   * constant per-bar cost and makes every observation directly comparable:
   * EMA200 is equally warm at the first decision and the last.
   *
   * The first decision is therefore at bar index `lookbackBars - 1`; there is
   * no separate warm-up parameter because the window IS the warm-up.
   */
  readonly lookbackBars: number
  /**
   * Bars between decisions. 1 evaluates every bar.
   *
   * Raising it reduces autocorrelation between consecutive observations and
   * cuts runtime linearly. It does NOT fix dependence — overlapping forward
   * windows still correlate — which is why the metrics layer clusters by
   * episode rather than trusting the raw count.
   */
  readonly stride: number
  readonly horizons: readonly number[]
  /** Emit progress every N decisions. 0 disables. */
  readonly progressEvery: number
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  lookbackBars: 200,
  stride: 1,
  horizons: [...DEFAULT_HORIZONS],
  progressEvery: 0,
}

/** Everything one series produced, plus the facts needed to reproduce it. */
export interface RunResult {
  readonly symbol: string
  readonly timeframe: Timeframe
  readonly observations: readonly Observation[]
  /** Decisions attempted but not recorded, by reason. Never silently dropped. */
  readonly skipped: Readonly<Record<string, number>>
  readonly config: RunConfig
}

/**
 * A walk-forward split, expressed in BAR INDICES of the source series.
 *
 * Bars, not observation ordinals, because the embargo is a statement about
 * time: `embargoBars` must be at least the longest horizon, so that no
 * training observation's forward window can overlap a test bar. Expressed in
 * observation ordinals that guarantee would silently weaken whenever stride
 * changed.
 *
 * Half-open on the right throughout: a bar `b` is in train iff
 * `trainStart <= b < trainEnd`, in test iff `testStart <= b < testEnd`.
 */
export interface Split {
  readonly index: number
  readonly trainStart: number
  readonly trainEnd: number
  readonly embargoBars: number
  readonly testStart: number
  readonly testEnd: number
}
