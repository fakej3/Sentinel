import { describe, it, expect } from 'vitest'
import { extractPriceSummary } from '../compute/price'
import { marketData, indicators } from './helpers'

describe('extractPriceSummary', () => {
  it('returns current price from ticker.lastPrice', () => {
    const result = extractPriceSummary(marketData(50000), indicators())
    expect(result.current).toBe(50000)
  })

  it('returns 24h change percent from ticker', () => {
    const result = extractPriceSummary(marketData(50000, { change24hPercent: 3.5 }), indicators())
    expect(result.change24hPercent).toBe(3.5)
  })

  it('returns 24h high and low from ticker', () => {
    const result = extractPriceSummary(
      marketData(50000, { high24h: 52000, low24h: 48000 }),
      indicators(),
    )
    expect(result.high24h).toBe(52000)
    expect(result.low24h).toBe(48000)
  })

  it('returns atrPercent from indicators', () => {
    const result = extractPriceSummary(marketData(50000), indicators({ atrPercent: 2.5 }))
    expect(result.atrPercent).toBe(2.5)
  })

  it('returns null atrPercent when ATR is unavailable', () => {
    const result = extractPriceSummary(marketData(50000), indicators({ atrPercent: null }))
    expect(result.atrPercent).toBeNull()
  })
})
