import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, ConfidenceReason } from '../types'

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
    if (weight === undefined) continue

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

export function normalize(rawPoints: number, divisor: number): number {
  return Math.min(10, Math.max(0, rawPoints / divisor))
}
