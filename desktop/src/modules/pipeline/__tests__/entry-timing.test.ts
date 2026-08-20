import { describe, expect, it } from 'vitest'
import { isEntryExecutable } from '../compute/entry-timing'
import type { TradePlan } from '../types'

function plan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    direction: 'long',
    entryZone: { lower: 100, upper: 110 },
    invalidationLevel: 95,
    targetLevel: 130,
    targets: [130],
    riskRewardRatio: 5,
    setupQuality: 'good',
    setupQualityReason: 'good setup',
    actionable: true,
    patienceMessage: '',
    maturityScore: 60,
    maturityLabel: 'mature',
    maturityComponents: { momentum: 15, volume: 15, trend: 14, structure: 10, confidence: 10 },
    maturityPrimaryConcern: null,
    ...overrides,
  }
}

describe('executable entry timing', () => {
  it('allows a long only while current price is inside its entry zone', () => {
    expect(isEntryExecutable(105, plan())).toBe(true)
    expect(isEntryExecutable(99, plan())).toBe(false)
    expect(isEntryExecutable(111, plan())).toBe(false)
  })

  it('allows a short only while current price is inside its entry zone', () => {
    const shortPlan = plan({ direction: 'short' })
    expect(isEntryExecutable(105, shortPlan)).toBe(true)
    expect(isEntryExecutable(99, shortPlan)).toBe(false)
    expect(isEntryExecutable(111, shortPlan)).toBe(false)
  })

  it('blocks non-actionable plans even when price is inside the zone', () => {
    expect(isEntryExecutable(105, plan({ actionable: false, setupQuality: 'avoid' }))).toBe(false)
  })

  it('blocks plans without a direction or entry zone', () => {
    expect(isEntryExecutable(105, plan({ direction: null }))).toBe(false)
    expect(isEntryExecutable(105, plan({ entryZone: null }))).toBe(false)
  })
})
