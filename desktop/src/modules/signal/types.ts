/**
 * Signal layer — core types.
 *
 * This layer exists because of one measured fact: the current engine converts
 * every continuous input to a boolean before combining anything
 * (`analysis/compute/full-trend.ts:36-98`), and no downstream stage can recover
 * the magnitude. On synthetic data that cost 34% of the available information;
 * on real data it made no difference, because there was none to lose.
 *
 * So the goal here is NOT more edge. It is a representation that can express
 * how much edge there is, including none. Three properties are enforced by the
 * types rather than by convention:
 *
 *   1. NO THRESHOLDS. Nothing in this layer converts a continuous value to a
 *      boolean. Features stay continuous from extraction to prediction.
 *
 *   2. A PROBABILITY IS NEVER A SCORE. `Prediction.probability` may only be
 *      produced by a `Calibrator` fitted on resolved outcomes. A model's raw
 *      output is typed `RawScore` and cannot be assigned to it.
 *
 *   3. "I DON'T KNOW" IS REPRESENTABLE. `probability` is nullable and every
 *      estimate carries the sample size behind it. The current engine cannot
 *      abstain on statistical grounds — it always emits a grade — and that is
 *      the property that let a 0-10 score with negative Brier skill be shown
 *      to users as though it meant something.
 */
import type { Candle, Timeframe } from '../market/types'

// ── Features ──────────────────────────────────────────────────────────────────

/**
 * One continuous feature.
 *
 * `extract` returns `null` for genuine unavailability — never a sentinel. A
 * zero-filled unavailable feature would place "EMA200 not computable" and
 * "price exactly at EMA200" at the same coordinate, which is the defect class
 * this project has already fixed twice (VWAP, Bollinger bandwidth).
 */
export interface FeatureSpec {
  readonly name: string
  /** Grouping for importance reporting and redundancy analysis. */
  readonly family: string
  /** Which timeframe's window this reads. */
  readonly timeframe: Timeframe | 'base'
  /**
   * How the raw value should be normalised before a model sees it.
   *
   * `zscore`   — trailing mean/sd. For roughly symmetric, unbounded values.
   * `rank`     — trailing empirical percentile, mapped to [-0.5, 0.5]. Robust
   *              to the fat tails that real returns have and synthetic Gaussian
   *              paths do not.
   * `none`     — already on a fixed, comparable scale (e.g. a ratio in [0,1]).
   */
  readonly scaling: 'zscore' | 'rank' | 'none'
  /** Sign convention: POSITIVE = BULLISH, without exception. */
  readonly extract: (ctx: FeatureContext) => number | null
}

/** Everything a feature may read. Causal by construction: a window ending at the decision bar. */
export interface FeatureContext {
  readonly candles: readonly Candle[]
  readonly timeframe: Timeframe
  /** Aligned coarser windows, keyed by timeframe. Empty when unavailable. */
  readonly higherTimeframes: ReadonlyMap<Timeframe, readonly Candle[]>
}

/** Raw feature values, before scaling. `null` = unavailable. */
export type RawFeatures = Readonly<Record<string, number | null>>

/** Scaled feature values. `null` survives scaling — absence is never imputed. */
export type ScaledFeatures = Readonly<Record<string, number | null>>

// ── Regime ────────────────────────────────────────────────────────────────────

/**
 * Regime statistics the current engine does not compute at all.
 *
 * Phase 6 established that four of five directional conditions test POSITION
 * (price against a reference) and one tests RATE (MACD), whose measured IC was
 * 0.0055. A trend-following rule set with an empty rate channel cannot detect
 * persistence. These three statistics are the rate channel:
 *
 *   varianceRatio      Lo–MacKinlay. VR > 1 means returns trend (variance grows
 *                      faster than linearly in the horizon); VR < 1 means they
 *                      revert; VR = 1 is a random walk. The single most direct
 *                      test of the property a trend engine depends on.
 *   returnAutocorr     Lag-1 autocorrelation of log returns. Positive =
 *                      persistence. This is the quantity the AR(1) synthetic
 *                      regimes varied and the engine could not exploit.
 *   volatilityRatio    Short-window realised vol over long-window. Regime
 *                      change, not direction.
 *
 * All three are `null` when the window is too short. None is thresholded here:
 * classification is a consumer's decision, and a threshold in this file would
 * reintroduce exactly the bottleneck the layer exists to avoid.
 */
