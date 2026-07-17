import type { MarketAnalysisResult } from '../../analysis/types'
import type { ValidationIssue, ValidationConfig } from '../types'

export function checkCompleteness(
  result: MarketAnalysisResult,
  cfg: ValidationConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // ── Price ─────────────────────────────────────────────────────────────────

  if (result.price.current <= 0) {
    issues.push({
      severity: 'critical',
      category: 'completeness',
      field: 'price.current',
      message: 'Current price must be a positive number',
      expected: '> 0',
      actual: String(result.price.current),
    })
  }

  // ── Symbol ────────────────────────────────────────────────────────────────

  if (!result.symbol || result.symbol.trim().length === 0) {
    issues.push({
      severity: 'critical',
      category: 'completeness',
      field: 'symbol',
      message: 'Symbol must be a non-empty string',
      expected: 'non-empty string',
      actual: JSON.stringify(result.symbol),
    })
  }

  // ── Evidence ──────────────────────────────────────────────────────────────

  if (result.evidence.length < cfg.minEvidenceItems) {
    issues.push({
      severity: 'critical',
      category: 'completeness',
      field: 'evidence',
      message: `Evidence list has ${result.evidence.length} item(s); minimum is ${cfg.minEvidenceItems}`,
      expected: `>= ${cfg.minEvidenceItems}`,
      actual: String(result.evidence.length),
    })
  }

  if (cfg.minHighImpactEvidence > 0) {
    const highCount = result.evidence.filter(e => e.impact === 'high').length
    if (highCount < cfg.minHighImpactEvidence) {
      issues.push({
        severity: 'warning',
        category: 'completeness',
        field: 'evidence',
        message: `Evidence has ${highCount} high-impact item(s); minimum is ${cfg.minHighImpactEvidence}`,
        expected: `>= ${cfg.minHighImpactEvidence}`,
        actual: String(highCount),
      })
    }
  }

  // ── ConditionsMet ranges ──────────────────────────────────────────────────

  const { bullishConditionsMet, bearishConditionsMet, neutralConditionsMet } = result.fullTrend

  if (bullishConditionsMet < 0 || bullishConditionsMet > 5) {
    issues.push({
      severity: 'critical',
      category: 'completeness',
      field: 'fullTrend.bullishConditionsMet',
      message: `bullishConditionsMet must be in [0, 5]; got ${bullishConditionsMet}`,
      expected: '0–5',
      actual: String(bullishConditionsMet),
    })
  }

  if (bearishConditionsMet < 0 || bearishConditionsMet > 5) {
    issues.push({
      severity: 'critical',
      category: 'completeness',
      field: 'fullTrend.bearishConditionsMet',
      message: `bearishConditionsMet must be in [0, 5]; got ${bearishConditionsMet}`,
      expected: '0–5',
      actual: String(bearishConditionsMet),
    })
  }

  if (neutralConditionsMet < 0 || neutralConditionsMet > 4) {
    issues.push({
      severity: 'critical',
      category: 'completeness',
      field: 'fullTrend.neutralConditionsMet',
      message: `neutralConditionsMet must be in [0, 4]; got ${neutralConditionsMet}`,
      expected: '0–4',
      actual: String(neutralConditionsMet),
    })
  }

  return issues
}
