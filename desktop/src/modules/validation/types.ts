export type ValidationSeverity = 'critical' | 'warning' | 'info'
export type ValidationCategory = 'completeness' | 'consistency' | 'contradiction' | 'structural'

export interface ValidationIssue {
  severity: ValidationSeverity
  category: ValidationCategory
  /** Dot-path to the field in MarketAnalysisResult that this issue references */
  field: string
  message: string
  expected?: string
  actual?: string
}

export interface ValidationResult {
  /** true when there are no critical issues (and no warnings when failOnWarning is set) */
  passed: boolean
  /** true when there are no issues at all */
  clean: boolean
  issues: ValidationIssue[]
  criticalCount: number
  warningCount: number
  infoCount: number
  /** One-sentence human-readable outcome */
  summary: string
}

export interface ValidationConfig {
  /**
   * Relative tolerance for zone boundary geometry checks.
   * |actual − expected| / center < tolerance is acceptable.
   * Default: 0.001 (0.1% of center price)
   */
  zoneCenterTolerance: number
  /** Minimum evidence items required. Default: 3 */
  minEvidenceItems: number
  /** Minimum high-impact evidence items required. Default: 1 */
  minHighImpactEvidence: number
  /**
   * When true, warnings also set passed = false.
   * Default: false
   */
  failOnWarning: boolean
  // ── Thresholds that mirror M6 AnalysisConfig ─────────────────────────────
  // These must match the values passed to computeAnalysis so that M7 can
  // re-verify config-dependent conditions without re-running M6.
  /** RSI >= this supports the bullish condition. Default: 45 */
  rsiBullishMin: number
  /** RSI <= this supports the bearish condition. Default: 55 */
  rsiBearishMax: number
  /** ADX below this = weak trend. Default: 20 */
  adxWeakThreshold: number
  /** RSI neutral range lower bound. Default: 40 */
  rsiNeutralLow: number
  /** RSI neutral range upper bound. Default: 60 */
  rsiNeutralHigh: number
  /** Minimum HH and HL count for hasConsistentHHHL. Default: 2 */
  minBullishSwingsForTrend: number
  /** Minimum LH and LL count for hasConsistentLHLL. Default: 2 */
  minBearishSwingsForTrend: number
}
