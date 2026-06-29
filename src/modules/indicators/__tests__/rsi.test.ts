import { describe, it, expect } from 'vitest'
import { computeRsi } from '../compute/rsi'

const rising = Array.from({ length: 20 }, (_, i) => i + 1)
const falling = Array.from({ length: 20 }, (_, i) => 20 - i)

describe('computeRsi', () => {
  it('returns null when closes.length < period + 1', () => {
    expect(computeRsi(Array(14).fill(1), 14)).toBeNull() // need 15
    expect(computeRsi([], 14)).toBeNull()
  })

  it('returns 100 when all closes are increasing', () => {
    expect(computeRsi(rising, 14)).toBeCloseTo(100)
  })

  it('returns 0 when all closes are decreasing', () => {
    expect(computeRsi(falling, 14)).toBeCloseTo(0)
  })

  it('returns a value between 0 and 100', () => {
    const mixed = [10, 12, 11, 14, 13, 15, 12, 16, 14, 17, 13, 18, 15, 19, 14, 20]
    const rsi = computeRsi(mixed, 14)!
    expect(rsi).toBeGreaterThanOrEqual(0)
    expect(rsi).toBeLessThanOrEqual(100)
  })

  it('returns ~50 for alternating equal up/down moves', () => {
    const closes = Array.from({ length: 29 }, (_, i) => i % 2 === 0 ? 10 : 11)
    const rsi = computeRsi(closes, 14)!
    expect(rsi).toBeGreaterThan(40)
    expect(rsi).toBeLessThan(60)
  })

  it('returns a higher RSI for a stronger uptrend', () => {
    const weakUp = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11]
    const strongUp = Array.from({ length: 16 }, (_, i) => 10 + i * 2)
    const rsiWeak = computeRsi(weakUp, 14)!
    const rsiStrong = computeRsi(strongUp, 14)!
    expect(rsiStrong).toBeGreaterThan(rsiWeak)
  })
})
