import type { ConfidenceResult } from '../../confidence/types'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceExplanation } from '../types'

/**
 * Builds a structured explanation of what drove the confidence score.
 * Maps directly to existing confidence.reasons / penalties / analysisQuality.
 * Never invents reasons — every output traces back to existing data.
 */
export function computeConfidenceExplanation(
  confidence: ConfidenceResult,
  analysis: MarketAnalysisResult,
): ConfidenceExplanation {
  const { reasons, penalties, score, grade, analysisQuality, trust } = confidence

  // Split reasons into positive vs negative contributors by direction
  const trend = analysis.fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  const positive = reasons
    .filter(r => {
      if (isBullish) return r.direction === 'bullish' || (r.direction === 'neutral' && r.points > 0)
      if (isBearish) return r.direction === 'bearish' || (r.direction === 'neutral' && r.points > 0)
      return r.points > 0
    })
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 5)
    .map(r => ({
      label: r.factor,
      detail: `+${Math.abs(r.points).toFixed(1)} pts (${r.direction})`,
    }))

  const negative = reasons
    .filter(r => {
      if (isBullish) return r.direction === 'bearish' || (r.direction === 'neutral' && r.points < 0)
      if (isBearish) return r.direction === 'bullish' || (r.direction === 'neutral' && r.points < 0)
      return r.points < 0
    })
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 5)
    .map(r => ({
      label: r.factor,
      detail: `-${Math.abs(r.points).toFixed(1)} pts (${r.direction})`,
    }))

  // Add penalty contributors to negative
  for (const p of penalties.slice(0, 3)) {
    negative.push({
      label: p.source === 'validation_critical' ? 'Critical validation issue' : p.description,
      detail: `-${p.scoreReduction.toFixed(1)} pts penalty`,
    })
  }

  // Build rationale from existing data
  const gradeLabel = gradeText(grade)
  const trustNote = trust.level === 'low'
    ? ' Trust in the underlying data is low'
    : trust.level === 'medium'
      ? ' Data trust is moderate'
      : ' Data trust is high'

  const contradictionNote = analysisQuality.contradictions.length > 0
    ? ` ${analysisQuality.contradictions.length} contradiction group(s) were detected.`
    : ''

  const penaltyNote = penalties.length > 0
    ? ` ${penalties.length} penalty(ies) reduced the score by ${penalties.reduce((s, p) => s + p.scoreReduction, 0).toFixed(1)} pts.`
    : ''

  const confluenceNote = analysisQuality.confluence.agreementRatio >= 0.7
    ? ' Strong multi-category agreement.'
    : analysisQuality.confluence.agreementRatio <= 0.3
      ? ' Weak cross-category agreement.'
      : ''

  const rationale =
    `Confidence is ${gradeLabel} at ${score.toFixed(1)}/10.` +
    trustNote + '.' +
    contradictionNote +
    penaltyNote +
    confluenceNote

  return { positiveContributors: positive, negativeContributors: negative, rationale }
}

function gradeText(grade: ConfidenceResult['grade']): string {
  switch (grade) {
    case 'very_strong': return 'very strong'
    case 'strong':      return 'strong'
    case 'moderate':    return 'moderate'
    case 'mixed':       return 'mixed'
    case 'weak':        return 'weak'
  }
}
