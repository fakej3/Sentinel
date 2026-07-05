import type { MarketAnalysisResult } from '../../analysis/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { TradePlan, TradeSetupQuality } from '../types'

const CLEAN_VALIDATION: ValidationResult = {
  passed: true, clean: true, issues: [],
  criticalCount: 0, warningCount: 0, infoCount: 0,
  summary: '',
}

/**
 * Derives an actionable trade plan from the S/R context, trend, and confidence.
 *
 * Entry zone: for bullish trends, near nearest support; for bearish, near nearest resistance.
 * Invalidation: the level at which the directional thesis is broken.
 * Target: the nearest opposing S/R level.
 * RR: computed from the entry zone midpoint (not current price) so it reflects the actual
 *     risk of entering at the zone rather than wherever price is now.
 */
export function computeTradePlan(
  analysis: MarketAnalysisResult,
  supportResistance: SupportResistanceResult,
  confidence: ConfidenceResult,
  validation: ValidationResult = CLEAN_VALIDATION,
): TradePlan {
  const { fullTrend, srContext, price } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  // ── Entry zone ────────────────────────────────────────────────────────────
  let entryZone: TradePlan['entryZone'] = null
  if (isBullish && nearestSupport) {
    entryZone = { lower: nearestSupport.lower, upper: nearestSupport.upper }
  } else if (isBearish && nearestResistance) {
    entryZone = { lower: nearestResistance.lower, upper: nearestResistance.upper }
  }

  // ── Invalidation level ────────────────────────────────────────────────────
  // Bullish: a close below support breaks the thesis.
  // Bearish: a close above resistance breaks the thesis.
  let invalidationLevel: number | null = null
  if (isBullish && nearestSupport) {
    invalidationLevel = Math.round(nearestSupport.lower * 0.995 * 100) / 100
  } else if (isBearish && nearestResistance) {
    invalidationLevel = Math.round(nearestResistance.upper * 1.005 * 100) / 100
  }

  // ── Target level ──────────────────────────────────────────────────────────
  let targetLevel: number | null = null
  if (isBullish && nearestResistance) {
    targetLevel = nearestResistance.center
  } else if (isBearish && nearestSupport) {
    targetLevel = nearestSupport.center
  }

  // ── Geometry validation ───────────────────────────────────────────────────
  // Long: stop must be below zone, target must be above zone.
  // Short: stop must be above zone, target must be below zone.
  let geometryValid = false
  if (entryZone !== null && invalidationLevel !== null && targetLevel !== null) {
    if (isBullish) {
      geometryValid = invalidationLevel < entryZone.lower && targetLevel > entryZone.upper
    } else if (isBearish) {
      geometryValid = invalidationLevel > entryZone.upper && targetLevel < entryZone.lower
    }
  }

  // ── Risk / reward ratio (from entry zone midpoint) ────────────────────────
  // Using the zone midpoint as the reference rather than current price because
  // the plan describes where to enter, not where price is now.
  let riskRewardRatio: number | null = null
  if (entryZone !== null && invalidationLevel !== null && targetLevel !== null && geometryValid) {
    const entryMid = (entryZone.lower + entryZone.upper) / 2
    const risk     = Math.abs(entryMid - invalidationLevel)
    const reward   = Math.abs(targetLevel - entryMid)
    if (risk > 0) riskRewardRatio = Math.round((reward / risk) * 100) / 100
  }

  // ── Setup quality ─────────────────────────────────────────────────────────
  const { setupQuality, setupQualityReason } = classifySetupQuality(
    entryZone, invalidationLevel, targetLevel,
    geometryValid, riskRewardRatio,
    confidence, validation,
  )

  // excellent / good / average are actionable; poor / avoid / no_setup are not
  const actionable = setupQuality === 'excellent' || setupQuality === 'good' || setupQuality === 'average'

  // ── Patience message ──────────────────────────────────────────────────────
  const patienceMessage = buildPatienceMessage(
    setupQuality, trend, confidence, srContext, riskRewardRatio, validation,
  )

  // price is referenced here only to satisfy the linter — the variable is
  // kept in scope so future callers can add current-price context cheaply.
  void price

  return {
    entryZone,
    invalidationLevel,
    targetLevel,
    riskRewardRatio,
    setupQuality,
    setupQualityReason,
    actionable,
    patienceMessage,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifySetupQuality(
  entryZone: TradePlan['entryZone'],
  invalidationLevel: number | null,
  targetLevel: number | null,
  geometryValid: boolean,
  riskRewardRatio: number | null,
  confidence: ConfidenceResult,
  validation: ValidationResult,
): { setupQuality: TradeSetupQuality; setupQualityReason: string } {
  // 1. Insufficient S/R data — no trade levels available
  if (entryZone === null || invalidationLevel === null || targetLevel === null) {
    return {
      setupQuality: 'no_setup',
      setupQualityReason: 'Insufficient support/resistance data to establish trade levels',
    }
  }

  // 2. Geometry invalid — stop/entry/target are not in the correct order
  if (!geometryValid) {
    return {
      setupQuality: 'avoid',
      setupQualityReason: 'Trade geometry is invalid — stop, entry, and target are not in the correct order',
    }
  }

  // 3. RR too poor to justify the trade
  if (riskRewardRatio === null || riskRewardRatio < 1.5) {
    const rrStr = riskRewardRatio !== null ? riskRewardRatio.toFixed(2) : 'N/A'
    return {
      setupQuality: 'avoid',
      setupQualityReason: `Risk/reward of ${rrStr} is below the minimum threshold of 1.5`,
    }
  }

  // 4. Data quality issues undermine the analysis
  if (validation.criticalCount > 0) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `${validation.criticalCount} critical data quality issue(s) undermine the analysis`,
    }
  }
  if (confidence.score < 4.0) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `Confidence score of ${confidence.score.toFixed(1)} is too low for a reliable setup`,
    }
  }
  if (confidence.trust.score < 50) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `Data trust of ${confidence.trust.score}% is below the 50% reliability threshold`,
    }
  }

  // 5. Excellent: RR ≥ 2.0, confidence ≥ 7.5, trust ≥ 70 — all conditions met
  if (riskRewardRatio >= 2.0 && confidence.score >= 7.5 && confidence.trust.score >= 70) {
    return {
      setupQuality: 'excellent',
      setupQualityReason: `Excellent setup: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}, trust ${confidence.trust.score}%`,
    }
  }

  // 6. Good: RR ≥ 1.5 and confidence ≥ 5.0
  if (confidence.score >= 5.0) {
    return {
      setupQuality: 'good',
      setupQualityReason: `Good setup: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}`,
    }
  }

  // 7. Average: RR meets threshold but confidence is below 5.0 — marginal
  return {
    setupQuality: 'average',
    setupQualityReason: `Marginal setup: RR ${riskRewardRatio.toFixed(2)} meets threshold but confidence ${confidence.score.toFixed(1)} is below optimal`,
  }
}

