import type { MarketAnalysisResult, FullTrendLabel, EvidenceImpact } from '../../analysis/types'
import type { ValidationIssue } from '../types'

function critical(field: string, message: string, expected: string, actual: string): ValidationIssue {
  return { severity: 'critical', category: 'contradiction', field, message, expected, actual }
}

function warning(field: string, message: string, expected: string, actual: string): ValidationIssue {
  return { severity: 'warning', category: 'contradiction', field, message, expected, actual }
}

/** Re-applies M6's exact label assignment logic (ENGINE_RULES.md §1, §14.1) */
function deriveTrendLabel(
  bullish: number,
  bearish: number,
  neutral: number,
): FullTrendLabel {
  if (bullish === 5) return 'strong bullish'
  if (bullish >= 3 && bullish > bearish) return 'moderate bullish'
  if (bearish === 5) return 'strong bearish'
  if (bearish >= 3 && bearish > bullish) return 'moderate bearish'
  if (neutral >= 3) return 'ranging'
  if (bullish > bearish && bullish > 0) return 'weak bullish'
  if (bearish > bullish && bearish > 0) return 'weak bearish'
  return 'ranging'
}

const IMPACT_ORDER: Record<EvidenceImpact, number> = { high: 0, medium: 1, low: 2 }

export function checkContradictions(
  result: MarketAnalysisResult,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { conditions, bullishConditionsMet, bearishConditionsMet, neutralConditionsMet, trend } = result.fullTrend
  const emaContext = result.emaContext

  // ── priceAbove/BelowAllEMAs = AND over the AVAILABLE EMAs ─────────────────
  //
  // These conditions degrade gracefully: they are evaluated over whichever
  // EMAs exist, requiring at least two. An unavailable EMA makes its
  // individual priceAboveEMA{p} / priceBelowEMA{p} condition false, so the
  // old "AND of all four" rule declared correct degraded output a critical
  // contradiction on any dataset shorter than ~200 candles. Availability is
  // read from emaContext, which is the canonical representation of it.
  const emaAvailability = [
    { above: conditions.priceAboveEMA20,  below: conditions.priceBelowEMA20,  avail: emaContext.priceVsEMA20  !== 'unavailable' },
    { above: conditions.priceAboveEMA50,  below: conditions.priceBelowEMA50,  avail: emaContext.priceVsEMA50  !== 'unavailable' },
    { above: conditions.priceAboveEMA100, below: conditions.priceBelowEMA100, avail: emaContext.priceVsEMA100 !== 'unavailable' },
    { above: conditions.priceAboveEMA200, below: conditions.priceBelowEMA200, avail: emaContext.priceVsEMA200 !== 'unavailable' },
  ]
  const availableEmaConds = emaAvailability.filter(e => e.avail)
  const enoughEmas = availableEmaConds.length >= 2

  const expectedAboveAll = enoughEmas && availableEmaConds.every(e => e.above)
  if (conditions.priceAboveAllEMAs !== expectedAboveAll) {
    issues.push(critical(
      'fullTrend.conditions.priceAboveAllEMAs',
      `priceAboveAllEMAs is ${conditions.priceAboveAllEMAs} but the AND over the ${availableEmaConds.length} available priceAboveEMA* conditions is ${expectedAboveAll}`,
      String(expectedAboveAll), String(conditions.priceAboveAllEMAs),
    ))
  }

  const expectedBelowAll = enoughEmas && availableEmaConds.every(e => e.below)
  if (conditions.priceBelowAllEMAs !== expectedBelowAll) {
    issues.push(critical(
      'fullTrend.conditions.priceBelowAllEMAs',
      `priceBelowAllEMAs is ${conditions.priceBelowAllEMAs} but the AND over the ${availableEmaConds.length} available priceBelowEMA* conditions is ${expectedBelowAll}`,
      String(expectedBelowAll), String(conditions.priceBelowAllEMAs),
    ))
  }

  // ── Price cannot be both above and below all EMAs ─────────────────────────

  if (conditions.priceAboveAllEMAs && conditions.priceBelowAllEMAs) {
    issues.push(critical(
      'fullTrend.conditions',
      'priceAboveAllEMAs and priceBelowAllEMAs are both true — price cannot be simultaneously above and below all EMAs',
      'at most one true', 'both true',
    ))
  }

  // ── EMA stack cannot be both bullish and bearish order ────────────────────

  if (conditions.emaInBullishOrder && conditions.emaInBearishOrder) {
    issues.push(critical(
      'fullTrend.conditions',
      'emaInBullishOrder and emaInBearishOrder are both true — impossible for a strict ordering',
      'at most one true', 'both true',
    ))
  }

  // ── RSI overlap zone: both bullish and bearish RSI conditions satisfied ───
  // Default config: rsiBullishMin=55, rsiBearishMax=45 — creates a neutral gap
  // (45–55) where neither condition fires. This warning only triggers when a
  // custom config creates an actual overlap (e.g. rsiBullishMin=45, rsiBearishMax=55).

  if (conditions.rsiSupportsBullish && conditions.rsiSupportsBearish) {
    issues.push(warning(
      'fullTrend.conditions',
      `rsiSupportsBullish and rsiSupportsBearish are both true — RSI is in the overlap zone where both thresholds are satisfied; RSI contributes one point to each direction`,
      'at most one true', 'both true',
    ))
  }

  // ── bullishConditionsMet must equal the actual count of satisfied conditions

  const actualBullish = [
    conditions.priceAboveAllEMAs,
    conditions.emaInBullishOrder,
    conditions.hasConsistentHHHL,
    conditions.rsiSupportsBullish,
    conditions.macdBullish,
  ].filter(Boolean).length

  if (bullishConditionsMet !== actualBullish) {
    issues.push(critical(
      'fullTrend.bullishConditionsMet',
      `bullishConditionsMet is ${bullishConditionsMet} but the sum of the 5 bullish condition booleans is ${actualBullish}`,
      String(actualBullish), String(bullishConditionsMet),
    ))
  }

  // ── bearishConditionsMet must equal the actual count of satisfied conditions

  const actualBearish = [
    conditions.priceBelowAllEMAs,
    conditions.emaInBearishOrder,
    conditions.hasConsistentLHLL,
    conditions.rsiSupportsBearish,
    conditions.macdBearish,
  ].filter(Boolean).length

  if (bearishConditionsMet !== actualBearish) {
    issues.push(critical(
      'fullTrend.bearishConditionsMet',
      `bearishConditionsMet is ${bearishConditionsMet} but the sum of the 5 bearish condition booleans is ${actualBearish}`,
      String(actualBearish), String(bearishConditionsMet),
    ))
  }

  // ── neutralConditionsMet must equal the actual count ──────────────────────

  const actualNeutral = [
    conditions.adxBelowWeakThreshold,
    conditions.rsiInNeutralRange,
    conditions.noConsistentStructure,
    conditions.priceBetweenEMAsWithoutClearOrder,
  ].filter(Boolean).length

  if (neutralConditionsMet !== actualNeutral) {
    issues.push(critical(
      'fullTrend.neutralConditionsMet',
      `neutralConditionsMet is ${neutralConditionsMet} but the sum of the 4 neutral condition booleans is ${actualNeutral}`,
      String(actualNeutral), String(neutralConditionsMet),
    ))
  }

  // ── Trend label must be consistent with conditionsMet counts ──────────────

  const expectedTrend = deriveTrendLabel(bullishConditionsMet, bearishConditionsMet, neutralConditionsMet)
  if (trend !== expectedTrend) {
    issues.push(critical(
      'fullTrend.trend',
      `trend is '${trend}' but ENGINE_RULES §1 label assignment from bullish=${bullishConditionsMet}, bearish=${bearishConditionsMet}, neutral=${neutralConditionsMet} gives '${expectedTrend}'`,
      expectedTrend, trend,
    ))
  }

  // ── Evidence must be sorted: high → medium → low ─────────────────────────

  const evidence = result.evidence
  for (let i = 1; i < evidence.length; i++) {
    const prev = IMPACT_ORDER[evidence[i - 1].impact]
    const curr = IMPACT_ORDER[evidence[i].impact]
    if (curr < prev) {
      issues.push(warning(
        `evidence[${i}]`,
        `Evidence item at index ${i} (impact='${evidence[i].impact}') appears after item at index ${i - 1} (impact='${evidence[i - 1].impact}') — must be sorted high → medium → low`,
        'sorted order',
        `'${evidence[i - 1].impact}' before '${evidence[i].impact}'`,
      ))
      break // Report only the first violation
    }
  }

  return issues
}
