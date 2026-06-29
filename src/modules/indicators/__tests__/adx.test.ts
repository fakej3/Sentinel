import { describe, it, expect } from 'vitest'
import { computeAdx } from '../compute/adx'

function makeCandles(closes: number[], range = 1) {
  return {
    highs: closes.map(c => c + range),
    lows: closes.map(c => c - range),
    closes,
  }
}

describe('computeAdx', () => {
  it('returns null when closes.length < period * 2', () => {
    const { highs, lows, closes } = makeCandles(Array(27).fill(100))
    expect(computeAdx(highs, lows, closes, 14)).toBeNull()
  })

  it('returns an object with adx, diPlus, diMinus', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i)
    const { highs, lows } = makeCandles(closes)
    const result = computeAdx(highs, lows, closes, 14)!
    expect(result).toHaveProperty('adx')
    expect(result).toHaveProperty('diPlus')
    expect(result).toHaveProperty('diMinus')
  })

  it('all output values are non-negative', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 10)
    const { highs, lows } = makeCandles(closes)
    const result = computeAdx(highs, lows, closes, 14)!
    expect(result.adx).toBeGreaterThanOrEqual(0)
    expect(result.diPlus).toBeGreaterThanOrEqual(0)
    expect(result.diMinus).toBeGreaterThanOrEqual(0)
  })

  it('diPlus > diMinus in a strong uptrend', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 2)
    const highs = closes.map(c => c + 1)
    const lows = closes.map((c, i) => i === 0 ? c - 1 : closes[i - 1] + 0.5) // always higher lows
    const result = computeAdx(highs, lows, closes, 14)!
    expect(result.diPlus).toBeGreaterThan(result.diMinus)
  })

  it('diMinus > diPlus in a strong downtrend', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 200 - i * 2)
    const lows = closes.map(c => c - 1)
    const highs = closes.map((c, i) => i === 0 ? c + 1 : closes[i - 1] - 0.5) // always lower highs
    const result = computeAdx(highs, lows, closes, 14)!
    expect(result.diMinus).toBeGreaterThan(result.diPlus)
  })

  it('adx is between 0 and 100', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i)
    const { highs, lows } = makeCandles(closes)
    const result = computeAdx(highs, lows, closes, 14)!
    expect(result.adx).toBeGreaterThanOrEqual(0)
    expect(result.adx).toBeLessThanOrEqual(100)
  })
})