function buildPatienceMessage(
  setupQuality: TradeSetupQuality,
  trend: string,
  confidence: ConfidenceResult,
  srContext: MarketAnalysisResult['srContext'],
  riskRewardRatio: number | null,
  validation: ValidationResult,
): string {
  switch (setupQuality) {
    case 'no_setup':
      return 'No high-quality trade setup currently exists — wait for support/resistance structure to form'

    case 'avoid':
      if (riskRewardRatio !== null && riskRewardRatio < 1.5) {
        return confidence.score >= 6.0
          ? 'Confidence is high but risk/reward is unfavorable — wait for price to pull back to a better entry zone'
          : 'Risk/reward is unfavorable — wait for price to approach a higher-probability entry zone'
      }
      return 'Trade geometry is invalid — stop, entry, and target levels cannot be trusted; wait for structure to clarify'

    case 'poor':
      if (validation.criticalCount > 0) {
        return 'Critical data quality issues are present — avoid trading until the analysis clears'
      }
      if (confidence.score < 4.0) {
        return 'Signal confidence too low — wait for a clearer directional move before committing capital'
      }
      return 'Data quality is insufficient for a reliable setup — wait for more price history to accumulate'

    case 'excellent':
      return trend.includes('strong')
        ? 'High-quality setup in a strong trend — enter at the zone boundary with a defined stop and target'
        : 'High-quality setup — enter on approach to the entry zone with disciplined risk management'

    case 'good':
      if (srContext.approachingSupport || srContext.approachingResistance) {
        return 'Good setup approaching a key level — wait for a reaction here before entering'
      }
      return trend.includes('moderate')
        ? 'Good setup in a moderate trend — wait for price to reach the entry zone before committing'
        : 'Good setup — enter at the entry zone with a clearly defined stop loss'

    case 'average':
      return 'Marginal setup — if entering, use reduced size and strict risk management; wait for confirmation if possible'
  }
}
