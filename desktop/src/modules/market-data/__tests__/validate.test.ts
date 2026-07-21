import { describe, it, expect } from 'vitest'
import { validateCandles, repairCandles } from '../validate'
import type { Candle } from '../../market/types'

function candle(openTime: number, overrides: Partial<Candle> = {}): Candle {
  return {
    openTime,
    closeTime: openTime + 3_600_000,
    open:  100,
    high:  110,
    low:   90,
    close: 105,
    volume: 1000,
    quoteVolume: 100_000,
    trades: 500,
    takerBuyVolume: 600,
    takerSellVolume: 400,
    ...overrides,
  }
}

describe('validateCandles', () => {
  it('returns valid for a well-formed single candle', () => {
    const result = validateCandles([candle(1_000_000)])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid with a warning for an empty array', () => {
    const result = validateCandles([])
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('Empty candle array')
  })

  it('returns valid for ascending timestamps', () => {
    const result = validateCandles([candle(1000), candle(2000), candle(3000)])
    expect(result.valid).toBe(true)
  })

  it('errors on non-ascending openTime', () => {
    const result = validateCandles([candle(2000), candle(1000)])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('not strictly after'))).toBe(true)
  })

  it('errors on duplicate openTime', () => {
    const result = validateCandles([candle(1000), candle(2000), candle(1000)])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Duplicate openTime'))).toBe(true)
  })

  it('errors when high < low', () => {
    const result = validateCandles([candle(1000, { high: 80, low: 90 })])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('high < low'))).toBe(true)
  })

  it('errors when high < open', () => {
    const result = validateCandles([candle(1000, { high: 95, open: 100 })])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('high is less than open'))).toBe(true)
  })

  it('errors when low > close', () => {
    const result = validateCandles([candle(1000, { low: 110, close: 105 })])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('low is greater than open or close'))).toBe(true)
  })

  it('errors on negative open price', () => {
    const result = validateCandles([candle(1000, { open: -1 })])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('invalid open'))).toBe(true)
  })

  it('errors on invalid openTime (zero)', () => {
    const result = validateCandles([candle(0)])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('invalid openTime'))).toBe(true)
  })

  it('errors when closeTime <= openTime', () => {
    const result = validateCandles([candle(1000, { closeTime: 500 })])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('closeTime must be after openTime'))).toBe(true)
  })

  it('errors on negative volume', () => {
    const result = validateCandles([candle(1000, { volume: -5 })])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('invalid volume'))).toBe(true)
  })

  it('collects multiple errors per candle', () => {
    const result = validateCandles([candle(1000, { open: -1, high: -2, low: -3 })])
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('repairCandles', () => {
  it('returns candles sorted by openTime', () => {
    const input = [candle(3000), candle(1000), candle(2000)]
    const result = repairCandles(input)
    expect(result.map(c => c.openTime)).toEqual([1000, 2000, 3000])
  })

  it('removes duplicate openTimes (keeps last occurrence)', () => {
    const first  = candle(1000, { close: 101 })
    const second = candle(1000, { close: 102 })
    const result = repairCandles([first, second])
    expect(result).toHaveLength(1)
    expect(result[0].close).toBe(102)
  })

  it('does not mutate the input array', () => {
    const input = [candle(2000), candle(1000)]
    const copy = [...input]
    repairCandles(input)
    expect(input[0].openTime).toBe(copy[0].openTime)
  })
})
