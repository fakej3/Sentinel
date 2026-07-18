import { describe, it, expect } from 'vitest'
import { applyInteractions } from '../interactions'
import type { PriceZone } from '../types'
import { candle } from './helpers'
import type { Candle } from '../../binance/types'

function zone(overrides: Partial<PriceZone> = {}): PriceZone {
  return {
    id: 'sr-001',
    type: 'resistance',
    origin: 'swing-high',
    state: 'active',
    center: 100,
    upper: 102,
    lower: 98,
    width: 4,
    touchCount: 1,
    successfulReactions: 0,
    failedReactions: 0,
    broken: false,
    retested: false,
    firstDetectedIndex: 0,
    lastInteractionIndex: 0,
    age: 0,
    strength: 0,
    confidence: 0,
    evidence: [],
    ...overrides,
  }
}

function makeCandles(specs: Array<{ close: number; high?: number; low?: number }>): Candle[] {
  return specs.map((s, i) =>
    candle({
      openTime: i * 1000,
      close: s.close,
      high: s.high ?? s.close,
      low: s.low ?? s.close,
    }),
  )
}

describe('applyInteractions — resistance zone', () => {
  it('does not mutate the input zone', () => {
    const z = zone()
    const original = { ...z }
    const candles = makeCandles([
      { close: 95 },
      { close: 99, high: 100 },  // touches
      { close: 94 },
    ])
    applyInteractions(z, candles)
    expect(z.touchCount).toBe(original.touchCount)
  })

  it('increments touchCount when price enters zone', () => {
    const z = zone({ firstDetectedIndex: 0 })
    const candles = makeCandles([
      { close: 100 },        // index 0 — creation candle (skipped)
      { close: 99, high: 100, low: 97 }, // index 1 — enters zone
      { close: 94 },         // index 2
    ])
    const result = applyInteractions(z, candles)
    expect(result.touchCount).toBe(2)
  })

  it('records a successful reaction when close < lower and next candle stays out', () => {
    const z = zone({ firstDetectedIndex: 0 })
    const candles = makeCandles([
      { close: 100 },              // 0 - skip
      { close: 97, high: 101, low: 95 }, // 1 - enters zone (high >= lower=98), close < lower=98 → bounce
      { close: 94 },               // 2 - stays below zone → confirms bounce
    ])
    const result = applyInteractions(z, candles)
    expect(result.successfulReactions).toBe(1)
    expect(result.broken).toBe(false)
  })

  it('records break when close > upper and price does not reverse within 3 candles', () => {
    const z = zone({ firstDetectedIndex: 0 })
    const candles = makeCandles([
      { close: 100 },                    // 0 - skip
      { close: 103, high: 104, low: 99 }, // 1 - enters zone, close > upper=102 → break
      { close: 105 },                    // 2 - above zone, no reversal
      { close: 106 },                    // 3 - no reversal
      { close: 107 },                    // 4 - no reversal → confirmed break
    ])
    const result = applyInteractions(z, candles)
    expect(result.broken).toBe(true)
    expect(result.failedReactions).toBeGreaterThan(0)
  })

  it('does not break when price reverses back within 3 candles', () => {
    const z = zone({ firstDetectedIndex: 0 })
    const candles = makeCandles([
      { close: 100 },
      { close: 103, high: 104, low: 99 }, // enters and closes above — potential break
      { close: 100, high: 101, low: 98 }, // re-enters zone within 1 candle → reversal
      { close: 96 },
    ])
    const result = applyInteractions(z, candles)
    expect(result.broken).toBe(false)
  })

  it('detects retest of broken resistance zone', () => {
    const z = zone({ firstDetectedIndex: 0, type: 'resistance', broken: true })
    // Broken resistance retested when price rises back into zone from below
    const candles = makeCandles([
      { close: 100 },         // 0
      { close: 103, high: 104, low: 99 }, // 1 — enters zone from below (retest from below)
      { close: 97 },          // 2 — closes back below lower=98
    ])
    // Zone is already broken; a retest means price re-enters from below and closes below lower
    const result = applyInteractions(z, candles)
    expect(result.retested).toBe(true)
  })
})

