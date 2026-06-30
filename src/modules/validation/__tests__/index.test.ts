import { describe, it, expect } from 'vitest'
import { validateAnalysis } from '../index'
import { DEFAULT_VALIDATION_CONFIG } from '../config'
import {
  makeValidResult, makeFullTrend, makeTrendConditions, makeEvidence,
  makeStructure, makeSupportResistance, makePriceZone,
} from './helpers'
import type { StructureEvent } from '../../market-structure/types'

function makeBOSEvent(index: number): StructureEvent {
  return { type: 'BOS', index, timestamp: index * 3_600_000, level: 100, direction: 'bullish' }
}

describe('validateAnalysis', () => {
  it('returns passed:true and clean:true for a fully valid result', () => {
    const result = makeValidResult()
    const vr = validateAnalysis(result)
    expect(vr.passed).toBe(true)
    expect(vr.clean).toBe(true)
    expect(vr.issues).toHaveLength(0)
    expect(vr.criticalCount).toBe(0)
    expect(vr.warningCount).toBe(0)
    expect(vr.infoCount).toBe(0)
  })

  it('returns passed:false when there is at least one critical issue', () => {
    const result = makeValidResult({ price: { current: 0, change24hPercent: 0, high24h: 0, low24h: 0, atrPercent: null } })
    const vr = validateAnalysis(result)
    expect(vr.passed).toBe(false)
    expect(vr.criticalCount).toBeGreaterThan(0)
  })

  it('returns passed:true and clean:false when there are only warnings', () => {
    // Produce only a warning: no high-impact evidence, with 3 medium-impact items
    const result = makeValidResult({
      evidence: makeEvidence([
        { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators' },
        { factor: 'ADX above 25', impact: 'medium', description: 'ok', source: 'indicators' },
        { factor: 'RSI neutral', impact: 'medium', description: 'ok', source: 'indicators' },
      ]),
    })
    const vr = validateAnalysis(result, { minHighImpactEvidence: 1 })
    expect(vr.passed).toBe(true)
    expect(vr.clean).toBe(false)
    expect(vr.warningCount).toBeGreaterThan(0)
    expect(vr.criticalCount).toBe(0)
  })

  it('returns passed:false with failOnWarning:true when warnings are present', () => {
    const result = makeValidResult({
      evidence: makeEvidence([
        { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators' },
        { factor: 'ADX above 25', impact: 'medium', description: 'ok', source: 'indicators' },
        { factor: 'RSI neutral', impact: 'medium', description: 'ok', source: 'indicators' },
      ]),
    })
    const vr = validateAnalysis(result, { failOnWarning: true, minHighImpactEvidence: 1 })
    expect(vr.passed).toBe(false)
    expect(vr.warningCount).toBeGreaterThan(0)
  })

  it('counts criticalCount, warningCount, infoCount correctly', () => {
    // One critical (zero price), one warning (no high-impact evidence)
    const result = makeValidResult({
      price: { current: 0, change24hPercent: 0, high24h: 0, low24h: 0, atrPercent: null },
      evidence: makeEvidence([
        { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators' },
        { factor: 'ADX above 25', impact: 'medium', description: 'ok', source: 'indicators' },
        { factor: 'RSI neutral', impact: 'medium', description: 'ok', source: 'indicators' },
      ]),
    })
    const vr = validateAnalysis(result, { minHighImpactEvidence: 1 })
    expect(vr.criticalCount).toBeGreaterThan(0)
    expect(vr.warningCount).toBeGreaterThan(0)
    expect(vr.criticalCount + vr.warningCount + vr.infoCount).toBe(vr.issues.length)
  })

  it('returns a non-empty summary string', () => {
    const result = makeValidResult()
    const vr = validateAnalysis(result)
    expect(typeof vr.summary).toBe('string')
    expect(vr.summary.length).toBeGreaterThan(0)
  })

  it('summary describes failure when critical issues exist', () => {
    const result = makeValidResult({ symbol: '' })
    const vr = validateAnalysis(result)
    expect(vr.summary.toLowerCase()).toMatch(/fail/)
  })

  it('summary describes success when no issues exist', () => {
    const result = makeValidResult()
    const vr = validateAnalysis(result)
    expect(vr.summary.toLowerCase()).toMatch(/passed/)
  })

  it('determinism: two calls on the same input return identical results', () => {
    const result = makeValidResult()
    const vr1 = validateAnalysis(result)
    const vr2 = validateAnalysis(result)
    expect(vr1.passed).toBe(vr2.passed)
    expect(vr1.clean).toBe(vr2.clean)
    expect(vr1.issues).toHaveLength(vr2.issues.length)
    expect(vr1.criticalCount).toBe(vr2.criticalCount)
    expect(vr1.summary).toBe(vr2.summary)
  })

  it('two independent calls return separate objects', () => {
    const result = makeValidResult()
    const vr1 = validateAnalysis(result)
    const vr2 = validateAnalysis(result)
    expect(vr1.issues).not.toBe(vr2.issues)
  })

  it('merges partial config with defaults', () => {
    const result = makeValidResult()
    // Supply partial config; should not throw and should use defaults for unspecified keys
    const vr = validateAnalysis(result, { minEvidenceItems: 1 })
    expect(vr.passed).toBe(true)
    expect(vr.clean).toBe(true)
  })

  it('applies non-default minEvidenceItems threshold', () => {
    // 3 evidence items in result — valid by default (min=3), invalid if min=5
    const result = makeValidResult()
    const vr = validateAnalysis(result, { minEvidenceItems: 5 })
    expect(vr.passed).toBe(false)
    expect(vr.issues.some(i => i.field === 'evidence' && i.severity === 'critical')).toBe(true)
  })

  it('validates a result with multiple issues across categories', () => {
    // Introduce: zero price (completeness) + trend mismatch (contradiction) + bad zone geometry (structural)
    const badZone = { ...makePriceZone('support', 80), lower: 82 } // lower > center
    const result = makeValidResult({
      price: { current: 0, change24hPercent: 0, high24h: 0, low24h: 0, atrPercent: null },
      fullTrend: makeFullTrend({
        trend: 'strong bullish',
        bullishConditionsMet: 4, // contradicts 'strong bullish'
        conditions: makeTrendConditions({ macdBullish: false }),
      }),
      supportResistance: makeSupportResistance({ zones: [badZone] }),
    })
    const vr = validateAnalysis(result)
    expect(vr.passed).toBe(false)
    const categories = new Set(vr.issues.map(i => i.category))
    expect(categories.size).toBeGreaterThan(1)
  })

  it('issues array contains ValidationIssue objects with required fields', () => {
    const result = makeValidResult({ symbol: '' })
    const vr = validateAnalysis(result)
    expect(vr.issues.length).toBeGreaterThan(0)
    for (const issue of vr.issues) {
      expect(typeof issue.severity).toBe('string')
      expect(typeof issue.category).toBe('string')
      expect(typeof issue.field).toBe('string')
      expect(typeof issue.message).toBe('string')
    }
  })

  it('passes with a valid structure that has BOS and CHOCH events', () => {
    const bosEvent = makeBOSEvent(10)
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [bosEvent], last: bosEvent },
        events: [bosEvent],
      }),
    })
    const vr = validateAnalysis(result)
    expect(vr.passed).toBe(true)
    expect(vr.issues.filter(i => i.category === 'structural')).toHaveLength(0)
  })
})
