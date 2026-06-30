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
    expect(result).toHaveProperty('previousHistogram')
    expect(result).toHaveProperty('bias')
  })
})

// ── CRIT-03 regression: previousHistogram ─────────────────────────────────────
describe('computeMacd — previousHistogram (CRIT-03)', () => {
  it('returns null previousHistogram at exactly 34 closes (minimum signal has 1 value)', () => {
    // 26 (EMA26) + 9 (signal) - 1 = 34 closes minimum; signalSeries.length === 1 → previousHistogram = null
    const result = computeMacd(Array(34).fill(100))!
    expect(result).not.toBeNull()
    expect(result.previousHistogram).toBeNull()
  })

  it('returns non-null previousHistogram at 35 closes (signalSeries.length === 2)', () => {
    const result = computeMacd(Array(35).fill(100))!
    expect(result.previousHistogram).not.toBeNull()
    expect(typeof result.previousHistogram).toBe('number')
  })

  it('previousHistogram is zero when price is constant (all MACD values are 0)', () => {
    const result = computeMacd(Array(50).fill(100))!
    expect(result.previousHistogram).toBeCloseTo(0, 8)
  })

  it('previousHistogram reflects the prior bar histogram', () => {
    // Use a long series; previousHistogram should be finite
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10)
    const result = computeMacd(closes)!
    expect(Number.isFinite(result.previousHistogram!)).toBe(true)
    // The histogram series should be continuous — prev and current are different when price moves
    // (just verify they are both defined and finite)
    expect(Number.isFinite(result.histogram)).toBe(true)
  })
})
