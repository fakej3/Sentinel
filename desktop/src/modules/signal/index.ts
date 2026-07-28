/**
 * Signal layer assembly.
 *
 *   Market data
 *      → continuous features        (features.ts — no thresholds)
 *      → causal trailing scaling    (scaling.ts  — trailing windows only)
 *      → regime estimation          (regime.ts   — the rate channel)
 *      → signal model               (model.ts    — fitted, traced, linear)
 *      → calibration                (calibration.ts — or a refusal)
 *      → Prediction
 *
 * ── WHY THIS IS A STATEFUL, BAR-AT-A-TIME ENGINE ──────────────────────────────
 *
 * Scaling is the reason. A trailing z-score is only trailing if the engine
 * cannot see the future, and the only way to enforce that structurally is to
 * feed it one observation at a time in chronological order and refuse to go
 * backwards. A batch API that took the whole series would make the most common
 * silent look-ahead in quantitative work — standardising by full-sample
 * statistics — the path of least resistance. `SignalEngine.observe` throws on
 * an out-of-order bar rather than producing a plausible number.
 *
 * ── WHAT THIS ENGINE WILL NOT DO ──────────────────────────────────────────────
 *
 * It will not emit a direction, a side, a grade, or a label. Its output is a
 * `Prediction` whose `probability` is frequently `null`, and null is a correct
 * answer rather than a degraded one. Every stage can decline: a feature can be
 * unavailable, the scaler can be cold, the model can have too little to work
 * with, and the calibrator can refuse a score outside its support. The engine
 * being replaced could do none of these — it always produced a grade — and that
 * is the property that let a score with negative Brier skill reach users.
 *
 * ── MISSING BARS ARE ACCEPTED; REORDERED BARS ARE NOT ─────────────────────────
 *
 * Real equity series have weekends, holidays and halts; Phase 8 ran on 619,040
 * daily bars full of them. Rejecting gaps would make the engine unusable on the
 * only real data available. Duplicated or reversed timestamps are a different
 * thing — they are malformed input, they silently corrupt every trailing
 * statistic, and they throw.
 */
import type { Candle, Timeframe } from '../market/types'
import type { IndicatorResult } from '../indicators/types'
import type { MarketStructureResult } from '../market-structure/types'
import type { SupportResistanceResult } from '../support-resistance/types'
import type {
  AbstentionReason, Calibrator, FeatureSpec, FeatureValue,
  Prediction, RawFeatures, RegimeState, ScaledFeatures, SignalModel,
} from './types'
import { DEFAULT_FEATURES, extractFeatures, toRawFeatures } from './features'
import { estimateRegime } from './regime'
import { MIN_SCALING_WINDOW, RollingScaler } from './scaling'
import type { ModelOutput } from './model'
import { LinearSignalModel } from './model'

export * from './types'
export * from './features'
export * from './regime'
export * from './scaling'
export * from './model'
export * from './calibration'

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Default trailing window for feature scaling, in bars.
 *
 * PROVENANCE: industry convention, and labelled as such rather than dressed up
 * as a derivation. 252 is the standard number of trading days in a year and the
 * conventional window for equity volatility estimation. The trade-off it sits
 * on is real but has no closed-form optimum: a longer window estimates the mean
 * and standard deviation more precisely, a shorter one tracks a changing
 * distribution more closely, and which dominates is a property of the data.
 *
 * It is therefore a STARTING POINT, not a tuned value. Selecting it properly
 * means running the walk-forward harness across candidate windows and picking
 * by out-of-sample performance; until that has been done, no claim is made that
 * 252 is better than 120 or 500.
 */
export const DEFAULT_SCALING_WINDOW = 252

export interface SignalEngineOptions {
  /** Feature set. Defaults to `DEFAULT_FEATURES`; order is load-bearing. */
  readonly features?: readonly FeatureSpec[]
  /** Trailing scaling window in bars. Must be >= MIN_SCALING_WINDOW. */
  readonly scalingWindow?: number
  /**
   * The scorer. Absent means the engine produces features, scaling and regime
   * only — which is exactly what is needed to BUILD the training set that a
   * model is later fitted on, so an unmodelled engine is a first-class mode
   * rather than a broken one.
   */
  readonly model?: SignalModel | null
  /**
   * The score→probability map. Absent means every prediction abstains with
   * `'uncalibrated'`. There is deliberately no fallback that turns a raw score
   * into a probability by any other route.
   */
  readonly calibrator?: Calibrator | null
}

