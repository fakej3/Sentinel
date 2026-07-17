import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceResult } from '../confidence/types'
import type { WriterConfig, WriterInput, GeneratedAnalysis, WriterMetadata } from './types'
import { DEFAULT_WRITER_CONFIG } from './config'
import { buildCriticalStubs } from './sections'
import { buildAllSections, composeReport } from './compose'

export type { WriterTemplate, WriterVerbosity, WriterInput, WriterConfig, WriterMetadata, GeneratedAnalysis, BinancePost } from './types'
export { buildBinancePost } from './binance-post'
export type { BinancePostInput } from './binance-post'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Module 9 — AI Writing Engine.
 *
 * Generates a human-readable market analysis report from structured module outputs.
 * Pure function: deterministic, no side effects, no network calls, no timestamps.
 *
 * When validation has critical issues, all section content is minimal and
 * fullReport contains only the validation warning.
 */
export function generateAnalysis(
  input: WriterInput,
  config?: Partial<WriterConfig>,
): GeneratedAnalysis {
  const cfg: WriterConfig = { ...DEFAULT_WRITER_CONFIG, ...config }
  const { analysis, validation, confidence } = input

  const metadata = buildMetadata(analysis, confidence, validation, cfg)

  // Critical validation gate — skip full section building
  if (validation.criticalCount > 0) {
    const stubs = buildCriticalStubs(validation)
    return {
      ...stubs,
      fullReport: stubs.validationSection,
      metadata,
    }
  }

  const sections = buildAllSections(analysis, validation, confidence, cfg)

  const rawReport = composeReport(sections, cfg.template)
  const fullReport =
    rawReport.length > cfg.maxReportLength
      ? rawReport.slice(0, cfg.maxReportLength - 3) + '...'
      : rawReport

  return {
    headline: sections.headline,
    summary: sections.summary,
    trendSection: sections.trendSection,
    indicatorSection: sections.indicatorSection,
    marketStructureSection: sections.marketStructureSection,
    supportResistanceSection: sections.supportResistanceSection,
    volumeSection: sections.volumeSection,
    riskSection: sections.riskSection,
    confidenceSection: cfg.includeConfidenceSection ? sections.confidenceSection : '',
    validationSection: cfg.includeValidationSection ? sections.validationSection : '',
    conclusion: sections.conclusion,
    fullReport,
    metadata,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMetadata(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  validation: ValidationResult,
  cfg: WriterConfig,
): WriterMetadata {
  const bullishCount = analysis.evidence.filter(e => e.direction === 'bullish').length
  const bearishCount = analysis.evidence.filter(e => e.direction === 'bearish').length
  const neutralCount = analysis.evidence.filter(e => e.direction === 'neutral').length

  return {
    template: cfg.template,
    symbol: analysis.symbol,
    timeframe: analysis.timeframe,
    confidenceScore: confidence.score,
    confidenceGrade: confidence.grade,
    validationPassed: validation.passed,
    validationClean: validation.clean,
    evidenceCount: analysis.evidence.length,
    bullishFactorCount: bullishCount,
    bearishFactorCount: bearishCount,
    neutralFactorCount: neutralCount,
  }
}
