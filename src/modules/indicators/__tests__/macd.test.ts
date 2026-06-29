import { describe, it, expect } from 'vitest'
import { computeMacd } from '../compute/macd'

describe('computeMacd', () => {
  it('returns null when closes.length < 34', () => {
    expect(computeMacd(Array(33).fill(100))).toBeNull()
    expect(computeMacd([])).toBeNull()
  })

  it('returns zero MACD and signal when all closes are equal', () => {
    const result = computeMacd(Array(60).fill(100))!
    expect(result.macdLine).toBeCloseTo(0)
    expect(result.signalLine).toBeCloseTo(0)
    expect(result.histogram).toBeCloseTo(0)
    expect(result.bias).toBe('neutral')
  })

  it('histogram equals macdLine minus signalLine', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10)
    const result = computeMacd(closes)!
    expect(result.histogram).toBeCloseTo(result.macdLine - result.signalLine, 8)
  })

  it('returns bullish bias shortly after a sharp price jump', () => {
    // 26 flat bars warm up EMAs, then 10 bars at 200.
    // MACD line is still rising (signal hasn't caught up) → histogram > 0.
    const closes = [...Array(26).fill(100), ...Array(10).fill(200)]
    const result = computeMacd(closes)!
    expect(result.histogram).toBeGreaterThan(0)
    expect(result.bias).toBe('bullish')
  })

  it('returns bearish bias shortly after a sharp price drop', () => {
    const closes = [...Array(26).fill(200), ...Array(10).fill(100)]
    const result = computeMacd(closes)!
    expect(result.histogram).toBeLessThan(0)
    expect(result.bias).toBe('bearish')
  })

  it('bias is consistent with histogram sign', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 20)
    const result = computeMacd(closes)!
    if (result.histogram > 0) expect(result.bias).toBe('bullish')
    else if (result.histogram < 0) expect(result.bias).toBe('bearish')
    else expect(result.bias).toBe('neutral')
  })

  it('returns an object with all required fields', () => {
    const result = computeMacd(Array(50).fill(100))!
    expect(result).toHaveProperty('macdLine')
    expect(result).toHaveProperty('signalLine')
    expect(result).toHaveProperty('histogram')
    expect(result).toHaveProperty('bias')
  })
})
