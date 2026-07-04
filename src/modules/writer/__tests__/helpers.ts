import type {
  MarketAnalysisResult,
  EvidenceItem,
  FullTrendLabel,
  EvidenceDirection,
} from '../../analysis/types'
import type { ConfidenceResult, ConfidenceGrade, ConfidenceBreakdown, TrustResult, AnalysisQuality } from '../../confidence/types'
import type { WriterInput } from '../types'
import {
  makeAnalysis as baseMakeAnalysis,
  cleanValidation,
  validationWithWarnings,
  validationWithCriticals,
} from '../../confidence/__tests__/helpers'

export { cleanValidation, validationWithWarnings, validationWithCriticals }

// ─── Evidence factories ───────────────────────────────────────────────────────

export function ev(
  factor: string,
  direction: EvidenceDirection = 'bullish',
  impact: EvidenceItem['impact'] = 'medium',
): EvidenceItem {
  return { factor, impact, description: `${factor}`, source: 'indicators', direction }
}

// ─── Confidence factory ───────────────────────────────────────────────────────

const ZERO_BREAKDOWN: ConfidenceBreakdown = {
  trendQuality: 0, momentum: 0, volume: 0,
  marketStructure: 0, srPositioning: 0, contradictions: 0,
}

const DEFAULT_TRUST: TrustResult = {
  score: 100, level: 'high',
  factors: [{ label: 'All checks passed', passed: true }],
  reductions: [],
}

const ZERO_ANALYSIS_QUALITY: AnalysisQuality = {
  score: 0,
  confluence: { score: 0, agreeing: [], disagreeing: [], agreementRatio: 0 },
  evidenceQuality: {
    trendQuality: 'poor', momentum: 'poor', volume: 'poor',
    marketStructure: 'poor', srPositioning: 'poor',
  },
  contradictions: [],
  reliability: { trendReliability: 5, oscillatorReliability: 5, volumeReliability: 5, note: 'Test default' },
}

export function makeConfidence(
  score: number,
  grade: ConfidenceGrade = 'moderate',
  overrides: Partial<ConfidenceResult> = {},
): ConfidenceResult {
  return {
    score,
    grade,
    bullishConfidence: score * 0.6,
    bearishConfidence: score * 0.2,
    reasons: [],
    penalties: [],
    warnings: [],
    breakdown: ZERO_BREAKDOWN,
    analysisQuality: ZERO_ANALYSIS_QUALITY,
    trust: DEFAULT_TRUST,
    ...overrides,
  }
}

// ─── Analysis stubs ───────────────────────────────────────────────────────────

export function makeAnalysis(
  evidence: EvidenceItem[] = [],
  trend: FullTrendLabel = 'ranging',
): MarketAnalysisResult {
  const base = baseMakeAnalysis(evidence)
  return {
    ...base,
    fullTrend: {
      ...base.fullTrend,
      trend,
      bullishConditionsMet: trend.includes('bullish') ? 3 : 0,
      bearishConditionsMet: trend.includes('bearish') ? 3 : 0,
      neutralConditionsMet: trend === 'ranging' ? 2 : 0,
    },
  }
}

// ─── WriterInput factories ────────────────────────────────────────────────────

export function makeBullishInput(): WriterInput {
  const evidence: EvidenceItem[] = [
    ev('Price above EMA20', 'bullish', 'high'),
    ev('Price above EMA50', 'bullish', 'high'),
    ev('RSI in healthy bullish zone', 'bullish', 'medium'),
    ev('MACD bullish bias', 'bullish', 'medium'),
  ]
  return {
    analysis: makeAnalysis(evidence, 'strong bullish'),
    validation: cleanValidation(),
    confidence: makeConfidence(8.0, 'strong', {
      reasons: [
        { factor: 'Price above EMA20', points: 10, direction: 'bullish' },
        { factor: 'Price above EMA50', points: 15, direction: 'bullish' },
        { factor: 'MACD bullish bias', points: 10, direction: 'bullish' },
      ],
    }),
  }
}

export function makeBearishInput(): WriterInput {
  const evidence: EvidenceItem[] = [
    ev('Price below EMA20', 'bearish', 'high'),
    ev('Price below EMA50', 'bearish', 'high'),
    ev('RSI weak bearish', 'bearish', 'medium'),
    ev('MACD bearish bias', 'bearish', 'medium'),
  ]
  return {
    analysis: makeAnalysis(evidence, 'strong bearish'),
    validation: cleanValidation(),
    confidence: makeConfidence(7.5, 'strong', {
      reasons: [
        { factor: 'Price below EMA20', points: -10, direction: 'bearish' },
        { factor: 'Price below EMA50', points: -15, direction: 'bearish' },
        { factor: 'MACD bearish bias', points: -10, direction: 'bearish' },
      ],
    }),
  }
}

export function makeNeutralInput(): WriterInput {
  const evidence: EvidenceItem[] = [
    ev('RSI neutral', 'neutral', 'low'),
    ev('ADX below weak threshold', 'neutral', 'low'),
  ]
  return {
    analysis: makeAnalysis(evidence, 'ranging'),
    validation: cleanValidation(),
    confidence: makeConfidence(4.5, 'mixed'),
  }
}

export function makeWarningInput(): WriterInput {
  const input = makeBullishInput()
  return {
    ...input,
    validation: validationWithWarnings(2),
    confidence: makeConfidence(6.5, 'moderate', {
      penalties: [{ source: 'validation_warning', description: 'Warning 1', scoreReduction: 0.5 }],
      warnings: [{ message: 'Validation warning detected', source: 'validation' }],
    }),
  }
}

export function makeCriticalInput(): WriterInput {
  return {
    analysis: makeAnalysis([], 'ranging'),
    validation: validationWithCriticals(1),
    confidence: makeConfidence(2.5, 'weak'),
  }
}
