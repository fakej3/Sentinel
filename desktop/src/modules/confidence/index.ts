import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceConfig, ConfidenceResult, ConfidencePenalty, ConfidenceWarning } from './types'
import { DEFAULT_CONFIDENCE_CONFIG } from './config'
import { scoreEvidence, normalize } from './compute/score'
import { scoreToGrade } from './compute/grade'
import { computeBreakdown } from './compute/breakdown'
import { computeAnalysisQuality } from './compute/quality'
import { computeTrust } from './compute/trust'
import { applyCeilingPenalty } from './compute/ceiling'

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
  let score = normalize(penalizedPoints, cfg.normalizationDivisor, cfg.gradeThresholds.veryStrong)

  const bullishConfidence = normalize(bullishRawPoints, cfg.normalizationDivisor, cfg.gradeThresholds.veryStrong)
  const bearishConfidence = normalize(bearishRawPoints, cfg.normalizationDivisor, cfg.gradeThresholds.veryStrong)

  // ── Step 3: Compute trust (before penalties so we can use trust level) ────

  const trust = computeTrust(analysis, validation)

  // ── Step 4: Apply validation penalties, contradiction penalty, and trust penalty ──
  //
  // ORDERING. This chain mixes two kinds of operation: SUBTRACTIONS (warning,
  // volatility shock) and CAPS (critical, weak trend, near-zero ATR), plus two
  // ceiling penalties. They do not commute — from a score of 9.0, capping at
  // 6.5 then subtracting 2.5 gives 4.0, while subtracting first then capping
  // gives 6.5.
  //
  // What IS guaranteed, and is asserted as an invariant test: every step is
  // monotonically non-increasing. Therefore each cap binds as an upper bound on
  // the FINAL score no matter where it sits in the chain — nothing downstream
  // can lift the score back above it. The current order also means every
  // subtraction is genuinely applied rather than being absorbed by a later cap,
  // so both "weak trend limits confidence to 6.5" and "a shock costs 2.5" hold
  // simultaneously; reordering would silently discard one of them.
  //
  // The total MAGNITUDE, however, is order-dependent, and no backtest exists to
  // say which composition is right. The order is therefore inherited, not
  // justified. It is documented here rather than changed, because reordering
  // would be tuning behaviour on taste. Logged as technical debt.

  const penalties: ConfidencePenalty[] = []
  const warnings: ConfidenceWarning[] = []

  // Contradiction penalty (directional markets only).
  //
  // Contradictions are subtracted in RAW-POINT space, before normalisation, so
  // their effect on the published score is the difference between the score
  // with and without that subtraction — not the normalised penalty amount.
  //
  // The previous code reported `normalize(contradictionPoints * factor)`, which
  // is a different quantity: normalisation is non-linear above the knee, so
  // normalize(a − b) ≠ normalize(a) − normalize(b). Because
  // confidence-explanation.ts sums every scoreReduction and prints it as
  // "N penalty(ies) reduced the score by X pts", that mismatch was shown to the
  // user as fact. Measured over 150 synthetic markets: 96% of runs disagreed,
  // the worst by 1.95 points on a 0–10 scale.
  //
  // Taking the difference of the two normalised scores is exact by
  // construction and needs no constant.
  if (contradictionPoints > 0 && (trend.includes('bullish') || trend.includes('bearish'))) {
    const unpenalised = normalize(directedPoints, cfg.normalizationDivisor, cfg.gradeThresholds.veryStrong)
    const scoreReduction = unpenalised - score
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
    const requested = validation.warningCount * cfg.warningScorePenalty
    // Report what was APPLIED, not what was requested. The floor at 0 can
    // absorb part of a penalty, and every reported reduction has to reconcile
    // against the actual movement of the score — see the reconciliation
    // invariant test.
    const applied = score - Math.max(0, score - requested)
    score -= applied
    // A score already at 0 absorbs nothing. Reporting a 0.00-point penalty
    // would put a line in the audit trail describing an effect that did not
    // happen — the same class of error as the contradiction figure above.
    if (applied > 0) {
      penalties.push({
        source: 'validation_warning',
        description: `${validation.warningCount} validation warning(s) reduce score by ${applied.toFixed(2)} points`,
        scoreReduction: applied,
      })
    }
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

  // ── Trust-based overconfidence penalty (Module 32 Part 7) ─────────────────
  // Applied through the monotone ceiling helper: identical to the previous
  // behaviour for scores at or above the threshold (all existing calibration
  // preserved), and no longer discontinuous just below it.
  if (trust.level === 'low' || trust.level === 'medium') {
    const penalty  = trust.level === 'low' ? cfg.trustPenaltyLow : cfg.trustPenaltyMedium
    const adjusted = applyCeilingPenalty(score, cfg.overconfidenceThreshold, penalty)
    if (adjusted < score) {
      const reduction = score - adjusted
      score = adjusted
      penalties.push({
        source: trust.level === 'low' ? 'trust_low' : 'trust_medium',
        description: `${trust.level === 'low' ? 'Low' : 'Medium'} data trust (${trust.score.toFixed(0)}% of quality checks passed) — score reduced by ${reduction.toFixed(2)} to prevent overstatement`,
        scoreReduction: reduction,
      })
      if (trust.level === 'low') {
        warnings.push({
          message: `Data trust is low (${trust.score.toFixed(0)}%) — fewer quality checks passed than expected; treat this score with caution`,
          source: 'data_quality',
        })
      }
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
  // Same monotone ceiling treatment as the trust penalty above.
  const sparseAdjusted = hasSparseData
    ? applyCeilingPenalty(score, cfg.overconfidenceThreshold, cfg.sparseDataPenalty)
    : score
  if (sparseAdjusted < score) {
    const reduction = score - sparseAdjusted
    score = sparseAdjusted
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
    // Applied, not requested — same reconciliation reason as the warning penalty.
    const applied = score - Math.max(0, score - cfg.volatilityShockPenalty)
    score -= applied
    if (applied > 0) {
      penalties.push({
        source: 'volatility_shock',
        description: `${change24h.toFixed(1)}% 24h move exceeds shock threshold (${cfg.volatilityShockThreshold}%); score reduced by ${applied.toFixed(2)} — reversal risk is elevated after extreme sessions`,
        scoreReduction: applied,
      })
    }
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
