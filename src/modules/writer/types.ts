import type { ConfidenceGrade } from '../confidence/types'
import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceResult } from '../confidence/types'

// ─── Template ─────────────────────────────────────────────────────────────────

/**
 * Selects which output format to produce.
 * All templates share the same underlying section builders — only
 * presentation (included sections, formatting) differs.
 */
export type WriterTemplate =
  | 'full'       // Complete structured report with all sections and headers
  | 'executive'  // Condensed professional overview (trend + confidence + risk)
  | 'summary'    // Single narrative paragraph
  | 'bullet'     // 5–7 key-fact bullet points
  | 'headline'   // Single title line only
  | 'social'     // Short post-format text

export type WriterVerbosity = 'concise' | 'standard' | 'detailed'

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * All structured module outputs required by Module 9.
 * The writer reads from these — never from raw candles.
 */
export interface WriterInput {
  /** Module 6 output — full analysis including evidence[], indicatorSummary, etc. */
  analysis: MarketAnalysisResult
  /** Module 7 output — validation pass/fail and issue list */
  validation: ValidationResult
  /** Module 8 output — confidence score, grade, reasons, penalties */
  confidence: ConfidenceResult
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface WriterMetadata {
  template: WriterTemplate
  symbol: string
  timeframe: string
  confidenceScore: number
  confidenceGrade: ConfidenceGrade
  validationPassed: boolean
  validationClean: boolean
  evidenceCount: number
  bullishFactorCount: number
  bearishFactorCount: number
  neutralFactorCount: number
}

/**
 * Complete output of Module 9 — AI Writing Engine.
 *
 * All section fields are always populated.
 * fullReport is assembled from those sections according to the selected template.
 * When validation is critically failed, most sections are minimal stubs and
 * fullReport contains only the validation warning.
 */
export interface GeneratedAnalysis {
  /** "[SYMBOL] [TF]: [Trend] — Confidence [N.N]/10" */
  headline: string
  /** Paragraph-length summary (template-dependent length) */
  summary: string
  trendSection: string
  indicatorSection: string
  marketStructureSection: string
  supportResistanceSection: string
  volumeSection: string
  riskSection: string
  confidenceSection: string
  /** Empty string when validation is clean; warning text otherwise */
  validationSection: string
  conclusion: string
  /** Full assembled report text in the selected template's format */
  fullReport: string
  metadata: WriterMetadata
  /** True when an AI provider enhanced the summary and conclusion fields */
  aiEnhanced?: boolean
}

// ─── Binance Post ────────────────────────────────────────────────────────────

/**
 * Mode 1 output — concise professional post suitable for Binance Square or
 * similar social/trading platforms.
 *
 * Every claim in `text` derives from a concrete computed field.
 * `evidenceCoverage` is always 100 because the template is fully deterministic —
 * it never invents facts.
 */
export interface BinancePost {
  /** Complete formatted post text ready for publication */
  text: string
  /** False when a blocking condition prevents safe publication */
  publishable: boolean
  /** Reason publication is blocked; null when publishable */
  blockReason: string | null
  /** Directional bias for this post */
  bias: 'bullish' | 'bearish' | 'neutral'
  /** Confidence score shown in the post */
  confidenceScore: number
  /**
   * Evidence coverage percentage.
   * Always 100 for this deterministic template — every claim maps to a computed field.
   */
  evidenceCoverage: 100
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface WriterConfig {
  template: WriterTemplate
  verbosity: WriterVerbosity
  /** Maximum character count for the summary field */
  maxSummaryLength: number
  /** Maximum character count for fullReport */
  maxReportLength: number
  includeValidationSection: boolean
  includeConfidenceSection: boolean
  includeWarnings: boolean
  /** Max evidence reasons displayed in the confidence section */
  maxReasonsDisplayed: number
  /** Max risk factors displayed in the risk section */
  maxRiskFactors: number
}