/** Everything needed to evaluate one decision bar. */
export interface SignalInput {
  /** Window ENDING at the decision bar. The last element is the bar being decided on. */
  readonly candles: readonly Candle[]
  readonly timeframe: Timeframe
  readonly indicators: IndicatorResult
  readonly marketStructure: MarketStructureResult
  readonly supportResistance: SupportResistanceResult
  readonly higherTimeframes?: ReadonlyMap<Timeframe, readonly Candle[]>
}

export interface SignalDiagnostics {
  readonly barsProvided: number
  readonly featuresObserved: number
  readonly featuresUnavailable: number
  /** True once every scaled feature has a full trailing window. */
  readonly scalerWarm: boolean
}

/** One bar's full, traced output. */
export interface SignalObservation {
  /** The decision bar's closeTime. Chronology is enforced on this value. */
  readonly at: number
  /** Per-feature value, confidence, validity and explanation. */
  readonly features: Readonly<Record<string, FeatureValue>>
  readonly raw: RawFeatures
  readonly scaled: ScaledFeatures
  readonly regime: RegimeState
  /** The model's traced output, or null when no model is configured. */
  readonly model: ModelOutput | null
  readonly prediction: Prediction
  readonly diagnostics: SignalDiagnostics
}

// ── Wilson interval ───────────────────────────────────────────────────────────

const Z95 = 1.959963984540054

/**
 * Wilson score interval for a binomial proportion.
 *
 * Chosen over the normal (Wald) interval on the standard grounds: Wald has
 * coverage far below nominal for small n or extreme p, and produces bounds
 * outside [0, 1], which for a probability that a consumer may display is not a
 * cosmetic problem. Wilson's coverage is close to nominal throughout and its
 * bounds are always inside [0, 1] by construction.
 */
export function wilsonInterval(p: number, n: number, z = Z95): { lower: number; upper: number } | null {
  if (!Number.isFinite(p) || p < 0 || p > 1) return null
  if (!Number.isInteger(n) || n < 1) return null
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return { lower: Math.max(0, centre - half), upper: Math.min(1, centre + half) }
}

// ── Input validation ──────────────────────────────────────────────────────────

/**
 * Rejects a malformed candle window.
 *
 * Strictly increasing `openTime`, and `closeTime` after `openTime` on every
 * bar. Gaps are permitted — see the file header. Duplicates and reversals are
 * not: a duplicated bar double-counts a return and a reversed pair inverts one,
 * and both corrupt every trailing statistic downstream without any symptom that
 * a consumer could notice.
 */
export function assertWellFormedWindow(candles: readonly Candle[]): void {
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    if (!Number.isFinite(c.openTime) || !Number.isFinite(c.closeTime)) {
      throw new Error(`candle ${i} has a non-finite timestamp`)
    }
    if (c.closeTime <= c.openTime) {
      throw new Error(`candle ${i} closes at ${c.closeTime}, at or before its open ${c.openTime}`)
    }
    if (i > 0 && c.openTime <= candles[i - 1].openTime) {
      throw new Error(
        `candle window must be strictly chronological; candle ${i} opens at ${c.openTime}, `
        + `not after candle ${i - 1} at ${candles[i - 1].openTime}`,
      )
    }
  }
}

// ── The engine ────────────────────────────────────────────────────────────────

export class SignalEngine {
  private readonly specs: readonly FeatureSpec[]
  private readonly scaler: RollingScaler
  private readonly model: SignalModel | null
  private readonly calibrator: Calibrator | null
  private lastAt: number | null = null

  constructor(options: SignalEngineOptions = {}) {
    this.specs = options.features ?? DEFAULT_FEATURES
    if (this.specs.length === 0) throw new Error('SignalEngine: no features configured')
    const names = new Set(this.specs.map(s => s.name))
    if (names.size !== this.specs.length) {
      throw new Error('SignalEngine: duplicate feature names in the configured set')
    }
    const window = options.scalingWindow ?? DEFAULT_SCALING_WINDOW
    if (!Number.isInteger(window) || window < MIN_SCALING_WINDOW) {
      throw new Error(`SignalEngine: scalingWindow must be an integer >= ${MIN_SCALING_WINDOW}, got ${window}`)
    }
    this.scaler = new RollingScaler(this.specs, window)
    this.model = options.model ?? null
    this.calibrator = options.calibrator ?? null

    if (this.model !== null) {
      // A model whose feature list disagrees with the engine's would score a
      // vector of nulls and abstain forever, which reads as "no signal" rather
      // than as the configuration error it is.
      const missing = this.model.features.filter(f => !names.has(f))
      if (missing.length > 0) {
        throw new Error(
          `SignalEngine: model "${this.model.name}" wants features not produced by this engine: ${missing.join(', ')}`,
        )
      }
    }
  }

