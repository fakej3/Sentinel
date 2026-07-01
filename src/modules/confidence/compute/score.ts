import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, ConfidenceReason } from '../types'

export interface ScoreBreakdown {
  /** Sum of all matched positive and negative weights */
  rawPoints: number
  /** Sum of positive weights only */
  bullishRawPoints: number
  /** Sum of absolute values of negative weights only */
  bearishRawPoints: number
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
  const reasons: ConfidenceReason[] = []

  for (const item of evidence) {
    const weight = cfg.factorWeights[item.factor]
    if (weight === undefined) continue

    rawPoints += weight
    if (weight > 0) {
      bullishRawPoints += weight
    } else {
      bearishRawPoints += Math.abs(weight)
    }

    reasons.push({
      factor: item.factor,
      points: weight,
      direction: item.direction,
    })
  }

  return { rawPoints, bullishRawPoints, bearishRawPoints, reasons }
}

export function normalize(rawPoints: number, divisor: number): number {
  return Math.min(10, Math.max(0, rawPoints / divisor))
}
