import { describe, it, expect } from 'vitest'
import { computeEma } from '../compute/ema'

describe('computeEma', () => {
  it('returns null when closes.length < period', () => {
    expect(computeEma([1, 2, 3], 5)).toBeNull()
    expect(computeEma([], 20)).toBeNull()
  })

  it('returns SMA when exactly period candles are provided', () => {
    // SMA of [2, 4, 6] = 4
    expect(computeEma([2, 4, 6], 3)).toBeCloseTo(4)
  })

  it('returns correct EMA for period 3', () => {
    // closes = [2, 4, 6, 8, 10], period = 3
    // Seed = 4, k = 0.5
    // After 8: 8*0.5 + 4*0.5 = 6
    // After 10: 10*0.5 + 6*0.5 = 8
    expect(computeEma([2, 4, 6, 8, 10], 3)).toBeCloseTo(8)
  })

  it('returns a constant when all closes are equal', () => {
    expect(computeEma(Array(50).fill(42), 20)).toBeCloseTo(42)
  })

  it('is below current close in a monotonically rising series (lagging)', () => {
    const closes = Array.from({ length: 100 }, (_, i) => i + 1)
    const ema = computeEma(closes, 20)!
    expect(ema).toBeLessThan(closes[closes.length - 1])
  })

  it('is above current close in a monotonically falling series (lagging)', () => {
    const closes = Array.from({ length: 100 }, (_, i) => 100 - i)
    const ema = computeEma(closes, 20)!
    expect(ema).toBeGreaterThan(closes[closes.length - 1])
  })
})
