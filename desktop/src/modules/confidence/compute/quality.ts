import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceConfig, AnalysisQuality } from '../types'
import { computeConfluence } from './confluence'
import { groupContradictions } from './contradiction-groups'
import { computeEvidenceQuality } from './evidence-quality'
import { computeReliability } from './reliability'

/**
 * Computes an internal 0–10 Analysis Quality Score by synthesising:
 *   - Confluence (40%): how many categories agree with the dominant trend
 *   - Evidence breadth (40%): how many categories have known evidence
 *   - Contradiction penalty (20%): reduced by strong opposing clusters
 */
export function computeAnalysisQuality(
  analysis: MarketAnalysisResult,
  cfg: ConfidenceConfig,
): AnalysisQuality {
  const trend    = analysis.fullTrend.trend
  const evidence = analysis.evidence

  const confluence   = computeConfluence(evidence, cfg, trend)
  const contradictions = groupContradictions(evidence, cfg, trend)
  const evidenceQuality = computeEvidenceQuality(evidence, cfg)
  const reliability  = computeReliability(analysis)

  const ratings = Object.values(evidenceQuality)
  const categoriesWithData = ratings.filter(r => r !== 'poor').length
  const breadthScore = (categoriesWithData / 5) * 10

  const strongContradictions = contradictions.filter(c => c.severity === 'strong').length
  const moderateContradictions = contradictions.filter(c => c.severity === 'moderate').length
  const contradictionPenalty = Math.min(4, strongContradictions * 2 + moderateContradictions * 0.5)

  const rawScore =
    confluence.score * 0.4 +
    breadthScore * 0.4 +
    Math.max(0, 10 - contradictionPenalty * 2.5) * 0.2

  const score = Math.min(10, Math.max(0, Math.round(rawScore * 10) / 10))

  return { score, confluence, evidenceQuality, contradictions, reliability }
}
