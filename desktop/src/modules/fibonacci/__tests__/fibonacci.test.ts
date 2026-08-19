import { describe, it, expect } from 'vitest'
import { computeFibonacci } from '../compute'
import type { SwingPoint } from '../../market-structure/types'
import type { SupportResistanceResult } from '../../support-resistance/types'

function swing(index: number, price: number, type: 'high' | 'low', label: 'HH' | 'HL' | 'LH' | 'LL' | null = null): SwingPoint {
  return { index, timestamp: index * 60000, price, type, label }
}

const emptySR: SupportResistanceResult = {
  zones: [],
  activeSupport: [],
  activeResistance: [],
  nearestSupport: null,
  nearestResistance: null,
  currentZone: null,
  evidence: [],
}

function makeZone(center: number, type: 'support' | 'resistance'): import('../../support-resistance/types').PriceZone {
  return {
    id: `z-${center}`,
    type,
    origin: 'swing-high',
    state: 'active',
    center,
    upper: center + 1,
    lower: center - 1,
    width: 2,
    touchCount: 2,
    successfulReactions: 2,
    failedReactions: 0,
    broken: false,
    retested: false,
    firstDetectedIndex: 1,
    lastInteractionIndex: 5,
    age: 4,
    strength: 7,
    confidence: 7,
    evidence: [],
  }
}

