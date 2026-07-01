import { describe, it, expect } from 'vitest'
import { generateAnalysis } from '../index'
import {
  buildHeadline,
  buildSummary,
  buildTrendSection,
  buildIndicatorSection,
  buildMarketStructureSection,
  buildSupportResistanceSection,
  buildVolumeSection,
  buildRiskSection,
  buildConfidenceSection,
  buildValidationSection,
  buildConclusion,
} from '../sections'
import { DEFAULT_WRITER_CONFIG } from '../config'
import {
  makeBullishInput,
  makeBearishInput,
  makeNeutralInput,
  makeWarningInput,
  makeCriticalInput,
  makeAnalysis,
  makeConfidence,
  cleanValidation,
  validationWithWarnings,
  validationWithCriticals,
  ev,
} from './helpers'

// ─── DEFAULT_WRITER_CONFIG ────────────────────────────────────────────────────

describe('DEFAULT_WRITER_CONFIG', () => {
  it('has template full', () => {
    expect(DEFAULT_WRITER_CONFIG.template).toBe('full')
  })

  it('has verbosity standard', () => {
    expect(DEFAULT_WRITER_CONFIG.verbosity).toBe('standard')
  })

  it('has positive maxSummaryLength', () => {
    expect(DEFAULT_WRITER_CONFIG.maxSummaryLength).toBeGreaterThan(0)
  })

  it('has positive maxReportLength', () => {
    expect(DEFAULT_WRITER_CONFIG.maxReportLength).toBeGreaterThan(0)
  })

  it('maxReportLength is greater than maxSummaryLength', () => {
    expect(DEFAULT_WRITER_CONFIG.maxReportLength).toBeGreaterThan(
      DEFAULT_WRITER_CONFIG.maxSummaryLength,
    )
  })

  it('includes validation section by default', () => {
    expect(DEFAULT_WRITER_CONFIG.includeValidationSection).toBe(true)
  })

  it('includes confidence section by default', () => {
    expect(DEFAULT_WRITER_CONFIG.includeConfidenceSection).toBe(true)
  })

  it('has positive maxReasonsDisplayed', () => {
    expect(DEFAULT_WRITER_CONFIG.maxReasonsDisplayed).toBeGreaterThan(0)
  })

  it('has positive maxRiskFactors', () => {
    expect(DEFAULT_WRITER_CONFIG.maxRiskFactors).toBeGreaterThan(0)
  })
})

// ─── buildHeadline ────────────────────────────────────────────────────────────

describe('buildHeadline', () => {
  it('contains symbol', () => {
    const input = makeBullishInput()
    const h = buildHeadline(input.analysis, input.confidence)
    expect(h).toContain('BTCUSDT')
  })

  it('contains timeframe', () => {
    const input = makeBullishInput()
    const h = buildHeadline(input.analysis, input.confidence)
    expect(h).toContain('1h')
  })

  it('contains trend label for bullish input', () => {
    const input = makeBullishInput()
    const h = buildHeadline(input.analysis, input.confidence)
    expect(h.toLowerCase()).toContain('bullish')
  })

  it('contains trend label for bearish input', () => {
    const input = makeBearishInput()
    const h = buildHeadline(input.analysis, input.confidence)
    expect(h.toLowerCase()).toContain('bearish')
  })

  it('contains confidence score', () => {
    const input = makeBullishInput()
    const h = buildHeadline(input.analysis, input.confidence)
    expect(h).toContain('8.0/10')
  })

  it('contains price', () => {
    const input = makeBullishInput()
    const h = buildHeadline(input.analysis, input.confidence)
    expect(h).toContain('100')
  })
})

// ─── buildSummary ─────────────────────────────────────────────────────────────

describe('buildSummary', () => {
  it('does not exceed maxSummaryLength', () => {
    const input = makeBullishInput()
    const s = buildSummary(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.length).toBeLessThanOrEqual(DEFAULT_WRITER_CONFIG.maxSummaryLength)
  })

  it('includes a direction word for bullish input', () => {
    const input = makeBullishInput()
    const s = buildSummary(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).toContain('bullish')
  })

  it('includes a direction word for bearish input', () => {
    const input = makeBearishInput()
    const s = buildSummary(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).toContain('bearish')
  })

  it('does not contain banned phrases — will', () => {
    const input = makeBullishInput()
    const s = buildSummary(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).not.toMatch(/\bwill\b/)
  })

  it('does not contain banned phrase — guaranteed', () => {
    const input = makeBullishInput()
    const s = buildSummary(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).not.toContain('guaranteed')
  })

  it('does not contain banned phrase — definitely', () => {
    const input = makeBullishInput()
    const s = buildSummary(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).not.toContain('definitely')
  })

  it('references 24h price change', () => {
    const input = makeBullishInput()
    const s = buildSummary(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s).toMatch(/24.hour|change/i)
  })
})

