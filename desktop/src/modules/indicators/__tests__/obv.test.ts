import { describe, it, expect } from 'vitest'
import { computeObv } from '../compute/obv'

describe('computeObv', () => {
  it('returns 0 for a single candle (no comparisons possible)', () => {
    expect(computeObv([100], [500])).toBe(0)
  })

  it('adds volume when price rises', () => {
    // closes [100, 110]: rise → OBV += 300
    expect(computeObv([100, 110], [100, 300])).toBe(300)
  })

  it('subtracts volume when price falls', () => {
    // closes [110, 100]: fall → OBV -= 300
    expect(computeObv([110, 100], [100, 300])).toBe(-300)
  })

  it('does not change OBV when price is unchanged', () => {
    expect(computeObv([100, 100, 100], [100, 200, 300])).toBe(0)
  })

  it('computes cumulative OBV correctly for a known sequence', () => {
    // closes [10, 11, 10, 12], volumes [100, 200, 300, 400]
    // i=1: 11>10, OBV += 200 → 200
    // i=2: 10<11, OBV -= 300 → -100
    // i=3: 12>10, OBV += 400 → 300
    expect(computeObv([10, 11, 10, 12], [100, 200, 300, 400])).toBe(300)
  })

  it('all-up prices: OBV equals sum of all volumes except the first', () => {
    const closes = [1, 2, 3, 4, 5]
    const volumes = [100, 200, 300, 400, 500]
    // OBV = 200+300+400+500 = 1400
    expect(computeObv(closes, volumes)).toBe(1400)
  })

  it('all-down prices: OBV equals negative sum of all volumes except the first', () => {
    const closes = [5, 4, 3, 2, 1]
    const volumes = [100, 200, 300, 400, 500]
    // OBV = -(200+300+400+500) = -1400
    expect(computeObv(closes, volumes)).toBe(-1400)
  })
})
