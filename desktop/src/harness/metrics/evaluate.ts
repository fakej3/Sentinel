/**
 * Assembles every metric for every slice at every horizon.
 *
 * Horizons are never aggregated into one number. A 4-bar result and a 48-bar
 * result are different questions with different base rates and different noise
 * levels, and averaging them produces a figure that describes neither.
 */
import type { Observation } from '../types'
import type { MetricsReport, ProbabilityMetrics, SliceMetrics } from './types'
import { binaryFromLabels, confusionMatrix, multiclassMetrics } from './classification'
import { brierScore, brierSkillScore, calibration, logLoss, rocAuc } from './probability'
import { rankingMetrics, type ScoredOutcome } from './ranking'
import { buildTrades, tradingMetrics } from './trading'
import { buildSlices, type SliceOptions } from './slices'
import {
  DEFAULT_PREDICTION_CONFIG, SIGNALS, directionSign, directionalProbability,
  hasDirection, predictedSignal, predictedUp, realisedSignal, type PredictionConfig,
} from './predictions'

export interface EvaluateOptions extends SliceOptions {
  readonly horizons?: readonly number[]
  readonly prediction?: PredictionConfig
  /** Set when stride < max(horizons). Propagated into every trading result. */
  readonly overlapping: boolean
  readonly calibrationBins?: number
  readonly logLossEps?: number
  readonly minBucketCount?: number
  readonly minBinCount?: number
}

function probabilityMetrics(
  p: readonly number[],
  y: readonly boolean[],
  bins: number,
  eps: number,
  minBinCount: number,
): ProbabilityMetrics {
  return {
    n: p.length,
    brier: brierScore(p, y),
    brierSkillScore: brierSkillScore(p, y),
    logLoss: logLoss(p, y, eps),
    logLossEps: eps,
    rocAuc: rocAuc(p, y),
    calibrationEqualWidth: calibration(p, y, { bins, method: 'equal-width', minBinCount }),
    calibrationQuantile: calibration(p, y, { bins, method: 'quantile', minBinCount }),
  }
}

/**
 * Metrics for one slice at one horizon.
 *
 * Four scoreboards, deliberately, because they answer four different
 * questions and a single one of them would be misleading:
 *
 *   binaryUpDown — a forced up/down call on every bar, comparable to a coin.
 *                  Penalises the engine for abstaining, which is why it is not
 *                  the headline.
 *   threeWay     — buy/sell/neutral against a realised label with a dead-band.
 *                  Scores what the engine actually said, abstentions included.
 *   directional  — of the calls it did make, how many were right. The number a
 *                  trader cares about.
 *   trading      — the same calls, in units of the plan's own risk.
 *
 * The probability and ranking blocks score the CONFIDENCE attached to the
 * directional call, so they are computed over directional observations only.
 * Scoring confidence on bars where the engine declined to call anything would
 * be asking how sure it was about a decision it did not make.
 */
export function evaluateSlice(
  dimension: string,
  slice: string,
  observations: readonly Observation[],
  horizonBars: number,
  options: EvaluateOptions,
): SliceMetrics {
  const cfg = options.prediction ?? DEFAULT_PREDICTION_CONFIG
  const bins = options.calibrationBins ?? 10
  const eps = options.logLossEps ?? 1e-15
  const minBinCount = options.minBinCount ?? 10

  const withOutcome = observations.filter(o => {
    const r = o.outcomes[horizonBars]
    return r !== null && r !== undefined
  })

  // ── Forced up/down ────────────────────────────────────────────────────────
  const upTrue: boolean[] = []
  const upPred: boolean[] = []
  for (const o of withOutcome) {
    upTrue.push(o.outcomes[horizonBars]!.up)
    upPred.push(predictedUp(o))
  }

  // ── Three-way ─────────────────────────────────────────────────────────────
  const sigTrue: string[] = []
  const sigPred: string[] = []
  for (const o of withOutcome) {
    sigTrue.push(realisedSignal(o.outcomes[horizonBars]!, cfg.neutralBandAtr))
    sigPred.push(predictedSignal(o))
  }

  // ── Directional ───────────────────────────────────────────────────────────
  const directional = withOutcome.filter(hasDirection)
  const dirCorrect: boolean[] = []
  const dirPredAll: boolean[] = []
  const probs: number[] = []
  const probOutcomes: boolean[] = []
  const scored: ScoredOutcome[] = []

  for (const o of directional) {
    const outcome = o.outcomes[horizonBars]!
    const sign = directionSign(o)
    const correct = sign * outcome.forwardReturn > 0
    dirCorrect.push(correct)
    // Every directional observation is a "predicted positive": the engine
    // asserted its call would be right. TP/FP then read as right/wrong calls,
    // and FN/TN are structurally zero — stated here so the zeros in the report
    // are not read as a measurement failure.
    dirPredAll.push(true)

    const p = directionalProbability(o, cfg)
    if (p !== null) { probs.push(p); probOutcomes.push(correct) }

    const stop = o.features.stop_distance_atr
    scored.push({
      score: typeof o.features.confidence_score === 'number' ? o.features.confidence_score : NaN,
      hit: correct,
      returnPct: sign * outcome.forwardReturn,
      r: typeof stop === 'number' && Number.isFinite(stop) && stop > 0
        ? (sign * outcome.forwardReturnAtr) / stop
        : null,
    })
  }
  const scoredClean = scored.filter(s => Number.isFinite(s.score))

  // ── Trading ───────────────────────────────────────────────────────────────
  const built = buildTrades(observations, horizonBars)

  return {
    slice,
    dimension,
    horizonBars,
    n: withOutcome.length,
    binaryUpDown: binaryFromLabels(upTrue, upPred),
    threeWay: multiclassMetrics(confusionMatrix(sigTrue, sigPred, SIGNALS)),
    directional: binaryFromLabels(dirCorrect, dirPredAll),
    probability: probabilityMetrics(probs, probOutcomes, bins, eps, minBinCount),
    ranking: rankingMetrics(scoredClean, { minBucketCount: options.minBucketCount }),
    trading: tradingMetrics(built.trades, {
      overlapping: options.overlapping,
      excludedNoStop: built.excludedNoStop,
      excludedNoOutcome: built.excludedNoOutcome,
      excludedNoDirection: built.excludedNoDirection,
    }),
  }
}

/** The full report: every slice × every horizon. */
export function evaluate(
  observations: readonly Observation[],
  options: EvaluateOptions & { sourceName: string; generatedAt: string },
): MetricsReport {
  const horizons = options.horizons ?? inferHorizons(observations)
  const slices = buildSlices(observations, options)
  const out: SliceMetrics[] = []
  for (const s of slices) {
    for (const h of horizons) out.push(evaluateSlice(s.dimension, s.slice, s.observations, h, options))
  }
  return {
    generatedAt: options.generatedAt,
    sourceName: options.sourceName,
    totalObservations: observations.length,
    horizons: [...horizons],
    predictionMapping: (options.prediction ?? DEFAULT_PREDICTION_CONFIG).scoreToProbability === DEFAULT_PREDICTION_CONFIG.scoreToProbability
      ? 'score / 10 (the unaided reading; not a mapping the engine defines)'
      : 'custom',
    overlapping: options.overlapping,
    slices: out,
  }
}

/** Horizons present in the corpus, ascending. */
export function inferHorizons(observations: readonly Observation[]): number[] {
  const s = new Set<number>()
  for (const o of observations) for (const k of Object.keys(o.outcomes)) s.add(Number(k))
  return [...s].sort((a, b) => a - b)
}
