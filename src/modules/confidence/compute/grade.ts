import type { ConfidenceConfig } from '../types'
import type { ConfidenceGrade } from '../types'

export function scoreToGrade(score: number, cfg: ConfidenceConfig): ConfidenceGrade {
  if (score >= cfg.gradeThresholds.veryStrong) return 'very_strong'
  if (score >= cfg.gradeThresholds.strong)     return 'strong'
  if (score >= cfg.gradeThresholds.moderate)   return 'moderate'
  if (score >= cfg.gradeThresholds.mixed)      return 'mixed'
  return 'weak'
}
