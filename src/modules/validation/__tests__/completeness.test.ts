import { describe, it, expect } from 'vitest'
import { checkCompleteness } from '../validate/completeness'
import { DEFAULT_VALIDATION_CONFIG } from '../config'
import { makeValidResult, makeFullTrend, makeEvidence } from './helpers'

describe('checkCompleteness', () => {
  it('returns no issues for a fully valid result', () => {
    const result = makeValidResult()
    expect(checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  it('returns a critical issue when price.current is zero', () => {
    const result = makeValidResult({ price: { current: 0, change24hPercent: 0, high24h: 0, low24h: 0, atrPercent: null } })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('critical')
    expect(issues[0].field).toBe('price.current')
  })

  it('returns a critical issue when price.current is negative', () => {
    const result = makeValidResult({ price: { current: -10, change24hPercent: 0, high24h: 0, low24h: 0, atrPercent: null } })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'price.current')).toBe(true)
  })

  it('returns a critical issue when symbol is an empty string', () => {
    const result = makeValidResult({ symbol: '' })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues).toHaveLength(1)
    expect(issues[0].field).toBe('symbol')
    expect(issues[0].severity).toBe('critical')
  })

  it('returns a critical issue when symbol is only whitespace', () => {
    const result = makeValidResult({ symbol: '   ' })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'symbol')).toBe(true)
  })

  it('returns a critical issue when evidence has fewer than minEvidenceItems', () => {
    const result = makeValidResult({ evidence: makeEvidence([
      { factor: 'Price above EMA200', impact: 'high', description: 'ok', source: 'indicators' },
    ]) })
    const cfg = { ...DEFAULT_VALIDATION_CONFIG, minEvidenceItems: 3 }
    const issues = checkCompleteness(result, cfg)
    expect(issues.some(i => i.field === 'evidence' && i.severity === 'critical')).toBe(true)
  })

  it('does not flag evidence when count equals minEvidenceItems exactly', () => {
    const result = makeValidResult({ evidence: makeEvidence([
      { factor: 'Price above EMA200', impact: 'high', description: 'ok', source: 'indicators' },
      { factor: 'Higher High confirmed', impact: 'high', description: 'ok', source: 'market_structure' },
      { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators' },
    ]) })
    const cfg = { ...DEFAULT_VALIDATION_CONFIG, minEvidenceItems: 3 }
    const issues = checkCompleteness(result, cfg)
    expect(issues.filter(i => i.field === 'evidence' && i.severity === 'critical')).toHaveLength(0)
  })

  it('returns a warning when high-impact evidence count is below minHighImpactEvidence', () => {
    const result = makeValidResult({ evidence: makeEvidence([
      { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators' },
      { factor: 'ADX above 25', impact: 'medium', description: 'ok', source: 'indicators' },
      { factor: 'RSI neutral', impact: 'low', description: 'ok', source: 'indicators' },
    ]) })
    const cfg = { ...DEFAULT_VALIDATION_CONFIG, minHighImpactEvidence: 1 }
    const issues = checkCompleteness(result, cfg)
    expect(issues.some(i => i.field === 'evidence' && i.severity === 'warning')).toBe(true)
  })

  it('does not emit high-impact warning when minHighImpactEvidence is 0', () => {
    const result = makeValidResult({ evidence: makeEvidence([
      { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators' },
      { factor: 'ADX above 25', impact: 'medium', description: 'ok', source: 'indicators' },
      { factor: 'RSI neutral', impact: 'low', description: 'ok', source: 'indicators' },
    ]) })
    const cfg = { ...DEFAULT_VALIDATION_CONFIG, minHighImpactEvidence: 0 }
    expect(checkCompleteness(result, cfg)).toHaveLength(0)
  })

  it('returns a critical issue when bullishConditionsMet is 6', () => {
    const result = makeValidResult({ fullTrend: makeFullTrend({ bullishConditionsMet: 6 }) })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.bullishConditionsMet')).toBe(true)
    expect(issues.find(i => i.field === 'fullTrend.bullishConditionsMet')?.severity).toBe('critical')
  })

  it('returns a critical issue when bearishConditionsMet is -1', () => {
    const result = makeValidResult({ fullTrend: makeFullTrend({ bearishConditionsMet: -1 }) })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.bearishConditionsMet')).toBe(true)
  })

  it('returns a critical issue when neutralConditionsMet is 5', () => {
    const result = makeValidResult({ fullTrend: makeFullTrend({ neutralConditionsMet: 5 }) })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'fullTrend.neutralConditionsMet')).toBe(true)
  })

  it('does not flag neutralConditionsMet when value is exactly 4', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        trend: 'ranging',
        bullishConditionsMet: 0,
        bearishConditionsMet: 0,
        neutralConditionsMet: 4,
      }),
    })
    const issues = checkCompleteness(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.filter(i => i.field === 'fullTrend.neutralConditionsMet')).toHaveLength(0)
  })
})
