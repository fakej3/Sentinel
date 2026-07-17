import { describe, it, expect } from 'vitest'
import { checkContradictions } from '../validate/contradictions'
import { makeValidResult, makeFullTrend, makeTrendConditions, makeEvidence } from './helpers'

describe('checkContradictions', () => {
  it('returns no issues for a fully consistent strong-bullish result', () => {
    const result = makeValidResult()
    expect(checkContradictions(result)).toHaveLength(0)
  })

  it('flags trend "strong bullish" when bullishConditionsMet is 4', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        trend: 'strong bullish', // wrong: needs 5
        bullishConditionsMet: 4,
        conditions: makeTrendConditions({ macdBullish: false }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.trend')).toBe(true)
  })

  it('flags trend "strong bearish" when bearishConditionsMet is not 5', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        trend: 'strong bearish', // wrong
        bullishConditionsMet: 0,
        bearishConditionsMet: 3,
        conditions: makeTrendConditions({
          priceAboveAllEMAs: false,
          emaInBullishOrder: false,
          hasConsistentHHHL: false,
          rsiSupportsBullish: false,
          macdBullish: false,
          priceBelowAllEMAs: true,
          emaInBearishOrder: true,
          hasConsistentLHLL: true,
          rsiSupportsBearish: false,
          macdBearish: false,
          noConsistentStructure: true,
          priceBetweenEMAsWithoutClearOrder: false,
        }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.trend')).toBe(true)
  })

  it('flags trend "moderate bullish" when bullishConditionsMet is 2', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        trend: 'moderate bullish', // wrong: needs >= 3
        bullishConditionsMet: 2,
        bearishConditionsMet: 0,
        conditions: makeTrendConditions({
          emaInBullishOrder: false,
          hasConsistentHHHL: false,
          rsiSupportsBullish: false,
        }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.trend')).toBe(true)
  })

  it('flags trend "moderate bearish" when bearish equals bullish', () => {
    // moderate bearish requires bearish > bullish
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        trend: 'moderate bearish', // wrong: bearish must be > bullish
        bullishConditionsMet: 3,
        bearishConditionsMet: 3,
        conditions: makeTrendConditions({
          priceAboveAllEMAs: true,
          emaInBullishOrder: true,
          hasConsistentHHHL: true,
          rsiSupportsBullish: false,
          macdBullish: false,
          priceBelowAllEMAs: false,
          emaInBearishOrder: false,
          hasConsistentLHLL: false,
          rsiSupportsBearish: true,
          macdBearish: true,
          noConsistentStructure: false,
          priceBetweenEMAsWithoutClearOrder: false,
        }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.trend')).toBe(true)
  })

  it('flags priceAboveAllEMAs true when any individual EMA boolean is false', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          priceAboveEMA200: false,
          priceAboveAllEMAs: true, // wrong: priceAboveEMA200 is false
        }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.conditions.priceAboveAllEMAs')).toBe(true)
  })

  it('flags priceBelowAllEMAs true when any individual priceBelowEMA boolean is false', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        bullishConditionsMet: 0,
        bearishConditionsMet: 4,
        trend: 'moderate bearish',
        conditions: makeTrendConditions({
          priceAboveEMA20: false,
          priceAboveEMA50: false,
          priceAboveEMA100: false,
          priceAboveEMA200: false,
          priceAboveAllEMAs: false,
          emaInBullishOrder: false,
          hasConsistentHHHL: false,
          rsiSupportsBullish: false,
          macdBullish: false,
          priceBelowEMA20: true,
          priceBelowEMA50: true,
          priceBelowEMA100: true,
          priceBelowEMA200: false, // NOT below EMA200
          priceBelowAllEMAs: true, // wrong: priceBelowEMA200 is false
          emaInBearishOrder: true,
          hasConsistentLHLL: true,
          rsiSupportsBearish: true,
          macdBearish: false,
          noConsistentStructure: false,
          priceBetweenEMAsWithoutClearOrder: false,
        }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.conditions.priceBelowAllEMAs')).toBe(true)
  })

  it('flags when priceAboveAllEMAs and priceBelowAllEMAs are both true', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          priceAboveAllEMAs: true,
          priceBelowAllEMAs: true, // both true is impossible
        }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.conditions'
      && i.message.includes('both true')
    )).toBe(true)
  })

  it('flags when emaInBullishOrder and emaInBearishOrder are both true', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        conditions: makeTrendConditions({
          emaInBullishOrder: true,
          emaInBearishOrder: true, // impossible
        }),
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.conditions'
      && i.message.includes('emaInBullishOrder and emaInBearishOrder')
    )).toBe(true)
  })

  it('flags bullishConditionsMet when count does not match the condition booleans', () => {
    // All 5 bullish conditions are true (priceAboveAllEMAs, emaInBullishOrder, hasConsistentHHHL,
    // rsiSupportsBullish, macdBullish) but bullishConditionsMet says 4
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        trend: 'moderate bullish', // would need bullishConditionsMet=4
        bullishConditionsMet: 4, // wrong: all 5 conditions are true
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.bullishConditionsMet')).toBe(true)
  })

  it('flags bearishConditionsMet when count does not match the condition booleans', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        bearishConditionsMet: 2, // wrong: all bearish conditions are false → should be 0
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.bearishConditionsMet')).toBe(true)
  })

  it('flags neutralConditionsMet when count does not match the condition booleans', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        neutralConditionsMet: 3, // wrong: all neutral conditions are false → should be 0
      }),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.field === 'fullTrend.neutralConditionsMet')).toBe(true)
  })

  it('flags evidence sort violation when a medium item precedes a high item', () => {
    const result = makeValidResult({
      evidence: makeEvidence([
        { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators', direction: 'bullish' },
        { factor: 'Price above EMA200', impact: 'high', description: 'ok', source: 'indicators', direction: 'bullish' }, // wrong: high after medium
        { factor: 'RSI neutral', impact: 'low', description: 'ok', source: 'indicators', direction: 'neutral' },
      ]),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.category === 'contradiction' && i.field.startsWith('evidence'))).toBe(true)
  })

  it('flags evidence sort violation when a low item precedes a medium item', () => {
    const result = makeValidResult({
      evidence: makeEvidence([
        { factor: 'Price above EMA200', impact: 'high', description: 'ok', source: 'indicators', direction: 'bullish' },
        { factor: 'RSI neutral', impact: 'low', description: 'ok', source: 'indicators', direction: 'neutral' },
        { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators', direction: 'bullish' }, // wrong: medium after low
      ]),
    })
    const issues = checkContradictions(result)
    expect(issues.some(i => i.category === 'contradiction' && i.field.startsWith('evidence'))).toBe(true)
  })

  it('does not flag evidence when sorted correctly: high, high, medium, low', () => {
    const result = makeValidResult({
      evidence: makeEvidence([
        { factor: 'Price above EMA200', impact: 'high', description: 'ok', source: 'indicators', direction: 'bullish' },
        { factor: 'Higher High confirmed', impact: 'high', description: 'ok', source: 'market_structure', direction: 'bullish' },
        { factor: 'MACD bullish bias', impact: 'medium', description: 'ok', source: 'indicators', direction: 'bullish' },
        { factor: 'RSI neutral', impact: 'low', description: 'ok', source: 'indicators', direction: 'neutral' },
      ]),
    })
    const issues = checkContradictions(result)
    expect(issues.filter(i => i.field.startsWith('evidence'))).toHaveLength(0)
  })

  it('returns correct label for ranging when neutralConditionsMet >= 3', () => {
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        trend: 'ranging',
        bullishConditionsMet: 1,
        bearishConditionsMet: 1,
        neutralConditionsMet: 3,
        conditions: makeTrendConditions({
          priceAboveAllEMAs: false,
          emaInBullishOrder: false,
          hasConsistentHHHL: false,
          rsiSupportsBullish: true,  // 1 bullish
          macdBullish: false,
          priceBelowAllEMAs: false,
          emaInBearishOrder: false,
          hasConsistentLHLL: false,
          rsiSupportsBearish: true,  // 1 bearish
          macdBearish: false,
          adxBelowWeakThreshold: true,
          rsiInNeutralRange: true,
          noConsistentStructure: true,
          priceBetweenEMAsWithoutClearOrder: false,
        }),
      }),
    })
    expect(checkContradictions(result).filter(i => i.field === 'fullTrend.trend')).toHaveLength(0)
  })

  // ── CRIT-02 regression: RSI overlap warning ───────────────────────────────

  it('emits a warning when both rsiSupportsBullish and rsiSupportsBearish are true (overlap zone)', () => {
    // RSI=50: satisfies both rsiBullishMin=45 (50>=45) and rsiBearishMax=55 (50<=55)
    const result = makeValidResult({
      fullTrend: makeFullTrend({
        bullishConditionsMet: 2,
        bearishConditionsMet: 1,
        neutralConditionsMet: 0,
        trend: 'weak bullish',
        conditions: makeTrendConditions({
          priceAboveAllEMAs: false,
          emaInBullishOrder: false,
          hasConsistentHHHL: false,
          rsiSupportsBullish: true,   // RSI in overlap zone
          macdBullish: true,
          priceBelowAllEMAs: false,
          emaInBearishOrder: false,
          hasConsistentLHLL: false,
          rsiSupportsBearish: true,   // also true — overlap
          macdBearish: false,
          noConsistentStructure: true,
          priceBetweenEMAsWithoutClearOrder: true,
        }),
      }),
    })
    const issues = checkContradictions(result)
    const rsiWarning = issues.find(
      i => i.severity === 'warning' &&
           i.field === 'fullTrend.conditions' &&
           i.message.includes('rsiSupportsBullish and rsiSupportsBearish'),
    )
    expect(rsiWarning).toBeDefined()
    expect(rsiWarning?.category).toBe('contradiction')
  })

  it('does not emit RSI overlap warning when only rsiSupportsBullish is true', () => {
    const result = makeValidResult() // rsi=65, rsiBullishMin=45, rsiBearishMax=55 → only bullish
    const issues = checkContradictions(result)
    expect(issues.some(i => i.message.includes('rsiSupportsBullish and rsiSupportsBearish'))).toBe(false)
  })
})