// ─── buildTrendSection ────────────────────────────────────────────────────────

describe('buildTrendSection', () => {
  it('includes trend direction for bullish input', () => {
    const input = makeBullishInput()
    const s = buildTrendSection(input.analysis)
    expect(s.toLowerCase()).toContain('bullish')
  })

  it('includes trend direction for bearish input', () => {
    const input = makeBearishInput()
    const s = buildTrendSection(input.analysis)
    expect(s.toLowerCase()).toContain('bearish')
  })

  it('includes EMA alignment information', () => {
    const input = makeBullishInput()
    const s = buildTrendSection(input.analysis)
    expect(s.toLowerCase()).toContain('ema')
  })

  it('includes bullish condition count', () => {
    const input = makeBullishInput()
    const s = buildTrendSection(input.analysis)
    expect(s).toContain('/5 bullish')
  })

  it('returns non-empty string', () => {
    const input = makeNeutralInput()
    expect(buildTrendSection(input.analysis).length).toBeGreaterThan(0)
  })
})

// ─── buildIndicatorSection ────────────────────────────────────────────────────

describe('buildIndicatorSection', () => {
  it('includes RSI label', () => {
    const input = makeBullishInput()
    const s = buildIndicatorSection(input.analysis)
    expect(s.toUpperCase()).toContain('RSI')
  })

  it('includes MACD label', () => {
    const input = makeBullishInput()
    const s = buildIndicatorSection(input.analysis)
    expect(s.toUpperCase()).toContain('MACD')
  })

  it('includes ADX label', () => {
    const input = makeBullishInput()
    const s = buildIndicatorSection(input.analysis)
    expect(s.toUpperCase()).toContain('ADX')
  })

  it('includes Bollinger label', () => {
    const input = makeBullishInput()
    const s = buildIndicatorSection(input.analysis)
    expect(s.toLowerCase()).toContain('bollinger')
  })

  it('includes StochRSI label', () => {
    const input = makeBullishInput()
    const s = buildIndicatorSection(input.analysis)
    expect(s.toLowerCase()).toContain('stochrsi')
  })

  it('says unavailable when RSI is null', () => {
    const input = makeBullishInput()
    const s = buildIndicatorSection(input.analysis)
    // base analysis has null RSI values
    expect(s.toLowerCase()).toContain('unavailable')
  })
})

// ─── buildMarketStructureSection ──────────────────────────────────────────────

describe('buildMarketStructureSection', () => {
  it('includes HH/HL/LH/LL labels', () => {
    const input = makeBullishInput()
    const s = buildMarketStructureSection(input.analysis)
    expect(s).toMatch(/HH|HL|LH|LL/)
  })

  it('includes trend direction', () => {
    const input = makeBullishInput()
    const s = buildMarketStructureSection(input.analysis)
    // base analysis has marketStructure.trend = 'ranging'
    expect(s.toLowerCase()).toContain('ranging')
  })

  it('returns non-empty string', () => {
    const input = makeNeutralInput()
    expect(buildMarketStructureSection(input.analysis).length).toBeGreaterThan(0)
  })
})

// ─── buildSupportResistanceSection ───────────────────────────────────────────

describe('buildSupportResistanceSection', () => {
  it('mentions support', () => {
    const input = makeBullishInput()
    const s = buildSupportResistanceSection(input.analysis)
    expect(s.toLowerCase()).toContain('support')
  })

  it('mentions resistance', () => {
    const input = makeBullishInput()
    const s = buildSupportResistanceSection(input.analysis)
    expect(s.toLowerCase()).toContain('resistance')
  })

  it('mentions active zone count', () => {
    const input = makeBullishInput()
    const s = buildSupportResistanceSection(input.analysis)
    expect(s.toLowerCase()).toContain('active zone')
  })

  it('returns non-empty string', () => {
    const input = makeNeutralInput()
    expect(buildSupportResistanceSection(input.analysis).length).toBeGreaterThan(0)
  })
})

// ─── buildVolumeSection ───────────────────────────────────────────────────────