describe('computeFibonacci', () => {
  it('returns unavailable when there are no swings', () => {
    const result = computeFibonacci([], 'bullish', emptySR, null)
    expect(result.available).toBe(false)
    expect(result.levels).toHaveLength(0)
  })

  it('returns unavailable when only one swing type exists', () => {
    const swings = [swing(0, 100, 'high', 'HH'), swing(5, 110, 'high', 'HH')]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    expect(result.available).toBe(false)
  })

  it('computes 11 levels for a bullish move (8 retracements + 3 extensions)', () => {
    const swings = [
      swing(0, 100,  'low',  'HL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    expect(result.available).toBe(true)
    expect(result.levels).toHaveLength(11)
  })

  it('includes the 0.000 anchor level at the swing-high price for a bullish move', () => {
    const swings = [
      swing(0, 100,  'low',  'HL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    const level0 = result.levels.find(l => l.ratio === 0.000)
    expect(level0).toBeDefined()
    expect(level0!.price).toBeCloseTo(200, 4)
    expect(level0!.isExtension).toBe(false)
  })

  it('includes the 0.000 anchor level at the swing-low price for a bearish move', () => {
    const swings = [
      swing(0,  200, 'high', 'LH'),
      swing(10, 100, 'low',  'LL'),
    ]
    const result = computeFibonacci(swings, 'bearish', emptySR, null)
    const level0 = result.levels.find(l => l.ratio === 0.000)
    expect(level0).toBeDefined()
    expect(level0!.price).toBeCloseTo(100, 4)
    expect(level0!.isExtension).toBe(false)
  })

  it('prices the 0.618 level correctly for a bullish move', () => {
    // range: 200 → 100, so range = 100
    // 0.618 retracement from high = 200 - 0.618*100 = 138.2
    const swings = [
      swing(0,  100, 'low',  'HL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    const level618 = result.levels.find(l => l.ratio === 0.618)
    expect(level618).toBeDefined()
    expect(level618!.price).toBeCloseTo(138.2, 4)
  })

  it('prices the 0.618 level correctly for a bearish move', () => {
    // range: low=100 high=200, direction=bearish (high came first)
    // 0.618 retracement from low = 100 + 0.618*100 = 161.8
    const swings = [
      swing(0,  200, 'high', 'LH'),
      swing(10, 100, 'low',  'LL'),
    ]
    const result = computeFibonacci(swings, 'bearish', emptySR, null)
    const level618 = result.levels.find(l => l.ratio === 0.618)
    expect(level618).toBeDefined()
    expect(level618!.price).toBeCloseTo(161.8, 4)
  })

  it('marks 0.618 and 0.650 as golden pocket levels', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    const gp = result.levels.filter(l => l.isGoldenPocket)
    expect(gp.map(l => l.ratio).sort()).toEqual([0.618, 0.650])
  })

  it('marks extension levels correctly', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    const exts = result.levels.filter(l => l.isExtension)
    expect(exts.map(l => l.ratio)).toEqual([1.272, 1.618, 2.000])
  })

  it('detects confluence when an S/R zone is within 0.5% of a fib level', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    // 0.618 level = 138.2 — place a support zone at 138.5 (delta ≈ 0.22%)
    const srWithConfluence: SupportResistanceResult = {
      ...emptySR,
      zones: [makeZone(138.5, 'support')],
    }
    const result = computeFibonacci(swings, 'bullish', srWithConfluence, null)
    const level618 = result.levels.find(l => l.ratio === 0.618)
    expect(level618?.confluence).toBe(true)
    expect(level618?.confluenceType).toBe('support')
  })

  it('does NOT mark confluence when S/R zone is farther than 0.5%', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    // 0.618 level = 138.2 — place zone at 145 (delta ≈ 4.9%)
    const srFar: SupportResistanceResult = {
      ...emptySR,
      zones: [makeZone(145, 'resistance')],
    }
    const result = computeFibonacci(swings, 'bullish', srFar, null)
    const level618 = result.levels.find(l => l.ratio === 0.618)
    expect(level618?.confluence).toBe(false)
  })

  it('returns unavailable when no valid bullish impulse (HH+HL) exists in the swings', () => {
    // Bearish-to-bullish transition: LL, LH, LL, HH — no HL present.
    // Without a confirmed HL preceding the HH there is no valid bullish impulse leg.
    const swings = [
      swing(0,  100, 'low',  'LL'),
      swing(2,  110, 'high', 'LH'),
      swing(5,  80,  'low',  'LL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    expect(result.available).toBe(false)
  })

  it('selects the most recent HH+HL impulse pair from multiple swings', () => {
    // Two bullish impulse legs — algorithm must pick the most recent one (HH@200 + HL@90)
    const swings = [
      swing(0,  80,  'low',  'HL'),
      swing(5,  150, 'high', 'HH'),
      swing(7,  90,  'low',  'HL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR, null)
    expect(result.available).toBe(true)
    expect(result.swingHigh.price).toBe(200)
    expect(result.swingLow.price).toBe(90)
  })
})

describe('computeFibonacci — ATR impulse floor', () => {
  const impulse = (lowPrice: number, highPrice: number) => [
    swing(0,  lowPrice,  'low',  'HL'),
    swing(10, highPrice, 'high', 'HH'),
  ]

  it('rejects an impulse smaller than 1× ATR as noise', () => {
    // Impulse range = 5, ATR = 20 → leg is well inside single-bar noise
    const result = computeFibonacci(impulse(100, 105), 'bullish', emptySR, 20)
    expect(result.available).toBe(false)
    expect(result.unavailable?.code).toBe('not-applicable')
    expect(result.unavailable?.detail).toMatch(/ATR/)
  })

  it('accepts an impulse of at least 1× ATR', () => {
    // Impulse range = 100, ATR = 20 → 5× ATR, clearly structural
    const result = computeFibonacci(impulse(100, 200), 'bullish', emptySR, 20)
    expect(result.available).toBe(true)
  })

  it('accepts an impulse exactly at the 1× ATR boundary', () => {
    // range = 20, ATR = 20 → range < 1.0×ATR is false at equality → accepted
    const result = computeFibonacci(impulse(100, 120), 'bullish', emptySR, 20)
    expect(result.available).toBe(true)
  })

  it('skips the size filter when ATR is unavailable (null)', () => {
    const result = computeFibonacci(impulse(100, 105), 'bullish', emptySR, null)
    expect(result.available).toBe(true)  // no volatility unit to measure against
  })
})

describe('computeFibonacci — availability reasons and direction authority', () => {
  it('ranging trend is unavailable with an explicit reason', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    const result = computeFibonacci(swings, 'ranging', emptySR, null)
    expect(result.available).toBe(false)
    // A ranging market is 'not-applicable', not 'insufficient-*': the data is
    // complete and the computation would produce numbers — they would just
    // describe a retracement of a move that never happened.
    expect(result.unavailable?.code).toBe('not-applicable')
    expect(result.unavailable?.detail).toMatch(/[Rr]anging/)
  })

  it('missing impulse leg reports which pattern was required', () => {
    const swings = [swing(0, 100, 'low', 'LL'), swing(10, 200, 'high', 'LH')]
    const bullish = computeFibonacci(swings, 'bullish', emptySR, null)
    expect(bullish.unavailable?.code).toBe('insufficient-structure')
    expect(bullish.unavailable?.detail).toMatch(/HH\+HL/)
    const bearish = computeFibonacci(swings, 'bearish', emptySR, null)
    expect(bearish.unavailable?.code).toBe('insufficient-structure')
    expect(bearish.unavailable?.detail).toMatch(/LL\+LH/)
  })
})

describe('computeFibonacci — confluence excludes broken zones', () => {
  it('a broken zone at a fib level does NOT mark confluence', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    // 0.618 level = 138.2 — a zone sits right there but has been broken
    const srBroken: SupportResistanceResult = {
      ...emptySR,
      zones: [{ ...makeZone(138.5, 'support'), broken: true, state: 'broken' }],
    }
    const result = computeFibonacci(swings, 'bullish', srBroken, null)
    const level618 = result.levels.find(l => l.ratio === 0.618)
    expect(level618?.confluence).toBe(false)
  })

  it('an intact zone at the same price still marks confluence (control)', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    const srIntact: SupportResistanceResult = {
      ...emptySR,
      zones: [makeZone(138.5, 'support')],
    }
    const result = computeFibonacci(swings, 'bullish', srIntact, null)
    expect(result.levels.find(l => l.ratio === 0.618)?.confluence).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Fib anchor integrity — swingHigh and swingLow in the result must exactly
// match the price and timestamp of the source swing points that the engine
// selected. Any mismatch would cause chart drawings to float off the wrong bar.
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFibonacci — anchor integrity', () => {
  it('swingHigh.price and swingHigh.timestamp match the source HH swing', () => {
    const hl  = swing(0,  100, 'low',  'HL')
    const hh  = swing(10, 200, 'high', 'HH')
    const result = computeFibonacci([hl, hh], 'bullish', emptySR, null)
    expect(result.available).toBe(true)
    expect(result.swingHigh.price).toBe(hh.price)
    expect(result.swingHigh.timestamp).toBe(hh.timestamp)
  })

  it('swingLow.price and swingLow.timestamp match the source HL swing', () => {
    const hl  = swing(0,  100, 'low',  'HL')
    const hh  = swing(10, 200, 'high', 'HH')
    const result = computeFibonacci([hl, hh], 'bullish', emptySR, null)
    expect(result.available).toBe(true)
    expect(result.swingLow.price).toBe(hl.price)
    expect(result.swingLow.timestamp).toBe(hl.timestamp)
  })

  it('bearish: swingHigh matches LH and swingLow matches LL', () => {
    const lh = swing(0,  200, 'high', 'LH')
    const ll = swing(10, 100, 'low',  'LL')
    const result = computeFibonacci([lh, ll], 'bearish', emptySR, null)
    expect(result.available).toBe(true)
    expect(result.swingHigh.price).toBe(lh.price)
    expect(result.swingHigh.timestamp).toBe(lh.timestamp)
    expect(result.swingLow.price).toBe(ll.price)
    expect(result.swingLow.timestamp).toBe(ll.timestamp)
  })

  it('most recent impulse is preferred over earlier legs', () => {
    // Two bullish legs: HL1→HH1 (older) and HL2→HH2 (newer)
    const hl1 = swing(0,  100, 'low',  'HL')
    const hh1 = swing(5,  150, 'high', 'HH')
    const hl2 = swing(8,  130, 'low',  'HL')
    const hh2 = swing(15, 180, 'high', 'HH')
    const result = computeFibonacci([hl1, hh1, hl2, hh2], 'bullish', emptySR, null)
    expect(result.available).toBe(true)
    // The most recent HH is hh2; its preceding HL is hl2
    expect(result.swingHigh.price).toBe(hh2.price)
    expect(result.swingLow.price).toBe(hl2.price)
  })

  it('fib level prices are bounded within [swingLow.price, swingHigh.price] for retracements', () => {
    const hl  = swing(0,  100, 'low',  'HL')
    const hh  = swing(10, 200, 'high', 'HH')
    const result = computeFibonacci([hl, hh], 'bullish', emptySR, null)
    const retracements = result.levels.filter(l => !l.isExtension)
    for (const level of retracements) {
      expect(level.price).toBeGreaterThanOrEqual(hl.price - 0.001)
      expect(level.price).toBeLessThanOrEqual(hh.price + 0.001)
    }
  })
})
