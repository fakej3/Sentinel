import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceConfig, ConfidenceResult, ConfidencePenalty, ConfidenceWarning } from './types'
import { DEFAULT_CONFIDENCE_CONFIG } from './config'
import { scoreEvidence, normalize } from './compute/score'
import { scoreToGrade } from './compute/grade'
import { computeBreakdown } from './compute/breakdown'
import { computeAnalysisQuality } from './compute/quality'
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

  const { rawPoints, bullishRawPoints, bearishRawPoints, neutralContribution, reasons } =
    scoreEvidence(analysis.evidence, cfg)

  // ── Step 2: Direction-aware normalization ─────────────────────────────────
  //
  // For bullish/bearish trends: the dominant-side evidence drives the score;
  //   neutral items (ADX, volume classification, consolidation) add at half
  //   strength because they confirm trend conviction regardless of direction.
  //   Opposing directional evidence applies a configurable contradiction penalty.
  // For ranging: preserve the original abs(net) behaviour (rawPoints already
  //   includes neutral weights) so existing calibration remains unchanged.

  const trend = analysis.fullTrend.trend
  const penaltyFactor = cfg.contradictionPenaltyFactor
  const neutralFactor = cfg.neutralStrengthFactor

  let directedPoints: number
  let contradictionPoints: number

  if (trend.includes('bullish')) {
    directedPoints = bullishRawPoints + neutralContribution * neutralFactor
    contradictionPoints = bearishRawPoints
  } else if (trend.includes('bearish')) {
    directedPoints = bearishRawPoints + neutralContribution * neutralFactor
    contradictionPoints = bullishRawPoints
  } else {
    directedPoints = Math.abs(rawPoints)
    contradictionPoints = 0
  }

  const penalizedPoints = Math.max(0, directedPoints - contradictionPoints * penaltyFactor)
  let score = normalize(penalizedPoints, cfg.normalizationDivisor)

  const bullishConfidence = normalize(bullishRawPoints, cfg.normalizationDivisor)
  const bearishConfidence = normalize(bearishRawPoints, cfg.normalizationDivisor)

  // ── Step 3: Compute trust (before penalties so we can use trust level) ────

  const trust = computeTrust(analysis, validation)

  // ── Step 4: Apply validation penalties, contradiction penalty, and trust penalty ──

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

  // Trust-based overconfidence penalty (Module 32 Part 7).
  // Only fires when score > overconfidenceThreshold (default 8.0) because lower
  // scores already signal uncertainty. Empirically confirmed: without this, a market
  // with only 3/7 trust factors (43%) still produces score 10.0.
  if (score > cfg.overconfidenceThreshold) {
    if (trust.level === 'low') {
      const reduction = cfg.trustPenaltyLow
      score = Math.max(0, score - reduction)
      penalties.push({
        source: 'trust_low',
        description: `Low data trust (${trust.score.toFixed(0)}% of quality checks passed) — score reduced by ${reduction.toFixed(2)} to prevent overstatement`,
        scoreReduction: reduction,
      })
      warnings.push({
        message: `Data trust is low (${trust.score.toFixed(0)}%) — fewer quality checks passed than expected; treat this score with caution`,
        source: 'data_quality',
      })
    } else if (trust.level === 'medium') {
      const reduction = cfg.trustPenaltyMedium
      score = Math.max(0, score - reduction)
      penalties.push({
        source: 'trust_medium',
        description: `Medium data trust (${trust.score.toFixed(0)}% of quality checks passed) — score reduced by ${reduction.toFixed(2)}`,
        scoreReduction: reduction,
      })
    }
  }

  // Weak-trend cap: 'weak bullish' / 'weak bearish' markets have ambiguous direction —
  // a high score overstates certainty. Pure 'ranging' markets use the abs(net) path
  // which already limits scores via contradictions, so they are excluded here.
  // Apply as a penalty so it shows in the audit trail.
  const isWeakDirectional = trend === 'weak bullish' || trend === 'weak bearish'
  if (isWeakDirectional && score > cfg.weakTrendScoreCap) {
    const reduction = score - cfg.weakTrendScoreCap
    penalties.push({
      source: 'weak_trend_cap',
      description: `${trend} trend — directional conviction is weak; score capped at ${cfg.weakTrendScoreCap} to prevent overstating certainty`,
      scoreReduction: reduction,
    })
    score = cfg.weakTrendScoreCap
    warnings.push({
      message: `Trend is ${trend} — direction is ambiguous; high confidence would overstate certainty in this setup`,
      source: 'data_quality',
    })
  }

  // Sparse data penalty: when EMA100 is unavailable (< ~100 candles), key trend and
  // structure signals are poorly established. Cap confidence when the dataset is thin.
  const emaContext = analysis.emaContext
  // EMA20 available but EMA100 not = 20–99 candles: genuine thin dataset.
  // When ALL EMAs are unavailable the data is either a stub or very new — skip penalty.
  const hasSparseData =
    emaContext.priceVsEMA20 !== 'unavailable' && emaContext.priceVsEMA100 === 'unavailable'
  if (hasSparseData && score > cfg.overconfidenceThreshold) {
    const reduction = cfg.sparseDataPenalty
    score = Math.max(0, score - reduction)
    penalties.push({
      source: 'sparse_data',
      description: `EMA100 unavailable — fewer than ~100 candles; score reduced by ${reduction.toFixed(2)} to reflect data immaturity`,
      scoreReduction: reduction,
    })
    warnings.push({
      message: 'Dataset is thin (fewer than ~100 candles) — EMA100/200 and swing structure are unreliable; treat this score with caution',
      source: 'data_quality',
    })
  }

  // Volatility-shock penalty: after a large single-session move (|change24h| above the
  // configured threshold), reversal risk is elevated even when indicator alignment is
  // strong. Apply unconditionally (not gated on overconfidenceThreshold) because even
  // a 6.0 confidence score after a 20% crash overstates certainty about the next move.
  const change24h = Math.abs(analysis.price.change24hPercent)
  if (change24h > cfg.volatilityShockThreshold) {
    const reduction = cfg.volatilityShockPenalty
    score = Math.max(0, score - reduction)
    penalties.push({
      source: 'volatility_shock',
      description: `${change24h.toFixed(1)}% 24h move exceeds shock threshold (${cfg.volatilityShockThreshold}%); score reduced by ${reduction.toFixed(2)} — reversal risk is elevated after extreme sessions`,
      scoreReduction: reduction,
    })
    warnings.push({
      message: `Large 24h move (${change24h.toFixed(1)}%) — post-shock uncertainty is high; direction may reverse sharply. Reduce size and wait for the first retest candle to close.`,
      source: 'data_quality',
    })
  }

  // Near-zero ATR — stablecoin, peg, or market with no real price movement.
  // Technical signals from EMA cross, market structure, RSI, etc. are all noise
  // at this volatility level. Apply unconditionally (not gated on score level).
  const atrPct = analysis.price.atrPercent
  if (atrPct !== null && atrPct < cfg.nearZeroAtrThreshold && score > cfg.nearZeroAtrCap) {
    const reduction = score - cfg.nearZeroAtrCap
    score = cfg.nearZeroAtrCap
    penalties.push({
      source: 'near_zero_atr',
      description: `ATR of ${atrPct.toFixed(3)}% is below ${cfg.nearZeroAtrThreshold}% — market has no tradeable volatility (stablecoin/peg); all indicators are unreliable`,
      scoreReduction: reduction,
    })
    warnings.push({
      message: `Market ATR (${atrPct.toFixed(3)}%) is extremely low — this appears to be a stablecoin or pegged asset. No technical signal is reliable at this volatility level.`,
      source: 'data_quality',
    })
  }

  // ── Step 5: Clamp and grade ───────────────────────────────────────────────

  score = Math.min(10, Math.max(0, score))

  const grade = scoreToGrade(score, cfg)

  // ── Step 6: Breakdown and quality ────────────────────────────────────────

  const breakdown       = computeBreakdown(analysis.evidence, cfg, contradictionPoints)
  const analysisQuality = computeAnalysisQuality(analysis, cfg)

  const result: ConfidenceResult = {
    score,
    grade,
    bullishConfidence,
    bearishConfidence,
    neutralContribution,
    reasons,
    penalties,
    warnings,
    breakdown,
    analysisQuality,
    trust,
  }

  return result
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
  EvidenceQualityRating,
  EvidenceQuality,
  ConfluenceResult,
  ContradictionGroup,
  IndicatorReliabilityContext,
  AnalysisQuality,
} from './types'

export { DEFAULT_CONFIDENCE_CONFIG } from './config'