describe('buildVolumeSection', () => {
  it('includes relative volume', () => {
    const input = makeBullishInput()
    const s = buildVolumeSection(input.analysis)
    expect(s.toLowerCase()).toContain('relative volume')
  })

  it('includes VWAP reference', () => {
    const input = makeBullishInput()
    const s = buildVolumeSection(input.analysis)
    expect(s.toUpperCase()).toContain('VWAP')
  })

  it('includes OBV reference', () => {
    const input = makeBullishInput()
    const s = buildVolumeSection(input.analysis)
    expect(s.toUpperCase()).toContain('OBV')
  })

  it('includes accumulation/distribution state', () => {
    const input = makeBullishInput()
    const s = buildVolumeSection(input.analysis)
    expect(s.toLowerCase()).toContain('accumulation')
  })

  it('returns non-empty string', () => {
    const input = makeNeutralInput()
    expect(buildVolumeSection(input.analysis).length).toBeGreaterThan(0)
  })
})

// ─── buildRiskSection ─────────────────────────────────────────────────────────

describe('buildRiskSection', () => {
  it('returns numbered list', () => {
    const input = makeBullishInput()
    const s = buildRiskSection(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s).toMatch(/^1\./)
  })

  it('includes at least one risk item', () => {
    const input = makeBullishInput()
    const s = buildRiskSection(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.length).toBeGreaterThan(0)
  })

  it('includes bearish evidence factors when present', () => {
    const input = makeBearishInput()
    const s = buildRiskSection(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).toContain('bearish signal')
  })

  it('mentions validation penalties when present', () => {
    const input = makeWarningInput()
    const s = buildRiskSection(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).toContain('validation')
  })

  it('does not exceed maxRiskFactors + 2 items', () => {
    const input = makeBullishInput()
    const s = buildRiskSection(input.analysis, input.confidence, DEFAULT_WRITER_CONFIG)
    const count = (s.match(/^\d+\./gm) ?? []).length
    expect(count).toBeLessThanOrEqual(DEFAULT_WRITER_CONFIG.maxRiskFactors + 2)
  })
})

// ─── buildConfidenceSection ───────────────────────────────────────────────────

describe('buildConfidenceSection', () => {
  it('includes score', () => {
    const confidence = makeConfidence(7.5, 'strong')
    const s = buildConfidenceSection(confidence, DEFAULT_WRITER_CONFIG)
    expect(s).toContain('7.5')
  })

  it('includes grade label', () => {
    const confidence = makeConfidence(7.5, 'strong')
    const s = buildConfidenceSection(confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).toContain('strong')
  })

  it('includes bullish sub-score', () => {
    const confidence = makeConfidence(7.5, 'strong')
    const s = buildConfidenceSection(confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).toContain('bullish')
  })

  it('includes reasons when present', () => {
    const confidence = makeConfidence(7.5, 'strong', {
      reasons: [{ factor: 'Price above EMA20', points: 10, direction: 'bullish' }],
    })
    const s = buildConfidenceSection(confidence, DEFAULT_WRITER_CONFIG)
    expect(s).toContain('Price above EMA20')
  })

  it('shows max maxReasonsDisplayed reasons', () => {
    const confidence = makeConfidence(7.5, 'strong', {
      reasons: [
        { factor: 'Factor A', points: 10, direction: 'bullish' },
        { factor: 'Factor B', points: 8, direction: 'bullish' },
        { factor: 'Factor C', points: 6, direction: 'bullish' },
        { factor: 'Factor D', points: 4, direction: 'bullish' },
      ],
    })
    const cfg = { ...DEFAULT_WRITER_CONFIG, maxReasonsDisplayed: 2 }
    const s = buildConfidenceSection(confidence, cfg)
    expect(s).not.toContain('Factor C')
    expect(s).not.toContain('Factor D')
  })

  it('includes penalty information when present', () => {
    const confidence = makeConfidence(5.0, 'moderate', {
      penalties: [{ source: 'validation_warning', description: 'Consistency warning', scoreReduction: 0.5 }],
    })
    const s = buildConfidenceSection(confidence, DEFAULT_WRITER_CONFIG)
    expect(s.toLowerCase()).toContain('penalt')
  })

  it('includes warning information when includeWarnings is true', () => {
    const confidence = makeConfidence(5.0, 'moderate', {
      warnings: [{ message: 'Low data quality', source: 'validation' }],
    })
    const s = buildConfidenceSection(confidence, { ...DEFAULT_WRITER_CONFIG, includeWarnings: true })
    expect(s.toLowerCase()).toContain('warning')
  })

  it('omits warnings when includeWarnings is false', () => {
    const confidence = makeConfidence(5.0, 'moderate', {
      warnings: [{ message: 'Low data quality', source: 'validation' }],
    })
    const s = buildConfidenceSection(confidence, { ...DEFAULT_WRITER_CONFIG, includeWarnings: false })
    expect(s.toLowerCase()).not.toContain('low data quality')
  })
})

