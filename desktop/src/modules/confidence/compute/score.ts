import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, ConfidenceReason } from '../types'
import { softClamp } from './saturation'

export interface ScoreBreakdown {
  /** Sum of all matched positive and negative weights */
  rawPoints: number
  /** Sum of weights for direction='bullish' items only */
  bullishRawPoints: number
  /** Sum of absolute weights for direction='bearish' items only */
  bearishRawPoints: number
  /** Signed sum of weights for direction='neutral' items (positive confirms trend, negative weakens it) */
  neutralContribution: number
  reasons: ConfidenceReason[]
}

/**
 * Walk the evidence array and accumulate weighted points.
 * Only factors whose canonical name exists in cfg.factorWeights contribute.
 * Returns raw (un-normalized) point totals and the full reason list.
 */
export function scoreEvidence(
  evidence: readonly EvidenceItem[],
  cfg: ConfidenceConfig,
): ScoreBreakdown {
  let rawPoints = 0
  let bullishRawPoints = 0
  let bearishRawPoints = 0
  let neutralContribution = 0
  const reasons: ConfidenceReason[] = []

  for (const item of evidence) {
    const weight = cfg.factorWeights[item.factor]
    if (weight === undefined || !Number.isFinite(weight)) continue

    rawPoints += weight

    if (item.direction === 'bullish') {
      bullishRawPoints += Math.abs(weight)
    } else if (item.direction === 'bearish') {
      bearishRawPoints += Math.abs(weight)
    } else {
      neutralContribution += weight
    }

    reasons.push({
      factor: item.factor,
      points: weight,
      direction: item.direction,
    })
  }

  return { rawPoints, bullishRawPoints, bearishRawPoints, neutralContribution, reasons }
}

/**
 * Maps a raw evidence-point total onto the 0–10 confidence scale.
 *
 * The hard `min(10, …)` this used to apply discarded all ordering above the
 * ceiling — measured at 32.5% of runs. `softClamp` is identity up to `knee` and
 * strictly increasing above it, so no two distinct evidence totals collapse to
 * the same score. See compute/saturation.ts for the derivation and for why the
 * alternatives (logistic, tanh, Bayesian) were rejected.
 *
 * `knee` is the caller's veryStrong grade threshold, which makes the transform
 * grade-preserving for every input.
 */
export function normalize(rawPoints: number, divisor: number, knee: number): number {
  return softClamp(rawPoints / divisor, knee)
}
