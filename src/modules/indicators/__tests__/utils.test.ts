import { describe, it, expect } from 'vitest'
import { emaSeries, rsiSeries } from '../utils'

describe('emaSeries', () => {
  it('returns empty array when values.length < period', () => {
    expect(emaSeries([1, 2], 3)).toEqual([])
  })

  it('first value equals SMA seed when values.length === period', () => {
    const series = emaSeries([2, 4, 6], 3)
    expect(series).toHaveLength(1)
    expect(series[0]).toBeCloseTo(4)
  })

  it('computes correct EMA for period 3', () => {
    // closes = [2, 4, 6, 8, 10]
    // Seed: (2+4+6)/3 = 4, k = 0.5
    // EMA at 8: 8*0.5 + 4*0.5 = 6
    // EMA at 10: 10*0.5 + 6*0.5 = 8
    const series = emaSeries([2, 4, 6, 8, 10], 3)
    expect(series).toHaveLength(3)
    expect(series[0]).toBeCloseTo(4)
    expect(series[1]).toBeCloseTo(6)
    expect(series[2]).toBeCloseTo(8)
  })

  it('converges toward recent price in a rising series', () => {
    const closes = Array.from({ length: 50 }, (_, i) => i + 1)
    const series = emaSeries(closes, 10)
    const last = series[series.length - 1]
    // EMA should be below current close (lagging) but above older prices
    expect(last).toBeLessThan(closes[closes.length - 1])
    expect(last).toBeGreaterThan(closes[0])
  })

  it('returns series of length values.length - period + 1', () => {
    const series = emaSeries(Array(20).fill(100), 5)
    expect(series).toHaveLength(16)
  })

  it('returns constant value when all inputs are equal', () => {
    const series = emaSeries(Array(10).fill(50), 3)
    for (const v of series) expect(v).toBeCloseTo(50)
  })
})

describe('rsiSeries', () => {
  it('returns empty array when closes.length < period + 1', () => {
    expect(rsiSeries([1, 2, 3], 3)).toEqual([]) // need 4 closes for period 3
  })

  it('returns 100 when all closes are increasing', () => {
    const closes = Array.from({ length: 20 }, (_, i) => i + 1)
    const series = rsiSeries(closes, 14)
    for (const v of series) expect(v).toBeCloseTo(100)
  })

  it('returns 0 when all closes are decreasing', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 20 - i)
    const series = rsiSeries(closes, 14)
    for (const v of series) expect(v).toBeCloseTo(0)
  })

  it('returns values between 0 and 100', () => {
    const closes = [10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18, 17, 19]
    const series = rsiSeries(closes, 14)
    for (const v of series) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('returns 50 when gains and losses are equal in magnitude', () => {
    // Alternating +1 / -1, so avgGain = avgLoss → RSI = 50
    const closes = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10]
    const series = rsiSeries(closes, 14)
    expect(series[series.length - 1]).toBeCloseTo(50, 0)
  })

  it('returns series of length closes.length - period', () => {
    const closes = Array(20).fill(0).map((_, i) => i)
    const series = rsiSeries(closes, 14)
    expect(series).toHaveLength(6) // 20 - 14 = 6
  })
})