// ─── buildValidationSection ───────────────────────────────────────────────────

describe('buildValidationSection', () => {
  it('returns empty string when validation is clean', () => {
    expect(buildValidationSection(cleanValidation())).toBe('')
  })

  it('includes warning count when warnings present', () => {
    const s = buildValidationSection(validationWithWarnings(3))
    expect(s).toContain('3')
    expect(s.toLowerCase()).toContain('warning')
  })

  it('includes CRITICAL label when critical issues present', () => {
    const s = buildValidationSection(validationWithCriticals(1))
    expect(s).toContain('CRITICAL')
  })

  it('is non-empty when validation has issues', () => {
    expect(buildValidationSection(validationWithWarnings(1)).length).toBeGreaterThan(0)
  })
})

// ─── buildConclusion ──────────────────────────────────────────────────────────

describe('buildConclusion', () => {
  it('includes evidence count', () => {
    const input = makeBullishInput()
    const s = buildConclusion(input.analysis, input.confidence)
    expect(s).toMatch(/\d+ evidence factor/)
  })

  it('includes financial advice disclaimer', () => {
    const input = makeBullishInput()
    const s = buildConclusion(input.analysis, input.confidence)
    expect(s.toLowerCase()).toContain('not financial advice')
  })

  it('does not contain banned phrase — buy', () => {
    const input = makeBullishInput()
    const s = buildConclusion(input.analysis, input.confidence)
    expect(s.toLowerCase()).not.toMatch(/\bbuy\b/)
  })

  it('does not contain banned phrase — sell', () => {
    const input = makeBearishInput()
    const s = buildConclusion(input.analysis, input.confidence)
    expect(s.toLowerCase()).not.toMatch(/\bsell\b/)
  })

  it('contains direction-aware hedging language for weak confidence', () => {
    const analysis = makeAnalysis([], 'ranging')
    const weakConfidence = makeConfidence(2.0, 'weak')
    const s = buildConclusion(analysis, weakConfidence)
    expect(s.toLowerCase()).toContain('tentative')
  })
})

// ─── generateAnalysis — metadata ──────────────────────────────────────────────

describe('generateAnalysis metadata', () => {
  it('metadata.symbol matches analysis.symbol', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.metadata.symbol).toBe(input.analysis.symbol)
  })

  it('metadata.timeframe matches analysis.timeframe', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.metadata.timeframe).toBe(input.analysis.timeframe)
  })

  it('metadata.confidenceScore matches confidence.score', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.metadata.confidenceScore).toBe(input.confidence.score)
  })

  it('metadata.confidenceGrade matches confidence.grade', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.metadata.confidenceGrade).toBe(input.confidence.grade)
  })

  it('metadata.validationPassed matches validation.passed', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.metadata.validationPassed).toBe(input.validation.passed)
  })

  it('metadata.validationClean is true for clean validation', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.metadata.validationClean).toBe(true)
  })

  it('metadata.evidenceCount equals analysis.evidence.length', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.metadata.evidenceCount).toBe(input.analysis.evidence.length)
  })

  it('metadata.bullishFactorCount counts bullish evidence items', () => {
    const evidence = [ev('A', 'bullish'), ev('B', 'bullish'), ev('C', 'bearish')]
    const input = { ...makeBullishInput(), analysis: makeAnalysis(evidence, 'strong bullish') }
    const result = generateAnalysis(input)
    expect(result.metadata.bullishFactorCount).toBe(2)
  })

  it('metadata.bearishFactorCount counts bearish evidence items', () => {
    const evidence = [ev('A', 'bullish'), ev('B', 'bearish'), ev('C', 'bearish')]
    const input = { ...makeBullishInput(), analysis: makeAnalysis(evidence, 'weak bearish') }
    const result = generateAnalysis(input)
    expect(result.metadata.bearishFactorCount).toBe(2)
  })

  it('metadata.neutralFactorCount counts neutral evidence items', () => {
    const evidence = [ev('A', 'neutral'), ev('B', 'neutral'), ev('C', 'bullish')]
    const input = { ...makeBullishInput(), analysis: makeAnalysis(evidence, 'ranging') }
    const result = generateAnalysis(input)
    expect(result.metadata.neutralFactorCount).toBe(2)
  })

  it('metadata.template reflects config template', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'executive' })
    expect(result.metadata.template).toBe('executive')
  })
})

