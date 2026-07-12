import type { MarketAnalysisResult } from '../../analysis/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { TradePlan, TradeSetupQuality, MultiTimeframeAgreement } from '../types'

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
  mtfAgreement?: MultiTimeframeAgreement,
): TradePlan {
  const { fullTrend, srContext, price } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance
  const currentZone       = supportResistance.currentZone

  // When price is AT a zone, nearestSupport/nearestResistance is null (filtered out).
  // Fall back to currentZone so we can still establish trade levels.
  const effectiveSupport    = nearestSupport    ?? (currentZone?.type === 'support'    ? currentZone : null)
  const effectiveResistance = nearestResistance ?? (currentZone?.type === 'resistance' ? currentZone : null)

  // ── Entry zone ────────────────────────────────────────────────────────────
  let entryZone: TradePlan['entryZone'] = null
  if (isBullish && effectiveSupport) {
    entryZone = { lower: effectiveSupport.lower, upper: effectiveSupport.upper }
  } else if (isBearish && effectiveResistance) {
    entryZone = { lower: effectiveResistance.lower, upper: effectiveResistance.upper }
  }

  // ── Invalidation level ────────────────────────────────────────────────────
  // Bullish: a close below support breaks the thesis.
  // Bearish: a close above resistance breaks the thesis.
  let invalidationLevel: number | null = null
  if (isBullish && effectiveSupport) {
    invalidationLevel = Math.round(effectiveSupport.lower * 0.995 * 100) / 100
  } else if (isBearish && effectiveResistance) {
    invalidationLevel = Math.round(effectiveResistance.upper * 1.005 * 100) / 100
  }

  // ── Target level ──────────────────────────────────────────────────────────
  // Use zone boundary (not center) to avoid inflating RR with an optimistic midpoint target.
  let targetLevel: number | null = null
  if (isBullish && nearestResistance) {
    targetLevel = nearestResistance.lower
  } else if (isBearish && nearestSupport) {
    targetLevel = nearestSupport.upper
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
    confidence, validation, mtfAgreement, trend,
  )

  // excellent / good / average are actionable; poor / avoid / no_setup are not
  const actionable = setupQuality === 'excellent' || setupQuality === 'good' || setupQuality === 'average'

  // ── Patience message ──────────────────────────────────────────────────────
  const patienceMessage = buildPatienceMessage(
    setupQuality, trend, confidence, srContext, riskRewardRatio, validation,
    entryZone, invalidationLevel, targetLevel,
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
  mtfAgreement?: MultiTimeframeAgreement,
  trend?: string,
): { setupQuality: TradeSetupQuality; setupQualityReason: string } {
  // Weak trend (weak bullish / weak bearish / ranging) reduces setup reliability.
  // Evidence: 8/10 synthetic validation losses had weak trend labels despite high
  // confidence scores — weak-trend excellent scored 83.3% WR vs 96.6% for strong/moderate.
  const isWeakTrend = trend !== undefined && (trend.includes('weak') || trend === 'ranging')
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

  const mtfConflict = mtfAgreement?.agreement === 'strong_conflict'
  const mtfNote = mtfConflict
    ? ` — MTF conflict: ${mtfAgreement!.conflictingCount} opposing timeframe(s) reduce quality`
    : ''
  const weakTrendNote = isWeakTrend ? ' — weak trend reduces setup reliability' : ''

  // 5. Excellent: RR ≥ 2.0, confidence ≥ 7.5, trust ≥ 70 — all conditions met
  if (riskRewardRatio >= 2.0 && confidence.score >= 7.5 && confidence.trust.score >= 70) {
    if (isWeakTrend) {
      return {
        setupQuality: 'good',
        setupQualityReason: `Setup downgraded: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${weakTrendNote}${mtfNote}`,
      }
    }
    if (mtfConflict) {
      return {
        setupQuality: 'good',
        setupQualityReason: `Excellent setup degraded by multi-timeframe conflict: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${mtfNote}`,
      }
    }
    return {
      setupQuality: 'excellent',
      setupQualityReason: `Excellent setup: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}, trust ${confidence.trust.score}%`,
    }
  }

  // 6. Good: RR ≥ 1.5 and confidence ≥ 5.0
  if (confidence.score >= 5.0) {
    if (isWeakTrend) {
      return {
        setupQuality: 'average',
        setupQualityReason: `Setup downgraded: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${weakTrendNote}${mtfNote}`,
      }
    }
    if (mtfConflict) {
      return {
        setupQuality: 'average',
        setupQualityReason: `Good setup degraded by multi-timeframe conflict: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${mtfNote}`,
      }
    }
    return {
      setupQuality: 'good',
      setupQualityReason: `Good setup: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}`,
    }
  }

  // 7. Average: RR meets threshold but confidence is below 5.0 — marginal
  if (mtfConflict) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `Marginal setup degraded by multi-timeframe conflict: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${mtfNote}`,
    }
  }
  return {
    setupQuality: 'average',
    setupQualityReason: `Marginal setup: RR ${riskRewardRatio.toFixed(2)} meets threshold but confidence ${confidence.score.toFixed(1)} is below optimal`,
  }
}