describe('applyInteractions — support zone', () => {
  const supportZone = () => zone({
    type: 'support',
    origin: 'swing-low',
    center: 100,
    upper: 102,
    lower: 98,
    firstDetectedIndex: 0,
  })

  it('records successful reaction when close > upper and next stays above', () => {
    const z = supportZone()
    const candles = makeCandles([
      { close: 100 },                     // 0 - skip
      { close: 103, high: 104, low: 99 }, // 1 - enters zone, close > upper=102 → bounce
      { close: 105 },                     // 2 - stays above → confirms
    ])
    const result = applyInteractions(z, candles)
    expect(result.successfulReactions).toBe(1)
    expect(result.broken).toBe(false)
  })

  it('records break when close < lower and no reversal', () => {
    const z = supportZone()
    const candles = makeCandles([
      { close: 100 },
      { close: 97, high: 101, low: 95 },  // enters zone, close < lower=98 → break attempt
      { close: 95 },
      { close: 94 },
      { close: 93 },
    ])
    const result = applyInteractions(z, candles)
    expect(result.broken).toBe(true)
  })

  it('detects retest of broken support zone', () => {
    const z = zone({
      type: 'support', center: 100, upper: 102, lower: 98,
      firstDetectedIndex: 0, broken: true,
    })
    // Former support zone; broken going down, now acts as resistance.
    // Retest: price rises from below back into zone and closes ≤ upper (bounces back down).
    const candles = makeCandles([
      { close: 100 },
      { close: 99, high: 101, low: 90 }, // enters zone from below, close=99 ≤ upper=102 → retest confirmed
    ])
    const result = applyInteractions(z, candles)
    expect(result.retested).toBe(true)
  })
})

// ── CRIT-04 regression: bounce confirmation boundary ─────────────────────────
describe('applyInteractions — bounce confirmation boundary (CRIT-04)', () => {
  // Zone: center=100, lower=98, upper=102

  describe('resistance zone', () => {
    it('does NOT confirm bounce when next candle high is inside zone (high=99)', () => {
      // Bug: old code checked next.high < zone.upper (102) → 99 < 102 is true → confirmed
      // Fix: new code checks next.high < zone.lower (98) → 99 < 98 is false → not confirmed
      // Zone: lower=98, upper=102
      const z = zone({ firstDetectedIndex: 0, type: 'resistance' })
      const candles = makeCandles([
        { close: 100 },                      // 0 - skip
        { close: 97, high: 101, low: 95 },   // 1 - enters zone, close < lower=98 → bounce attempt
        { close: 99, high: 99, low: 96 },    // 2 - next: high=99 inside zone → NOT < zone.lower=98
        { close: 94 },                       // 3 - stabilise outside zone
      ])
      const result = applyInteractions(z, candles)
      // Candle 1 bounce: NOT confirmed (failedReaction), candle 2 has close inside zone → no further bounce
      expect(result.successfulReactions).toBe(0)
      expect(result.failedReactions).toBeGreaterThanOrEqual(1)
    })

    it('confirms bounce when next candle high is strictly below zone.lower (high=97)', () => {
      const z = zone({ firstDetectedIndex: 0, type: 'resistance' })
      const candles = makeCandles([
        { close: 100 },
        { close: 97, high: 101, low: 95 }, // enters zone, closes below lower
        { close: 96, high: 97, low: 95 },  // next: high=97 < zone.lower=98 → confirmed
      ])
      const result = applyInteractions(z, candles)
      expect(result.successfulReactions).toBe(1)
    })

  })

  describe('support zone', () => {
    it('does NOT confirm bounce when next candle low is inside zone (low=101)', () => {
      // Bug: old code checked next.low > zone.lower (98) → 101 > 98 is true → confirmed
      // Fix: new code checks next.low > zone.upper (102) → 101 > 102 is false → not confirmed
      // Zone: lower=98, upper=102
      const z = zone({ firstDetectedIndex: 0, type: 'support' })
      const candles = makeCandles([
        { close: 100 },
        { close: 103, high: 104, low: 99 },   // enters zone, close > upper=102 → bounce attempt
        { close: 101, high: 103, low: 101 },  // next: low=101 inside zone → NOT > zone.upper=102
        { close: 106 },                        // stabilise above zone
      ])
      const result = applyInteractions(z, candles)
      expect(result.successfulReactions).toBe(0)
      expect(result.failedReactions).toBeGreaterThanOrEqual(1)
    })

    it('confirms bounce when next candle low is strictly above zone.upper (low=103)', () => {
      const z = zone({ firstDetectedIndex: 0, type: 'support' })
      const candles = makeCandles([
        { close: 100 },
        { close: 103, high: 104, low: 99 },   // enters zone, closes above upper
        { close: 104, high: 105, low: 103 },  // next: low=103 > zone.upper=102 → confirmed
      ])
      const result = applyInteractions(z, candles)
      expect(result.successfulReactions).toBe(1)
    })

  })
})

