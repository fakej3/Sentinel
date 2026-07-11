import { describe, it, expect } from 'vitest'
import { computeBollinger } from '../compute/bollinger'

describe('computeBollinger', () => {
  it('returns null when closes.length < period', () => {
    expect(computeBollinger(Array(19).fill(100), 20)).toBeNull()
    expect(computeBollinger([], 20)).toBeNull()
  })

  it('upper = middle = lower when all closes are equal (zero std dev)', () => {
    const result = computeBollinger(Array(20).fill(100), 20)!
    expect(result.upper).toBeCloseTo(100)
    expect(result.middle).toBeCloseTo(100)
    expect(result.lower).toBeCloseTo(100)
    expect(result.bandwidth).toBeCloseTo(0)
  })

  it('middle equals SMA of the last period closes', () => {
    // last 3 of [2, 4, 6, 8, 10] = [6, 8, 10], SMA = 8
    const result = computeBollinger([2, 4, 6, 8, 10], 3)!
    expect(result.middle).toBeCloseTo(8)
  })

  it('upper > middle > lower when there is variance', () => {
    const closes = [2, 4, 6, 8, 10]
    const result = computeBollinger(closes, 3)!
    expect(result.upper).toBeGreaterThan(result.middle)
    expect(result.middle).toBeGreaterThan(result.lower)
  })

  it('upper and lower are symmetric around the middle', () => {
    const result = computeBollinger([2, 4, 6, 8, 10], 3)!
    const upperDiff = result.upper - result.middle
    const lowerDiff = result.middle - result.lower
    expect(upperDiff).toBeCloseTo(lowerDiff, 8)
  })

  it('bandwidth is upper - lower', () => {
    const result = computeBollinger([10, 20, 15, 25, 12], 3)!
    expect(result.bandwidth).toBeCloseTo(result.upper - result.lower, 8)
  })

  it('wider bands for higher volatility', () => {
    const stable = Array(20).fill(100).map((v, i) => v + (i % 2 === 0 ? 1 : -1))
    const volatile = Array(20).fill(100).map((v, i) => v + (i % 2 === 0 ? 10 : -10))
    const stableResult = computeBollinger(stable, 20)!
    const volatileResult = computeBollinger(volatile, 20)!
    expect(volatileResult.bandwidth).toBeGreaterThan(stableResult.bandwidth)
  })
})
