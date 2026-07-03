import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceConfig, ConfidenceResult, ConfidencePenalty, ConfidenceWarning } from './types'
import { DEFAULT_CONFIDENCE_CONFIG } from './config'
import { scoreEvidence, normalize } from './compute/score'
import { scoreToGrade } from './compute/grade'

/**
 * Module 8 — Confidence Engine.
 *
 * Computes a 0–10 confidence score from the evidence items assembled by
 * Module 6 (MarketAnalysisResult.evidence) and applies score adjustments
 * for structural validation issues from Module 7 (ValidationResult).
 *
 * Pure, deterministic, no side effects, no network calls.
 * ENGINE_RULES.md §11.
 */
export function computeConfidence(
  analysis: MarketAnalysisResult,
  validation: ValidationResult,
  config?: Partial<ConfidenceConfig>,
): ConfidenceResult {
  const cfg: ConfidenceConfig = {
    ...DEFAULT_CONFIDENCE_CONFIG,
    ...config,
    factorWeights: {
      ...DEFAULT_CONFIDENCE_CONFIG.factorWeights,
      ...config?.factorWeights,
    },
    gradeThresholds: {
      ...DEFAULT_CONFIDENCE_CONFIG.gradeThresholds,
      ...config?.gradeThresholds,
    },
  }

  // ── Step 1: Score evidence items ──────────────────────────────────────────

  const { rawPoints, bullishRawPoints, bearishRawPoints, reasons } =
    scoreEvidence(analysis.evidence, cfg)

  // ── Step 2: Normalize raw points to 0–10 ─────────────────────────────────

  let score = normalize(Math.abs(rawPoints), cfg.normalizationDivisor)
  const bullishConfidence = normalize(bullishRawPoints, cfg.normalizationDivisor)
  const bearishConfidence = normalize(bearishRawPoints, cfg.normalizationDivisor)

  // ── Step 3: Apply validation penalties ───────────────────────────────────

  const penalties: ConfidencePenalty[] = []
  const warnings: ConfidenceWarning[] = []

  if (validation.warningCount > 0) {
    const reduction = validation.warningCount * cfg.warningScorePenalty
    score = Math.max(0, score - reduction)
    penalties.push({
      source: 'validation_warning',
      description: `${validation.warningCount} validation warning(s) reduce score by ${reduction.toFixed(2)} points`,
      scoreReduction: reduction,
    })
  }

  if (validation.criticalCount > 0) {
    if (score > cfg.criticalScoreCap) {
      const reduction = score - cfg.criticalScoreCap
      penalties.push({
        source: 'validation_critical',
        description: `${validation.criticalCount} critical validation issue(s) cap score at ${cfg.criticalScoreCap}`,
        scoreReduction: reduction,
      })
      score = cfg.criticalScoreCap
    }
    warnings.push({
      message: `${validation.criticalCount} critical structural issue(s) detected — score reliability is reduced`,
      source: 'validation',
    })
  }

  if (!validation.passed && validation.criticalCount === 0 && validation.warningCount > 0) {
    warnings.push({
      message: 'Validation did not pass — warnings are present; treat score with caution',
      source: 'validation',
    })
  }

  // ── Step 4: Clamp and grade ───────────────────────────────────────────────

  score = Math.min(10, Math.max(0, score))

  const grade = scoreToGrade(score, cfg)

  return {
    score,
    grade,
    bullishConfidence,
    bearishConfidence,
    reasons,
    penalties,
    warnings,
  }
}

export type {
  ConfidenceResult,
  ConfidenceGrade,
  ConfidenceReason,
  ConfidencePenalty,
  ConfidenceWarning,
  ConfidenceConfig,
} from './types'

export { DEFAULT_CONFIDENCE_CONFIG } from './config'
