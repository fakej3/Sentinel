/**
 * The mapping from engine output to prediction. The load-bearing assumption of
 * the entire evaluation, kept in one file so it can be argued with.
 *
 * SENTINEL DOES NOT EMIT PROBABILITIES. `confidence.score` is a 0–10 measure of
 * how internally consistent the evidence is; nothing in the engine claims it is
 * P(correct). Scoring it as a probability therefore tests an INTERPRETATION,
 * not a claim the engine made — and it is the interpretation every reader
 * applies, because a 0–10 "confidence" invites exactly that reading.
 *
 * So the mapping is explicit, named, and swappable, and every report states
 * which one produced it. `score / 10` is the default because it is the reading
 * a user would apply unaided; if it turns out miscalibrated, the finding is
 * "the natural reading of the score is wrong", not "the engine lied".
 *
 * Two directions of prediction are supported, and they are NOT the same
 * question:
 *
 *   - DIRECTIONAL: the engine named long or short. Was the market's move in
 *     that direction? Scored only on bars where a direction exists.
 *   - UP/DOWN: force a binary up-call out of the engine's trend label, on every
 *     bar. Comparable to a coin, which is the point.
 */
import type { Observation } from '../types'
import type { HorizonOutcome } from '../types'

/** Buy / Sell / Neutral, the three-way call the engine actually makes. */
export type Signal = 'buy' | 'sell' | 'neutral'
export const SIGNALS: readonly Signal[] = ['buy', 'sell', 'neutral']

/** The realised three-way label, derived from the outcome under a dead-band. */
export const OUTCOME_LABELS: readonly Signal[] = ['buy', 'sell', 'neutral']

export interface PredictionConfig {
  /**
   * Maps the engine's 0–10 confidence score to a probability in [0, 1].
   *
   * PROVENANCE: not derived — it cannot be, because the engine never defined
   * one. `score / 10` is the identity reading a user applies. Phase 4 exists
   * to replace it with a fitted mapping; until then, this measures the
   * unaided reading.
   */
  readonly scoreToProbability: (score: number) => number
  /**
   * Half-width of the neutral dead-band for the REALISED three-way label, in
   * ATR units of forward return.
   *
   * PROVENANCE: derived from the engine's own risk unit. A move smaller than
   * the typical stop distance is not a directional outcome a trader could have
   * captured; Sentinel's own plans place the stop at 2 ATR in the large
   * majority of cases, and half of that is the smallest move that could reach
   * a 1:1 target. Set to 0 to score every non-zero move as directional.
   */
  readonly neutralBandAtr: number
}

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  scoreToProbability: (score: number) => Math.min(1, Math.max(0, score / 10)),
  neutralBandAtr: 1,
}

/** The engine's directional call, as a three-way signal. */
export function predictedSignal(o: Observation): Signal {
  const d = o.categorical.direction
  if (d === 'long') return 'buy'
  if (d === 'short') return 'sell'
  return 'neutral'
}

/**
 * The realised three-way label at a horizon.
 *
 * A move inside ±`neutralBandAtr` is `neutral`: neither a buy nor a sell was
 * the right call. Without the band, "neutral" could never be correct, and the
 * three-class confusion matrix would be structurally unable to reward the
 * engine for staying out — which is a real skill and one Sentinel exercises
 * often.
 */
export function realisedSignal(outcome: HorizonOutcome, neutralBandAtr: number): Signal {
  if (outcome.forwardReturnAtr > neutralBandAtr) return 'buy'
  if (outcome.forwardReturnAtr < -neutralBandAtr) return 'sell'
  return 'neutral'
}

/**
 * The engine's up/down call on every bar, from the trend label.
 *
 * `ranging` and any label the engine does not mark bullish or bearish resolve
 * to `false` (down). That is a deliberate asymmetry and it is reported: an
 * up/down score forces a call where the engine declined to make one, so the
 * up/down table understates the engine wherever it was right to abstain. The
 * directional table is the one that scores what the engine actually said.
 */
export function predictedUp(o: Observation): boolean {
  return o.categorical.trend.includes('bullish')
}

/** True when the engine named a tradeable direction. */
export function hasDirection(o: Observation): boolean {
  const d = o.categorical.direction
  return d === 'long' || d === 'short'
}

/** +1 for a long call, −1 for a short call, 0 when the engine named neither. */
export function directionSign(o: Observation): number {
  const d = o.categorical.direction
  return d === 'long' ? 1 : d === 'short' ? -1 : 0
}

/**
 * Probability that the DIRECTIONAL call is correct, under the configured
 * mapping.
 *
 * Uses the overall `confidence_score`, not `bullishConfidence` /
 * `bearishConfidence`: the overall score is what the UI shows and what a user
 * would read as "how sure is it". The directional sub-scores are recorded as
 * features and can be scored separately.
 */
export function directionalProbability(o: Observation, cfg: PredictionConfig): number | null {
  const s = o.features.confidence_score
  if (typeof s !== 'number' || !Number.isFinite(s)) return null
  return cfg.scoreToProbability(s)
}

/** Was the directional call correct at this horizon? null when no direction was named. */
export function directionalCorrect(o: Observation, outcome: HorizonOutcome): boolean | null {
  const sign = directionSign(o)
  if (sign === 0) return null
  return sign * outcome.forwardReturn > 0
}
