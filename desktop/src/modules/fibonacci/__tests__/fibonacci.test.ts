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
    const result = computeFibonacci([], 'bullish', emptySR)
    expect(result.available).toBe(false)
    expect(result.levels).toHaveLength(0)
  })

  it('returns unavailable when only one swing type exists', () => {
    const swings = [swing(0, 100, 'high', 'HH'), swing(5, 110, 'high', 'HH')]
    const result = computeFibonacci(swings, 'bullish', emptySR)
    expect(result.available).toBe(false)
  })

  it('computes 10 levels for a bullish move (7 retracements + 3 extensions)', () => {
    const swings = [
      swing(0, 100,  'low',  'HL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR)
    expect(result.available).toBe(true)
    expect(result.levels).toHaveLength(10)
  })

  it('prices the 0.618 level correctly for a bullish move', () => {
    // range: 200 → 100, so range = 100
    // 0.618 retracement from high = 200 - 0.618*100 = 138.2
    const swings = [
      swing(0,  100, 'low',  'HL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR)
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
    const result = computeFibonacci(swings, 'bearish', emptySR)
    const level618 = result.levels.find(l => l.ratio === 0.618)
    expect(level618).toBeDefined()
    expect(level618!.price).toBeCloseTo(161.8, 4)
  })

  it('marks 0.618 and 0.650 as golden pocket levels', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    const result = computeFibonacci(swings, 'bullish', emptySR)
    const gp = result.levels.filter(l => l.isGoldenPocket)
    expect(gp.map(l => l.ratio).sort()).toEqual([0.618, 0.650])
  })

  it('marks extension levels correctly', () => {
    const swings = [swing(0, 100, 'low', 'HL'), swing(10, 200, 'high', 'HH')]
    const result = computeFibonacci(swings, 'bullish', emptySR)
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
    const result = computeFibonacci(swings, 'bullish', srWithConfluence)
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
    const result = computeFibonacci(swings, 'bullish', srFar)
    const level618 = result.levels.find(l => l.ratio === 0.618)
    expect(level618?.confluence).toBe(false)
  })

  it('selects the dominant (widest range) pair from multiple swings', () => {
    // small move first, big move second — algorithm should pick the bigger one
    const swings = [
      swing(0,  100, 'low',  'LL'),
      swing(2,  110, 'high', 'LH'),
      swing(5,  80,  'low',  'LL'),
      swing(10, 200, 'high', 'HH'),
    ]
    const result = computeFibonacci(swings, 'bullish', emptySR)
    expect(result.available).toBe(true)
    // Dominant pair: low@80, high@200 → range=120
    expect(result.swingHigh.price).toBe(200)
    expect(result.swingLow.price).toBe(80)
  })
})