// ── SR-1 regression: last-candle bounce must not be counted as successful ────
describe('applyInteractions — last-candle bounce (regression: SR-1)', () => {
  it('does not award successfulReaction for resistance bounce with no confirmation candle', () => {
    const z = zone({ firstDetectedIndex: 0, type: 'resistance' })
    const candles = makeCandles([
      { close: 100 },                      // 0 - skip (firstDetectedIndex)
      { close: 97, high: 101, low: 95 },   // 1 - enters zone, close < lower=98 → bounce, but last candle
    ])
    const result = applyInteractions(z, candles)
    expect(result.successfulReactions).toBe(0)  // no next candle → inconclusive
    expect(result.failedReactions).toBe(0)
    expect(result.touchCount).toBe(2)            // touch was still recorded
  })

  it('does not award successfulReaction for support bounce with no confirmation candle', () => {
    const z = zone({ firstDetectedIndex: 0, type: 'support' })
    const candles = makeCandles([
      { close: 100 },                      // 0 - skip (firstDetectedIndex)
      { close: 103, high: 104, low: 99 },  // 1 - enters zone, close > upper=102 → bounce, but last candle
    ])
    const result = applyInteractions(z, candles)
    expect(result.successfulReactions).toBe(0)  // no next candle → inconclusive
    expect(result.failedReactions).toBe(0)
    expect(result.touchCount).toBe(2)            // touch was still recorded
  })
})

describe('applyInteractions — edge cases', () => {
  it('ignores candles at or before firstDetectedIndex', () => {
    const z = zone({ firstDetectedIndex: 5 })
    const candles = makeCandles([
      { close: 99, high: 103, low: 97 }, // index 0 — before creation
      { close: 99, high: 103, low: 97 }, // index 1
      { close: 99, high: 103, low: 97 }, // index 2
      { close: 99, high: 103, low: 97 }, // index 3
      { close: 99, high: 103, low: 97 }, // index 4
      { close: 95 },                     // index 5 — creation (skipped)
      { close: 94 },                     // index 6 — after creation, no touch
    ])
    const result = applyInteractions(z, candles)
    expect(result.touchCount).toBe(1) // only the initial touchCount=1 from zone creation
  })

  it('does not detect retest once already retested', () => {
    const z = zone({ firstDetectedIndex: 0, broken: true, retested: true })
    const candles = makeCandles([
      { close: 100 },
      { close: 103, high: 104, low: 99 },
    ])
    const result = applyInteractions(z, candles)
    // retested remains true but shouldn't have changed
    expect(result.retested).toBe(true)
  })
})
