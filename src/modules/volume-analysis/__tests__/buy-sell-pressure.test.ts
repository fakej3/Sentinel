import { describe, it, expect } from 'vitest'
import { computeBuySellPressure } from '../compute/buy-sell-pressure'
import { DEFAULT_CONFIG } from '../config'
import { candle } from './helpers'

describe('computeBuySellPressure', () => {
  it('sums takerBuyVolume and takerSellVolume over the pressure window', () => {
    const candles = Array.from({ length: 5 }, () =>
      candle({ close: 100, volume: 1000, takerBuyVolume: 600, takerSellVolume: 400 }),
    )
    const result = computeBuySellPressure(candles, DEFAULT_CONFIG)
    expect(result.buyVolume).toBe(3000)
    expect(result.sellVolume).toBe(2000)
  })

  it('only uses the last pressureWindow candles', () => {
    // 15 candles, pressureWindow=10 — only last 10 count
    const old = Array(5).fill(null).map(() =>
      candle({ close: 100, volume: 1000, takerBuyVolume: 0, takerSellVolume: 1000 }),
    )
    const recent = Array(10).fill(null).map(() =>
      candle({ close: 100, volume: 1000, takerBuyVolume: 700, takerSellVolume: 300 }),
    )
    const result = computeBuySellPressure([...old, ...recent], DEFAULT_CONFIG)
    expect(result.buyVolume).toBe(7000)
    expect(result.sellVolume).toBe(3000)
  })

  it('computes delta = buyVolume − sellVolume', () => {
    const candles = [candle({ close: 100, volume: 1000, takerBuyVolume: 700, takerSellVolume: 300 })]
    const result = computeBuySellPressure(candles, { ...DEFAULT_CONFIG, pressureWindow: 1 })
    expect(result.delta).toBe(400)
  })

  it('computes deltaPercent = (delta / totalVolume) × 100', () => {
    const candles = [candle({ close: 100, volume: 1000, takerBuyVolume: 600, takerSellVolume: 400 })]
    const result = computeBuySellPressure(candles, { ...DEFAULT_CONFIG, pressureWindow: 1 })
    expect(result.deltaPercent).toBeCloseTo(20, 5)
  })

  it('deltaPercent is 0 when total volume is 0', () => {
    const candles = [candle({ close: 100, volume: 0, takerBuyVolume: 0, takerSellVolume: 0 })]
    const result = computeBuySellPressure(candles, { ...DEFAULT_CONFIG, pressureWindow: 1 })
    expect(result.deltaPercent).toBe(0)
  })

  it('dominantSide is buyers when delta > pressureBalanceThreshold', () => {
    const candles = [candle({ close: 100, volume: 1000, takerBuyVolume: 700, takerSellVolume: 300 })]
    const result = computeBuySellPressure(candles, { ...DEFAULT_CONFIG, pressureWindow: 1 })
    expect(result.dominantSide).toBe('buyers')
  })

  it('dominantSide is sellers when delta < -pressureBalanceThreshold', () => {
    const candles = [candle({ close: 100, volume: 1000, takerBuyVolume: 300, takerSellVolume: 700 })]
    const result = computeBuySellPressure(candles, { ...DEFAULT_CONFIG, pressureWindow: 1 })
    expect(result.dominantSide).toBe('sellers')
  })

  it('dominantSide is balanced when |deltaPercent| < pressureBalanceThreshold', () => {
    const candles = [candle({ close: 100, volume: 1000, takerBuyVolume: 510, takerSellVolume: 490 })]
    const result = computeBuySellPressure(candles, { ...DEFAULT_CONFIG, pressureWindow: 1 })
    expect(result.dominantSide).toBe('balanced')
  })
})
