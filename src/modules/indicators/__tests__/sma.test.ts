import { describe, it, expect } from 'vitest'
import { computeSma } from '../compute/sma'

describe('computeSma', () => {
  it('returns null when closes.length < period', () => {
    expect(computeSma([1, 2], 3)).toBeNull()
    expect(computeSma([], 20)).toBeNull()
  })

  it('returns correct average for known input', () => {
    // Last 3 of [2, 4, 6, 8, 10] = [6, 8, 10], avg = 8
    expect(computeSma([2, 4, 6, 8, 10], 3)).toBeCloseTo(8)
  })

  it('uses only the last period values, not all closes', () => {
    // prepend large values that should not affect the result
    const closes = [1000, 1000, 1000, 1, 2, 3]
    expect(computeSma(closes, 3)).toBeCloseTo(2)
  })

  it('equals the input when period equals length', () => {
    expect(computeSma([3, 6, 9], 3)).toBeCloseTo(6)
  })

  it('returns a constant when all inputs are equal', () => {
    expect(computeSma(Array(50).fill(25), 20)).toBeCloseTo(25)
  })
})
