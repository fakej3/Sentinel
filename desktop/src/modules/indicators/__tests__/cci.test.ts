import { describe, it, expect } from 'vitest'
import { computeCci } from '../compute/cci'

describe('computeCci', () => {
  it('returns null when closes.length < period', () => {
    expect(computeCci(Array(19).fill(12), Array(19).fill(10), Array(19).fill(11), 20)).toBeNull()
    expect(computeCci([], [], [], 20)).toBeNull()
  })

  it('returns 0 when all typical prices are equal', () => {
    const n = 20
    const h = Array(n).fill(12)
    const l = Array(n).fill(10)
    const c = Array(n).fill(11)
    expect(computeCci(h, l, c, n)).toBeCloseTo(0)
  })

  it('computes known result', () => {
    // 3 bars, period = 3
    // Bar 0: H=12, L=10, C=11 → TP=11
    // Bar 1: H=14, L=12, C=13 → TP=13
    // Bar 2: H=15, L=13, C=14 → TP=14
    // Mean TP = (11+13+14)/3 ≈ 12.667
    // Mean Dev = (|11-12.667| + |13-12.667| + |14-12.667|) / 3
    //          = (1.667 + 0.333 + 1.333) / 3 = 1.111
    // CCI = (14 - 12.667) / (0.015 * 1.111) ≈ 80
    const result = computeCci([12, 14, 15], [10, 12, 13], [11, 13, 14], 3)!
    expect(result).toBeCloseTo(80, 0)
  })

  it('returns a positive value when last TP is above mean', () => {
    // Prices trending up: last TP should be above average
    const n = 5
    const closes = [10, 11, 12, 13, 20]
    const highs = closes.map(c => c + 1)
    const lows = closes.map(c => c - 1)
    const cci = computeCci(highs, lows, closes, n)!
    expect(cci).toBeGreaterThan(0)
  })

  it('returns a negative value when last TP is below mean', () => {
    const n = 5
    const closes = [20, 19, 18, 17, 10]
    const highs = closes.map(c => c + 1)
    const lows = closes.map(c => c - 1)
    const cci = computeCci(highs, lows, closes, n)!
    expect(cci).toBeLessThan(0)
  })
})
