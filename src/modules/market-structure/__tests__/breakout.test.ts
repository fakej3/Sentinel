import { describe, it, expect } from 'vitest'
import { detectBreakout } from '../breakout'
import { DEFAULT_CONFIG } from '../config'
import type { Candle } from '../../binance'
import type { ConsolidationResult } from '../types'

function candle(close: number, volume: number, i: number): Candle {
  return {
    openTime: i * 3_600_000,
    closeTime: i * 3_600_000 + 3_599_999,
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume,
    quoteVolume: close * volume,
    trades: 10,
    takerBuyVolume: volume * 0.5,
    takerSellVolume: volume * 0.5,
  }
}

const CONSOLIDATION: ConsolidationResult = {
  detected: true,
  rangeHigh: 110,
  rangeLow: 100,
  rangePercent: 10,
  barsInRange: 20,
}

describe('detectBreakout — volume MA excludes breakout candle', () => {
  it('returns not-breaking when no consolidation is active', () => {
    const cs = [candle(105, 1000, 0)]
    const result = detectBreakout(cs, { ...CONSOLIDATION, detected: false }, DEFAULT_CONFIG)
    expect(result.confirmed).toBe(false)
    expect(result.direction).toBeNull()
  })

  it('strong bullish breakout: high-volume candle confirms above range', () => {
    // 20 prior candles at volume=1000, breakout candle volume=2000 (2× average)
    const cs = Array.from({ length: 20 }, (_, i) => candle(105, 1000, i))
    cs.push(candle(112, 2000, 20))  // close > rangeHigh=110, vol = 2× prior avg
    const result = detectBreakout(cs, CONSOLIDATION, DEFAULT_CONFIG)
    expect(result.confirmed).toBe(true)
    expect(result.direction).toBe('bullish')
    expect(result.level).toBe(110)
    expect(result.failed).toBe(false)
  })

  it('weak bullish breakout: price exits range but volume is below multiplier', () => {
    // Prior volume=1000, breakout candle volume=1200 → relVol=1.2 < 1.3
    const cs = Array.from({ length: 20 }, (_, i) => candle(105, 1000, i))
    cs.push(candle(112, 1200, 20))
    const result = detectBreakout(cs, CONSOLIDATION, DEFAULT_CONFIG)
    expect(result.confirmed).toBe(false)
    expect(result.direction).toBe('bullish')
    expect(result.failed).toBe(false)
  })

  it('borderline bullish breakout: volume exactly at multiplier threshold confirms', () => {
    // Prior volume=1000, breakout candle volume=1300 → relVol=1.3 === 1.3 (confirmed)
    const cs = Array.from({ length: 20 }, (_, i) => candle(105, 1000, i))
    cs.push(candle(112, 1300, 20))
    const result = detectBreakout(cs, CONSOLIDATION, DEFAULT_CONFIG)
    expect(result.confirmed).toBe(true)
    expect(result.direction).toBe('bullish')
  })

  it('volume MA does not include the breakout candle itself', () => {
    // All prior candles have volume=1000. Breakout candle has volume=5000.
    // If breakout candle were included in MA, the MA would be inflated and
    // relVol would drop below the threshold, causing incorrect rejection.
    // With the fix (prior candles only), MA=1000 → relVol=5.0 → confirmed.
    const cs = Array.from({ length: 20 }, (_, i) => candle(105, 1000, i))
    cs.push(candle(112, 5000, 20))
    const result = detectBreakout(cs, CONSOLIDATION, DEFAULT_CONFIG)
    expect(result.confirmed).toBe(true)  // would be false if breakout candle polluted the MA
  })

  it('bearish breakout below range is detected', () => {
    const cs = Array.from({ length: 20 }, (_, i) => candle(105, 1000, i))
    cs.push(candle(98, 2000, 20))  // close < rangeLow=100
    const result = detectBreakout(cs, CONSOLIDATION, DEFAULT_CONFIG)
    expect(result.confirmed).toBe(true)
    expect(result.direction).toBe('bearish')
    expect(result.level).toBe(100)
  })

  it('failed breakout detected when prior candle broke out but current is inside', () => {
    const cs = Array.from({ length: 19 }, (_, i) => candle(105, 1000, i))
    cs.push(candle(112, 1000, 19))  // prior candle broke above rangeHigh
    cs.push(candle(105, 1000, 20))  // current close returned inside range
    const result = detectBreakout(cs, CONSOLIDATION, DEFAULT_CONFIG)
    expect(result.failed).toBe(true)
    expect(result.confirmed).toBe(false)
  })
})
