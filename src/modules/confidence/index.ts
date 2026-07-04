import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceConfig, ConfidenceResult, ConfidencePenalty, ConfidenceWarning } from './types'
import { DEFAULT_CONFIDENCE_CONFIG } from './config'
import { scoreEvidence, normalize } from './compute/score'
import { scoreToGrade } from './compute/grade'
import { computeBreakdown } from './compute/breakdown'
import { computeTrust } from './compute/trust'

/**
 * Module 8 — Confidence Engine.
 *
 * Computes a 0–10 confidence score representing how certain Sentinel is that its
 * conclusion is correct — not how bullish or bearish the market is.
 *
 * Direction-aware: in bullish/bearish markets the dominant-side evidence drives the
 * score; opposing evidence applies a configurable contradiction penalty.
 * In ranging markets the legacy abs(net) path is used, preserving existing behaviour.
 *
 * Pure, deterministic, no side effects, no network calls.
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

  // ── Step 2: Direction-aware normalization ─────────────────────────────────
  //
  // For bullish trends: score = dominant (bullish) evidence minus
  //   a fraction of contradicting (bearish) evidence.
  // For bearish trends: symmetric — bearish is dominant, bullish contradicts.
  // For ranging: preserve the original abs(net) behaviour so existing tests
  //   and calibration remain unchanged.

  const trend = analysis.fullTrend.trend
  const penaltyFactor = cfg.contradictionPenaltyFactor

  let directedPoints: number
  let contradictionPoints: number

  if (trend.includes('bullish')) {
    directedPoints = bullishRawPoints
    contradictionPoints = bearishRawPoints
  } else if (trend.includes('bearish')) {
    directedPoints = bearishRawPoints
    contradictionPoints = bullishRawPoints
  } else {
    directedPoints = Math.abs(rawPoints)
    contradictionPoints = 0
  }

  const penalizedPoints = Math.max(0, directedPoints - contradictionPoints * penaltyFactor)
  let score = normalize(penalizedPoints, cfg.normalizationDivisor)

  const bullishConfidence = normalize(bullishRawPoints, cfg.normalizationDivisor)
  const bearishConfidence = normalize(bearishRawPoints, cfg.normalizationDivisor)

  // ── Step 3: Apply validation penalties + contradiction penalty ────────────

  const penalties: ConfidencePenalty[] = []
  const warnings: ConfidenceWarning[] = []

  // Contradiction penalty (directional markets only)
  if (contradictionPoints > 0 && (trend.includes('bullish') || trend.includes('bearish'))) {
    const reductionAmount = contradictionPoints * penaltyFactor
    const scoreReduction = normalize(reductionAmount, cfg.normalizationDivisor)
    if (scoreReduction > 0.01) {
      const side = trend.includes('bullish') ? 'bearish' : 'bullish'
      penalties.push({
        source: 'contradiction',
        description: `${contradictionPoints} pts of ${side} evidence contradicts the trend — score reduced by ${scoreReduction.toFixed(2)}`,
        scoreReduction,
      })
    }
  }

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

  // ── Step 5: Breakdown and trust ───────────────────────────────────────────

  const breakdown = computeBreakdown(analysis.evidence, cfg, contradictionPoints)
  const trust = computeTrust(analysis, validation)

  return {
    score,
    grade,
    bullishConfidence,
    bearishConfidence,
    reasons,
    penalties,
    warnings,
    breakdown,
    trust,
  }
}

export type {
  ConfidenceResult,
  ConfidenceGrade,
  ConfidenceReason,
  ConfidencePenalty,
  ConfidenceWarning,
  ConfidenceConfig,
  ConfidenceBreakdown,
  TrustFactor,
  TrustResult,
} from './types'

export { DEFAULT_CONFIDENCE_CONFIG } from './config'