export interface RegimeState {
  readonly varianceRatio: number | null
  readonly returnAutocorr: number | null
  readonly volatilityRatio: number | null
  /** Bars used. A regime estimate without its sample size is not interpretable. */
  readonly sampleSize: number
}

// ── Model ─────────────────────────────────────────────────────────────────────

/**
 * A model's raw output. Deliberately a distinct type from a probability.
 *
 * Nothing may present a `RawScore` to a user as a likelihood. The current
 * engine's central defect is that a 0-10 evidence-alignment sum reads as a
 * percentage; the type system now prevents the equivalent.
 */
export interface RawScore {
  /** Unbounded, signed. Positive = bullish. Monotone in the model's belief. */
  readonly value: number
  /** Feature names the model actually used (those that were non-null). */
  readonly used: readonly string[]
  /** Features the model wanted but did not get. */
  readonly missing: readonly string[]
}

export interface SignalModel {
  readonly name: string
  /** Features this model consumes, in a fixed order. */
  readonly features: readonly string[]
  /**
   * Scores one observation.
   *
   * Returns `null` when too few features are available for the score to mean
   * anything — the model may decline, and callers must handle it.
   */
  score(features: ScaledFeatures, regime: RegimeState): RawScore | null
}

// ── Calibration ───────────────────────────────────────────────────────────────

/** One bin of a fitted calibration map, with the support behind it. */
export interface CalibrationBin {
  readonly lower: number
  readonly upper: number
  readonly probability: number
  readonly n: number
}

/**
 * Maps a raw score to a probability, or refuses.
 *
 * A calibrator MUST refuse outside its fitted support rather than
 * extrapolating. Extrapolating a monotone fit past its data is how a model
 * trained on scores in [-2, 2] comes to emit 0.97 for a score of 8.
 */
export interface Calibrator {
  readonly name: string
  readonly bins: readonly CalibrationBin[]
  /** The score range the fit actually covers. */
  readonly support: { readonly min: number; readonly max: number }
  /** null when the score is outside support or the bin has too little data. */
  probability(score: number): { readonly p: number; readonly n: number } | null
}

// ── Prediction ────────────────────────────────────────────────────────────────

/** Why a prediction declined to state a probability. */
export type AbstentionReason =
  | 'no-model-score'
  | 'uncalibrated'
  | 'outside-calibration-support'
  | 'insufficient-support'

/**
 * The layer's single output.
 *
 * There is no `direction` field and no label. A consumer that wants a side
 * must apply its own threshold to `probability`, in the open, with its own
 * documented rationale — rather than inheriting one buried in a substring test
 * (`pipeline/compute/trade-plan.ts:216`).
 */
export interface Prediction {
  /**
   * P(forward return > 0) over the model's horizon, or `null` when the engine
   * cannot state one. Null is a first-class, expected outcome.
   */
  readonly probability: number | null
  /** Why, when `probability` is null. */
  readonly abstained: AbstentionReason | null
  /** Wilson interval on `probability`. Null whenever `probability` is. */
  readonly interval: { readonly lower: number; readonly upper: number } | null
  /** Resolved outcomes behind the estimate. A probability without this is not shippable. */
  readonly support: number
  /** The model's pre-calibration output, for diagnostics. Never shown as a likelihood. */
  readonly rawScore: number | null
  readonly regime: RegimeState
  /** The scaled vector, retained so importance analysis runs on shipped output. */
  readonly features: ScaledFeatures
  readonly modelName: string
  readonly calibratorName: string | null
}
