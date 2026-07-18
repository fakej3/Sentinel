import { describe, it, expect } from 'vitest'
import { computeStochRsi } from '../compute/stoch-rsi'

describe('computeStochRsi', () => {
  it('returns null when insufficient data', () => {
    expect(computeStochRsi(Array(20).fill(100), 14, 14, 3, 3)).toBeNull()
    expect(computeStochRsi([], 14, 14, 3, 3)).toBeNull()
  })

  it('returns an object with k and d', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10)
    const result = computeStochRsi(closes)!
    expect(result).toHaveProperty('k')
    expect(result).toHaveProperty('d')
  })

  it('k and d are between 0 and 1 (approximately)', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10)
    const result = computeStochRsi(closes)!
    expect(result.k).toBeGreaterThanOrEqual(-0.01) // floating point tolerance
    expect(result.k).toBeLessThanOrEqual(1.01)
    expect(result.d).toBeGreaterThanOrEqual(-0.01)
    expect(result.d).toBeLessThanOrEqual(1.01)
  })

  it('returns high k/d values in a strong uptrend', () => {
    // Mostly-up with small periodic dips so RSI varies (pure uptrend collapses stoch range to 0)
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 3 + (i % 4 === 0 ? -4 : 0))
    const result = computeStochRsi(closes)!
    expect(result.k).toBeGreaterThan(0.5)
    expect(result.d).toBeGreaterThan(0.5)
  })

  it('returns low k/d values in a strong downtrend', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 60 - i)
    const result = computeStochRsi(closes)!
    expect(result.k).toBeLessThan(0.5)
    expect(result.d).toBeLessThan(0.5)
  })

  it('returns k near 0.5 when RSI range is flat (not extreme oversold)', () => {
    // Constant price → RSI series is constant → stoch range is 0
    // Must return neutral (0.5) not extreme oversold (0)
    const closes = Array(60).fill(100)
    const result = computeStochRsi(closes)!
    expect(result.k).toBeCloseTo(0.5, 5)
    expect(result.d).toBeCloseTo(0.5, 5)
  })
})