function fmtPrice(price: number): string {
  if (price >= 10_000) return price.toFixed(0)
  if (price >= 100)    return price.toFixed(2)
  if (price >= 1)      return price.toFixed(4)
  return price.toFixed(6)
}

function buildPatienceMessage(
  setupQuality: TradeSetupQuality,
  trend: string,
  confidence: ConfidenceResult,
  srContext: MarketAnalysisResult['srContext'],
  riskRewardRatio: number | null,
  validation: ValidationResult,
  entryZone: TradePlan['entryZone'],
  invalidationLevel: number | null,
  targetLevel: number | null,
): string {
  switch (setupQuality) {
    case 'no_setup':
      return 'No high-quality trade setup currently exists — wait for support/resistance structure to form'

    case 'avoid':
      if (riskRewardRatio !== null && riskRewardRatio < 1.5) {
        return confidence.score >= 6.0
          ? `Confidence is high but risk/reward is ${riskRewardRatio.toFixed(2)}:1 (minimum 1.5:1) — wait for a better entry zone`
          : `Risk/reward is ${riskRewardRatio.toFixed(2)}:1 — below minimum 1.5:1; wait for price to approach a higher-probability zone`
      }
      return 'Trade geometry is invalid — stop, entry, and target are not in the correct order; wait for structure to clarify'

    case 'poor':
      if (validation.criticalCount > 0) {
        return 'Critical data quality issues are present — avoid trading until the analysis clears'
      }
      if (confidence.score < 4.0) {
        return `Signal confidence is ${confidence.score.toFixed(1)}/10 — too low for a reliable setup; wait for a clearer directional move`
      }
      return 'Data quality is insufficient for a reliable setup — wait for more price history to accumulate'

    case 'excellent': {
      if (entryZone !== null && invalidationLevel !== null && targetLevel !== null) {
        const mid = fmtPrice((entryZone.lower + entryZone.upper) / 2)
        const stop = fmtPrice(invalidationLevel)
        const target = fmtPrice(targetLevel)
        const rrStr = riskRewardRatio !== null ? `, RR ${riskRewardRatio.toFixed(2)}:1` : ''
        return `High-quality setup — enter near ${mid}, stop at ${stop}, target ${target}${rrStr}`
      }
      return trend.includes('strong')
        ? 'High-quality setup in a strong trend — enter at the zone boundary with a defined stop and target'
        : 'High-quality setup — enter on approach to the entry zone with disciplined risk management'
    }

    case 'good': {
      const isWeak = trend.includes('weak') || trend === 'ranging'
      if (entryZone !== null && invalidationLevel !== null && targetLevel !== null) {
        const mid = fmtPrice((entryZone.lower + entryZone.upper) / 2)
        const stop = fmtPrice(invalidationLevel)
        const target = fmtPrice(targetLevel)
        const rrStr = riskRewardRatio !== null ? `, RR ${riskRewardRatio.toFixed(2)}:1` : ''
        if (isWeak) {
          return `Good setup in a weak trend — wait for a confirmation candle before entering; enter near ${mid}, stop at ${stop}, target ${target}${rrStr}`
        }
        if (srContext.approachingSupport || srContext.approachingResistance) {
          return `Good setup near a key level — wait for a reaction, then enter near ${mid} with stop at ${stop}, target ${target}${rrStr}`
        }
        return `Good setup — enter near ${mid}, stop at ${stop}, target ${target}${rrStr}`
      }
      if (isWeak) {
        return 'Good setup but trend strength is weak — wait for trend confirmation before entering'
      }
      if (srContext.approachingSupport || srContext.approachingResistance) {
        return 'Good setup approaching a key level — wait for a reaction here before entering'
      }
      return trend.includes('moderate')
        ? 'Good setup in a moderate trend — wait for price to reach the entry zone before committing'
        : 'Good setup — enter at the entry zone with a clearly defined stop loss'
    }

    case 'average': {
      const isWeak = trend.includes('weak') || trend === 'ranging'
      if (isWeak) {
        return 'Weak trend — if entering, wait for a strong confirmation candle, use reduced position size, and strict stop placement'
      }
      return 'Marginal setup — if entering, use reduced size and strict risk management; wait for confirmation if possible'
    }
  }
}
