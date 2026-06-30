import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult, ValidationConfig } from './types'
import { DEFAULT_VALIDATION_CONFIG } from './config'
import { checkCompleteness } from './validate/completeness'
import { checkConsistency } from './validate/consistency'
import { checkContradictions } from './validate/contradictions'
import { checkStructural } from './validate/structural'

export function validateAnalysis(
  result: MarketAnalysisResult,
  config?: Partial<ValidationConfig>,
): ValidationResult {
  const cfg: ValidationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...config }

  const issues = [
    ...checkCompleteness(result, cfg),
    ...checkConsistency(result, cfg),
    ...checkContradictions(result),
    ...checkStructural(result, cfg),
  ]

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount  = issues.filter(i => i.severity === 'warning').length
  const infoCount     = issues.filter(i => i.severity === 'info').length

  const hasFatalIssues = criticalCount > 0 || (cfg.failOnWarning && warningCount > 0)
  const passed = !hasFatalIssues
  const clean  = issues.length === 0

  let summary: string
  if (clean) {
    summary = 'Analysis passed all validation checks.'
  } else if (!passed) {
    summary = `Analysis failed validation: ${criticalCount} critical issue(s), ${warningCount} warning(s).`
  } else {
    summary = `Analysis passed with ${warningCount} warning(s).`
  }

  return { passed, clean, issues, criticalCount, warningCount, infoCount, summary }
}

export type { ValidationResult, ValidationConfig, ValidationIssue, ValidationSeverity, ValidationCategory } from './types'
export { DEFAULT_VALIDATION_CONFIG } from './config'
