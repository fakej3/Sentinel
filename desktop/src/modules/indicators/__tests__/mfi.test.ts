import { describe, it, expect } from 'vitest'
import { computeMfi } from '../compute/mfi'

describe('computeMfi', () => {
  it('returns null when closes.length < period + 1', () => {
    expect(computeMfi(
      Array(14).fill(12),
      Array(14).fill(10),
      Array(14).fill(11),
      Array(14).fill(100),
      14,
    )).toBeNull()
  })

  it('returns 100 when all typical prices are rising (no negative flow)', () => {
    const n = 20
    const closes = Array.from({ length: n }, (_, i) => 10 + i)
    const highs = closes.map(c => c + 1)
    const lows = closes.map(c => c - 1)
    const volumes = Array(n).fill(100)
    expect(computeMfi(highs, lows, closes, volumes, 14)).toBeCloseTo(100)
  })

  it('returns a value between 0 and 100', () => {
    const n = 20
    const closes = Array.from({ length: n }, (_, i) => i % 2 === 0 ? 100 + i : 100 - i)
    const highs = closes.map(c => c + 2)
    const lows = closes.map(c => c - 2)
    const volumes = Array(n).fill(200)
    const mfi = computeMfi(highs, lows, closes, volumes, 14)!
    expect(mfi).toBeGreaterThanOrEqual(0)
    expect(mfi).toBeLessThanOrEqual(100)
  })

  it('computes known result', () => {
    // 5 bars, period = 3
    // Bar 0: H=12, L=10, C=11, V=100, TP=11
    // Bar 1: H=14, L=12, C=13, V=200, TP=13 → TP > prev, positive MF = 13*200 = 2600
    // Bar 2: H=13, L=11, C=12, V=150, TP=12 → TP < prev, negative MF = 12*150 = 1800
    // Bar 3: H=15, L=13, C=14, V=100, TP=14 → TP > prev, positive MF = 14*100 = 1400
    // period=3: uses bars 1-3
    // Positive = 2600 + 1400 = 4000, Negative = 1800
    // MFI = 100 - 100/(1 + 4000/1800) ≈ 68.97
    const result = computeMfi(
      [12, 14, 13, 15],
      [10, 12, 11, 13],
      [11, 13, 12, 14],
      [100, 200, 150, 100],
      3,
    )!
    expect(result).toBeCloseTo(68.97, 1)
  })
})
