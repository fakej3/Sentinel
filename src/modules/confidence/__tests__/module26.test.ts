import { describe, it, expect } from 'vitest'
import { computeConfluence } from '../compute/confluence'
import { groupContradictions } from '../compute/contradiction-groups'
import { computeEvidenceQuality } from '../compute/evidence-quality'
import { computeReliability } from '../compute/reliability'
import { computeAnalysisQuality } from '../compute/quality'
import { computeConfidence } from '../index'
import { DEFAULT_CONFIDENCE_CONFIG } from '../config'
import { ev, makeAnalysis, makeDirectionalAnalysis, cleanValidation } from './helpers'

const cfg = DEFAULT_CONFIDENCE_CONFIG

// ─────────────────────────────────────────────────────────────────────────────
// computeConfluence
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfluence', () => {
  it('returns zero score with no evidence', () => {
    const result = computeConfluence([], cfg, 'strong bullish')
    expect(result.score).toBe(0)
    expect(result.agreeing).toHaveLength(0)
    expect(result.disagreeing).toHaveLength(0)
    expect(result.agreementRatio).toBe(0)
  })

  it('all categories agree in a bullish market', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),   // trendQuality — bullish
      ev('MACD bullish bias', 'bullish'),    // momentum — bullish
      ev('Strong bullish volume confirmation', 'bullish'), // volume — bullish
      ev('Higher High confirmed', 'bullish'), // marketStructure — bullish
      ev('Price at active support', 'bullish'), // srPositioning — bullish
    ]
    const result = computeConfluence(evidence, cfg, 'strong bullish')
    expect(result.agreeing).toHaveLength(5)
    expect(result.disagreeing).toHaveLength(0)
    expect(result.agreementRatio).toBe(1)
    expect(result.score).toBeCloseTo(10, 0)
  })

  it('opposing evidence creates disagreeing categories', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),   // trendQuality agrees with bullish
      ev('MACD bearish bias', 'bearish'),    // momentum opposes bullish
    ]
    const result = computeConfluence(evidence, cfg, 'strong bullish')
    expect(result.agreeing).toContain('Trend/EMAs')
    expect(result.disagreeing).toContain('Momentum')
    expect(result.agreementRatio).toBeCloseTo(0.5, 1)
  })

  it('all categories agree in a bearish market with bearish evidence', () => {
    const evidence = [
      ev('Price below EMA200', 'bearish'),
      ev('MACD bearish bias', 'bearish'),
      ev('Strong bearish volume confirmation', 'bearish'),
      ev('Lower Low confirmed', 'bearish'),
    ]
    const result = computeConfluence(evidence, cfg, 'strong bearish')
    expect(result.agreeing.length).toBeGreaterThan(0)
    expect(result.disagreeing).toHaveLength(0)
  })

  it('is deterministic for the same inputs', () => {
    const evidence = [ev('Price above EMA200', 'bullish'), ev('MACD bearish bias', 'bearish')]
    const r1 = computeConfluence(evidence, cfg, 'moderate bullish')
    const r2 = computeConfluence(evidence, cfg, 'moderate bullish')
    expect(r1).toEqual(r2)
  })

  it('score is in 0–10 range', () => {
    const evidence = [ev('Price above EMA200', 'bullish'), ev('MACD bullish bias', 'bullish')]
    const result = computeConfluence(evidence, cfg, 'strong bullish')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// groupContradictions
// ─────────────────────────────────────────────────────────────────────────────

describe('groupContradictions', () => {
  it('returns empty array for ranging markets', () => {
    const result = groupContradictions([ev('MACD bearish bias', 'bearish')], cfg, 'ranging')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when no evidence contradicts the trend', () => {
    const evidence = [ev('Price above EMA200', 'bullish'), ev('MACD bullish bias', 'bullish')]
    const result = groupContradictions(evidence, cfg, 'strong bullish')
    expect(result).toHaveLength(0)
  })

  it('groups contradicting evidence by category', () => {
    const evidence = [
      ev('MACD bearish bias', 'bearish'), // contradicts bullish trend
      ev('ADX trend weak', 'neutral'),    // contradicts bullish (negative weight)
    ]
    const result = groupContradictions(evidence, cfg, 'strong bullish')
    expect(result.length).toBeGreaterThan(0)
    const categories = result.map(g => g.category)
    expect(categories).toContain('Momentum')
  })

  it('assigns severity based on total opposing points', () => {
    // Both in trendQuality category: -15 + -10 + -7 = 32 pts total → 'strong'
    const strongContradiction = [
      ev('Price below EMA200', 'bearish'),  // -15 pts in bullish market
      ev('Price below EMA100', 'bearish'),  // -10 pts in bullish market
      ev('Price below EMA50', 'bearish'),   // -7 pts in bullish market
    ]
    const result = groupContradictions(strongContradiction, cfg, 'strong bullish')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].severity).toBe('strong')
  })

  it('mild contradiction for small opposing points', () => {
    const mildContradiction = [ev('ADX trend weak', 'neutral')] // -4 pts
    const result = groupContradictions(mildContradiction, cfg, 'strong bullish')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].severity).toBe('mild')
  })

  it('sorts strongest first', () => {
    const evidence = [
      ev('ADX trend weak', 'neutral'),       // mild (-4)
      ev('Price below EMA200', 'bearish'),   // strong (-15)
      ev('Lower Low confirmed', 'bearish'),  // strong (-15)
    ]
    const result = groupContradictions(evidence, cfg, 'strong bullish')
    if (result.length >= 2) {
      const order = { strong: 0, moderate: 1, mild: 2 }
      expect(order[result[0].severity]).toBeLessThanOrEqual(order[result[result.length - 1].severity])
    }
  })

  it('includes factor names in the group', () => {
    const evidence = [ev('MACD bearish bias', 'bearish')]
    const result = groupContradictions(evidence, cfg, 'strong bullish')
    expect(result.some(g => g.factors.includes('MACD bearish bias'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeEvidenceQuality
// ─────────────────────────────────────────────────────────────────────────────

describe('computeEvidenceQuality', () => {
  it('rates all categories as poor with no evidence', () => {
    const result = computeEvidenceQuality([], cfg)
    expect(result.trendQuality).toBe('poor')
    expect(result.momentum).toBe('poor')
    expect(result.volume).toBe('poor')
    expect(result.marketStructure).toBe('poor')
    expect(result.srPositioning).toBe('poor')
  })

  it('rates a single factor as moderate', () => {
    const result = computeEvidenceQuality([ev('Price above EMA200', 'bullish')], cfg)
    expect(result.trendQuality).toBe('moderate')
  })

  it('rates two factors as good', () => {
    const result = computeEvidenceQuality([
      ev('Price above EMA200', 'bullish'),
      ev('EMA bullish alignment', 'bullish'),
    ], cfg)
    expect(result.trendQuality).toBe('good')
  })

  it('rates three or more factors as excellent', () => {
    const result = computeEvidenceQuality([
      ev('Price above EMA200', 'bullish'),
      ev('Price above EMA50', 'bullish'),
      ev('EMA bullish alignment', 'bullish'),
    ], cfg)
    expect(result.trendQuality).toBe('excellent')
  })

  it('only counts factors with known weights', () => {
    const result = computeEvidenceQuality([ev('Unknown factor', 'neutral')], cfg)
    expect(result.trendQuality).toBe('poor')
  })

  it('correctly rates different categories independently', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),   // trendQuality
      ev('MACD bullish bias', 'bullish'),    // momentum
      ev('MACD bullish bias', 'bullish'),    // momentum (counts twice? no — same factor but different items)
    ]
    const result = computeEvidenceQuality(evidence, cfg)
    expect(result.trendQuality).toBe('moderate')
    expect(result.srPositioning).toBe('poor')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeReliability
// ─────────────────────────────────────────────────────────────────────────────

describe('computeReliability', () => {
  it('returns required fields', () => {
    const result = computeReliability(makeAnalysis())
    expect(typeof result.trendReliability).toBe('number')
    expect(typeof result.oscillatorReliability).toBe('number')
    expect(typeof result.volumeReliability).toBe('number')
    expect(typeof result.note).toBe('string')
    expect(result.note.length).toBeGreaterThan(0)
  })

  it('all reliability scores are in 0–10 range', () => {
    const result = computeReliability(makeAnalysis())
    expect(result.trendReliability).toBeGreaterThanOrEqual(0)
    expect(result.trendReliability).toBeLessThanOrEqual(10)
    expect(result.oscillatorReliability).toBeGreaterThanOrEqual(0)
    expect(result.oscillatorReliability).toBeLessThanOrEqual(10)
    expect(result.volumeReliability).toBeGreaterThanOrEqual(0)
    expect(result.volumeReliability).toBeLessThanOrEqual(10)
  })

  it('strong trend → high trend reliability', () => {
    const analysis = makeDirectionalAnalysis('strong bullish')
    const result = computeReliability(analysis)
    expect(result.trendReliability).toBeGreaterThanOrEqual(8)
  })

  it('is deterministic', () => {
    const analysis = makeAnalysis()
    const r1 = computeReliability(analysis)
    const r2 = computeReliability(analysis)
    expect(r1).toEqual(r2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeAnalysisQuality
// ─────────────────────────────────────────────────────────────────────────────

describe('computeAnalysisQuality', () => {
  it('returns required shape', () => {
    const result = computeAnalysisQuality(makeAnalysis(), cfg)
    expect(typeof result.score).toBe('number')
    expect(result.confluence).toBeDefined()
    expect(result.evidenceQuality).toBeDefined()
    expect(Array.isArray(result.contradictions)).toBe(true)
    expect(result.reliability).toBeDefined()
  })

  it('score is in 0–10 range', () => {
    const result = computeAnalysisQuality(makeAnalysis(), cfg)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(10)
  })

  it('more aligned evidence → higher quality score', () => {
    const weakEvidence = makeAnalysis([ev('Price above EMA200', 'bullish')])
    const strongEvidence = makeDirectionalAnalysis('strong bullish', [
      ev('Price above EMA200', 'bullish'),
      ev('EMA bullish alignment', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('MACD bullish bias', 'bullish'),
      ev('Strong bullish volume confirmation', 'bullish'),
    ])
    const weakQ  = computeAnalysisQuality(weakEvidence, cfg)
    const strongQ = computeAnalysisQuality(strongEvidence, cfg)
    expect(strongQ.score).toBeGreaterThan(weakQ.score)
  })

  it('is deterministic', () => {
    const analysis = makeDirectionalAnalysis('strong bullish', [ev('Price above EMA200', 'bullish')])
    const q1 = computeAnalysisQuality(analysis, cfg)
    const q2 = computeAnalysisQuality(analysis, cfg)
    expect(q1).toEqual(q2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Module 26 — computeConfidence integration
// ─────────────────────────────────────────────────────────────────────────────

describe('Module 26 — computeConfidence analysisQuality', () => {
  it('result includes analysisQuality field', () => {
    const result = computeConfidence(makeAnalysis([ev('Price above EMA200', 'bullish')]), cleanValidation())
    expect(result.analysisQuality).toBeDefined()
    expect(typeof result.analysisQuality.score).toBe('number')
  })

  it('analysisQuality.score is in 0–10 range', () => {
    const result = computeConfidence(makeAnalysis([ev('Price above EMA200', 'bullish')]), cleanValidation())
    expect(result.analysisQuality.score).toBeGreaterThanOrEqual(0)
    expect(result.analysisQuality.score).toBeLessThanOrEqual(10)
  })

  it('analysisQuality has confluence, evidenceQuality, contradictions, reliability', () => {
    const result = computeConfidence(makeAnalysis([ev('Price above EMA200', 'bullish')]), cleanValidation())
    expect(result.analysisQuality.confluence).toBeDefined()
    expect(result.analysisQuality.evidenceQuality).toBeDefined()
    expect(Array.isArray(result.analysisQuality.contradictions)).toBe(true)
    expect(result.analysisQuality.reliability).toBeDefined()
  })

  it('full bullish evidence pack → confluent categories', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),
      ev('EMA bullish alignment', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('Higher Low confirmed', 'bullish'),
      ev('MACD bullish bias', 'bullish'),
      ev('RSI in 55–70 range', 'bullish'),
      ev('Strong bullish volume confirmation', 'bullish'),
      ev('Price at active support', 'bullish'),
    ]
    const result = computeConfidence(
      makeDirectionalAnalysis('strong bullish', evidence),
      cleanValidation(),
    )
    expect(result.analysisQuality.confluence.agreeing.length).toBeGreaterThan(0)
    expect(result.analysisQuality.contradictions).toHaveLength(0)
  })

  it('is deterministic', () => {
    const evidence = [ev('Price above EMA200', 'bullish'), ev('MACD bearish bias', 'bearish')]
    const analysis = makeDirectionalAnalysis('moderate bullish', evidence)
    const r1 = computeConfidence(analysis, cleanValidation())
    const r2 = computeConfidence(analysis, cleanValidation())
    expect(r1.analysisQuality).toEqual(r2.analysisQuality)
  })
})
