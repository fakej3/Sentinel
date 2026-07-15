import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, EvidenceQuality, EvidenceQualityRating } from '../types'
import { FACTOR_CATEGORY } from './breakdown'
import type { EvidenceFactor } from '../../analysis/evidence-factors'

function rateCount(count: number): EvidenceQualityRating {
  if (count >= 3) return 'excellent'
  if (count >= 2) return 'good'
  if (count === 1) return 'moderate'
  return 'poor'
}

/**
 * Rates how much evidence is present in each signal category.
 * Counts only factors that are registered in both the weight map and category map.
 */
export function computeEvidenceQuality(
  evidence: readonly EvidenceItem[],
  cfg: ConfidenceConfig,
): EvidenceQuality {
  const counts: Record<string, number> = {
    trendQuality: 0, momentum: 0, volume: 0, marketStructure: 0, srPositioning: 0,
  }

  for (const item of evidence) {
    if (cfg.factorWeights[item.factor] === undefined) continue
    const category = FACTOR_CATEGORY[item.factor as EvidenceFactor]
    if (category !== undefined) counts[category]++
  }

  return {
    trendQuality:    rateCount(counts.trendQuality),
    momentum:        rateCount(counts.momentum),
    volume:          rateCount(counts.volume),
    marketStructure: rateCount(counts.marketStructure),
    srPositioning:   rateCount(counts.srPositioning),
  }
}