// ─── generateAnalysis — section fields ────────────────────────────────────────

describe('generateAnalysis section fields', () => {
  it('all section fields are non-empty strings for valid bullish input', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.headline.length).toBeGreaterThan(0)
    expect(result.summary.length).toBeGreaterThan(0)
    expect(result.trendSection.length).toBeGreaterThan(0)
    expect(result.indicatorSection.length).toBeGreaterThan(0)
    expect(result.marketStructureSection.length).toBeGreaterThan(0)
    expect(result.supportResistanceSection.length).toBeGreaterThan(0)
    expect(result.volumeSection.length).toBeGreaterThan(0)
    expect(result.riskSection.length).toBeGreaterThan(0)
    expect(result.confidenceSection.length).toBeGreaterThan(0)
    expect(result.conclusion.length).toBeGreaterThan(0)
    expect(result.fullReport.length).toBeGreaterThan(0)
  })

  it('validationSection is empty string for clean validation', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input)
    expect(result.validationSection).toBe('')
  })

  it('validationSection is non-empty when validation has warnings', () => {
    const input = makeWarningInput()
    const result = generateAnalysis(input)
    expect(result.validationSection.length).toBeGreaterThan(0)
  })

  it('confidenceSection is empty when includeConfidenceSection is false', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { includeConfidenceSection: false })
    expect(result.confidenceSection).toBe('')
  })

  it('validationSection is empty when includeValidationSection is false', () => {
    const input = makeWarningInput()
    const result = generateAnalysis(input, { includeValidationSection: false })
    expect(result.validationSection).toBe('')
  })
})

// ─── generateAnalysis — critical validation gate ──────────────────────────────

describe('generateAnalysis critical validation gate', () => {
  it('fullReport contains only validation warning when criticals present', () => {
    const input = makeCriticalInput()
    const result = generateAnalysis(input)
    expect(result.fullReport).toContain('CRITICAL')
    expect(result.fullReport).not.toContain('## Trend')
  })

  it('headline is stub message when criticals present', () => {
    const input = makeCriticalInput()
    const result = generateAnalysis(input)
    expect(result.headline.toLowerCase()).toContain('unavailable')
  })

  it('all non-validation sections are empty stubs when criticals present', () => {
    const input = makeCriticalInput()
    const result = generateAnalysis(input)
    expect(result.trendSection).toBe('')
    expect(result.indicatorSection).toBe('')
    expect(result.marketStructureSection).toBe('')
    expect(result.supportResistanceSection).toBe('')
    expect(result.volumeSection).toBe('')
    expect(result.riskSection).toBe('')
    expect(result.confidenceSection).toBe('')
    expect(result.conclusion).toBe('')
  })

  it('validationSection is populated when criticals present', () => {
    const input = makeCriticalInput()
    const result = generateAnalysis(input)
    expect(result.validationSection.length).toBeGreaterThan(0)
  })

  it('metadata is still populated when criticals present', () => {
    const input = makeCriticalInput()
    const result = generateAnalysis(input)
    expect(result.metadata.symbol).toBe('BTCUSDT')
    expect(result.metadata.validationPassed).toBe(false)
  })
})

// ─── generateAnalysis — templates ─────────────────────────────────────────────

describe('generateAnalysis template: full', () => {
  it('fullReport contains markdown headers', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'full' })
    expect(result.fullReport).toContain('## ')
  })

  it('fullReport contains headline', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'full' })
    expect(result.fullReport).toContain(result.headline)
  })

  it('fullReport contains trend section', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'full' })
    expect(result.fullReport).toContain('Trend')
  })

  it('fullReport does not exceed maxReportLength', () => {
    const input = makeBullishInput()
    const cfg = { template: 'full' as const, maxReportLength: 500 }
    const result = generateAnalysis(input, cfg)
    expect(result.fullReport.length).toBeLessThanOrEqual(503)
  })
})

describe('generateAnalysis template: executive', () => {
  it('fullReport does not contain ## headers', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'executive' })
    expect(result.fullReport).not.toContain('## ')
  })

  it('fullReport contains headline', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'executive' })
    expect(result.fullReport).toContain(result.headline)
  })

  it('fullReport is non-empty', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'executive' })
    expect(result.fullReport.length).toBeGreaterThan(0)
  })
})

