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

  // ── priceAboveAllEMAs must be the AND of all four individual conditions ────

  const expectedAboveAll =
    conditions.priceAboveEMA20 &&
    conditions.priceAboveEMA50 &&
    conditions.priceAboveEMA100 &&
    conditions.priceAboveEMA200

  if (conditions.priceAboveAllEMAs !== expectedAboveAll) {
    issues.push(critical(
      'fullTrend.conditions.priceAboveAllEMAs',
      `priceAboveAllEMAs is ${conditions.priceAboveAllEMAs} but the AND of all four priceAboveEMA* conditions is ${expectedAboveAll}`,
      String(expectedAboveAll), String(conditions.priceAboveAllEMAs),
    ))
  }

  // ── priceBelowAllEMAs must be the AND of all four individual conditions ────

  const expectedBelowAll =
    conditions.priceBelowEMA20 &&
    conditions.priceBelowEMA50 &&
    conditions.priceBelowEMA100 &&
    conditions.priceBelowEMA200

  if (conditions.priceBelowAllEMAs !== expectedBelowAll) {
    issues.push(critical(
      'fullTrend.conditions.priceBelowAllEMAs',
      `priceBelowAllEMAs is ${conditions.priceBelowAllEMAs} but the AND of all four priceBelowEMA* conditions is ${expectedBelowAll}`,
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