  /** True once every scaled feature has a full trailing window. */
  get warm(): boolean {
    return this.scaler.warm
  }

  /**
   * Processes one decision bar.
   *
   * MUST be called in chronological order. Out-of-order input throws — both
   * here and again inside `RollingScaler`, because the two guards protect
   * different things (this one the engine's own sequence, that one the trailing
   * windows) and collapsing them would leave the scaler unprotected against a
   * future caller that bypasses this method.
   */
  observe(input: SignalInput): SignalObservation {
    if (input.candles.length === 0) throw new Error('SignalEngine.observe: empty candle window')
    assertWellFormedWindow(input.candles)

    const at = input.candles[input.candles.length - 1].closeTime
    if (this.lastAt !== null && at <= this.lastAt) {
      throw new Error(
        `SignalEngine.observe: bars must be strictly chronological; got ${at} after ${this.lastAt}`,
      )
    }
    this.lastAt = at

    // 1 ─ Continuous features.
    const featureValues = extractFeatures({
      candles: input.candles,
      timeframe: input.timeframe,
      indicators: input.indicators,
      marketStructure: input.marketStructure,
      supportResistance: input.supportResistance,
      higherTimeframes: input.higherTimeframes ?? new Map(),
    }, this.specs)
    const raw = toRawFeatures(featureValues)

    // 2 ─ Causal scaling. Trailing windows only; this call also folds the
    //     observation in, so the value is scaled against its own past and
    //     never against itself.
    const scaled = this.scaler.scaleNext(raw, at)

    // 3 ─ Regime. Independent of the model, reported whether or not one exists,
    //     because it is the diagnostic that says whether a trend-following
    //     model had anything to work with.
    const regime = estimateRegime(input.candles)

    // 4 ─ Model. A `LinearSignalModel` is asked once, via `predict`, and the
    //     raw score is read off that result — calling `score` as well would run
    //     the same arithmetic a second time, and two independent evaluations
    //     are two things that can disagree.
    let modelOutput: ModelOutput | null = null
    let rawScore: number | null = null
    if (this.model instanceof LinearSignalModel) {
      modelOutput = this.model.predict(scaled)
      rawScore = modelOutput.linearPredictor
    } else if (this.model !== null) {
      rawScore = this.model.score(scaled, regime)?.value ?? null
    }

    // 5 ─ Calibration, or a refusal with its reason.
    const { probability, support, abstained } = this.calibrate(rawScore)

    let observedCount = 0
    for (const v of Object.values(featureValues)) if (v.validity === 'ok') observedCount++

    const prediction: Prediction = {
      probability,
      abstained,
      interval: probability === null ? null : wilsonInterval(probability, support),
      support,
      rawScore,
      regime,
      features: scaled,
      modelName: this.model?.name ?? 'none',
      calibratorName: this.calibrator?.name ?? null,
    }

    return {
      at,
      features: featureValues,
      raw,
      scaled,
      regime,
      model: modelOutput,
      prediction,
      diagnostics: {
        barsProvided: input.candles.length,
        featuresObserved: observedCount,
        featuresUnavailable: this.specs.length - observedCount,
        scalerWarm: this.scaler.warm,
      },
    }
  }

  /**
   * Maps a raw score to a probability, or names the reason it cannot.
   *
   * The two refusal reasons are kept distinct because they call for opposite
   * responses: `outside-calibration-support` means the model produced a score
   * unlike anything it was calibrated on (refit, or distrust the model), while
   * `insufficient-support` means the score is ordinary but too few resolved
   * outcomes sit near it (collect more data). Collapsing them into one null
   * would discard the only information that distinguishes the two.
   */
  private calibrate(score: number | null): {
    probability: number | null
    support: number
    abstained: AbstentionReason | null
  } {
    if (score === null) return { probability: null, support: 0, abstained: 'no-model-score' }
    if (this.calibrator === null) return { probability: null, support: 0, abstained: 'uncalibrated' }
    const r = this.calibrator.probability(score)
    if (r !== null) return { probability: r.p, support: r.n, abstained: null }
    const { min, max } = this.calibrator.support
    const outside = !Number.isFinite(score) || score < min || score > max
    return {
      probability: null,
      support: 0,
      abstained: outside ? 'outside-calibration-support' : 'insufficient-support',
    }
  }
}