describe('generateAnalysis template: summary', () => {
  it('fullReport equals summary paragraph for clean validation', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'summary' })
    expect(result.fullReport).toContain(result.summary)
  })

  it('fullReport is compact', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'summary' })
    expect(result.fullReport.length).toBeLessThan(result.summary.length + 100)
  })
})

describe('generateAnalysis template: bullet', () => {
  it('fullReport starts with bullet character', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'bullet' })
    expect(result.fullReport).toMatch(/^•/)
  })

  it('fullReport contains multiple bullets', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'bullet' })
    const count = (result.fullReport.match(/^•/gm) ?? []).length
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('fullReport has at most 7 bullets', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'bullet' })
    const count = (result.fullReport.match(/^•/gm) ?? []).length
    expect(count).toBeLessThanOrEqual(7)
  })
})

describe('generateAnalysis template: headline', () => {
  it('fullReport equals headline', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'headline' })
    expect(result.fullReport).toBe(result.headline)
  })

  it('fullReport is a single line', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'headline' })
    expect(result.fullReport).not.toContain('\n')
  })
})

describe('generateAnalysis template: social', () => {
  it('fullReport contains headline information', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'social' })
    expect(result.fullReport).toContain('BTCUSDT')
  })

  it('fullReport contains not financial advice disclaimer', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'social' })
    expect(result.fullReport.toLowerCase()).toContain('not financial advice')
  })

  it('fullReport is concise (shorter than full report)', () => {
    const input = makeBullishInput()
    const fullResult = generateAnalysis(input, { template: 'full' })
    const socialResult = generateAnalysis(input, { template: 'social' })
    expect(socialResult.fullReport.length).toBeLessThan(fullResult.fullReport.length)
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('generateAnalysis determinism', () => {
  it('two calls with same input produce identical output', () => {
    const input = makeBullishInput()
    const r1 = generateAnalysis(input)
    const r2 = generateAnalysis(input)
    expect(r1).toEqual(r2)
  })

  it('two calls produce independent metadata objects', () => {
    const input = makeBullishInput()
    const r1 = generateAnalysis(input)
    const r2 = generateAnalysis(input)
    expect(r1.metadata).not.toBe(r2.metadata)
  })
})

// ─── Banned phrases ───────────────────────────────────────────────────────────

describe('banned phrases not present in any output', () => {
  const templates = ['full', 'executive', 'summary', 'bullet', 'headline', 'social'] as const

  for (const template of templates) {
    it(`template '${template}' does not contain "going to"`, () => {
      const input = makeBullishInput()
      const result = generateAnalysis(input, { template })
      expect(result.fullReport.toLowerCase()).not.toContain('going to')
    })

    it(`template '${template}' does not contain "guaranteed"`, () => {
      const input = makeBullishInput()
      const result = generateAnalysis(input, { template })
      expect(result.fullReport.toLowerCase()).not.toContain('guaranteed')
    })

    it(`template '${template}' does not contain "certain"`, () => {
      const input = makeBullishInput()
      const result = generateAnalysis(input, { template })
      expect(result.fullReport.toLowerCase()).not.toContain('certain')
    })
  }
})

// ─── Config overrides ─────────────────────────────────────────────────────────

describe('generateAnalysis config overrides', () => {
  it('respects custom maxSummaryLength', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { maxSummaryLength: 100 })
    expect(result.summary.length).toBeLessThanOrEqual(100)
  })

  it('applies template override', () => {
    const input = makeBullishInput()
    const result = generateAnalysis(input, { template: 'headline' })
    expect(result.metadata.template).toBe('headline')
  })
})

// ─── Neutral / ranging input ──────────────────────────────────────────────────

describe('generateAnalysis neutral input', () => {
  it('headline contains ranging label', () => {
    const input = makeNeutralInput()
    const result = generateAnalysis(input)
    expect(result.headline.toLowerCase()).toContain('ranging')
  })

  it('produces valid result without crashing', () => {
    const input = makeNeutralInput()
    expect(() => generateAnalysis(input)).not.toThrow()
  })
})

// ─── Bearish input ────────────────────────────────────────────────────────────

describe('generateAnalysis bearish input', () => {
  it('headline contains bearish label', () => {
    const input = makeBearishInput()
    const result = generateAnalysis(input)
    expect(result.headline.toLowerCase()).toContain('bearish')
  })

  it('produces valid result without crashing', () => {
    const input = makeBearishInput()
    expect(() => generateAnalysis(input)).not.toThrow()
  })
})
