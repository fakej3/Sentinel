import { describe, it, expect } from 'vitest'
import { computeVwap } from '../compute/vwap'

describe('computeVwap', () => {
  it('returns last close when all volumes are zero', () => {
    expect(computeVwap([110], [90], [100], [0])).toBe(100)
  })

  it('returns the typical price for a single candle', () => {
    // TP = (12 + 10 + 11) / 3 = 11
    expect(computeVwap([12], [10], [11], [100])).toBeCloseTo(11)
  })

  it('computes weighted average correctly', () => {
    // Bar 0: TP = 11, volume = 100 → contribution = 1100
    // Bar 1: TP = 13, volume = 200 → contribution = 2600
    // VWAP = 3700 / 300 ≈ 12.333
    const vwap = computeVwap([12, 14], [10, 12], [11, 13], [100, 200])
    expect(vwap).toBeCloseTo(12.333, 2)
  })

  it('equals the single typical price when all candles are identical', () => {
    const n = 10
    const highs = Array(n).fill(12)
    const lows = Array(n).fill(10)
    const closes = Array(n).fill(11)
    const volumes = Array(n).fill(100)
    // TP = 11, VWAP = 11
    expect(computeVwap(highs, lows, closes, volumes)).toBeCloseTo(11)
  })

  it('is biased toward the higher-volume bar', () => {
    // Bar 0: TP = 100, volume = 10
    // Bar 1: TP = 200, volume = 990
    // VWAP should be much closer to 200
    const vwap = computeVwap([105, 205], [95, 195], [100, 200], [10, 990])
    expect(vwap).toBeGreaterThan(190)
  })
})
