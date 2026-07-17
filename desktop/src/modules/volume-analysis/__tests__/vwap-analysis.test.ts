import { describe, it, expect } from 'vitest'
import { computeVWAPAnalysis } from '../compute/vwap-analysis'
import { DEFAULT_CONFIG } from '../config'
import { candle, flatCandles, emptyIndicators } from './helpers'

describe('computeVWAPAnalysis', () => {
  it('above is true when close > vwap', () => {
    const candles = [candle({ close: 110 })]
    const indicators = emptyIndicators({ vwap: 100 })
    const result = computeVWAPAnalysis(candles, indicators, DEFAULT_CONFIG)
    expect(result.above).toBe(true)
    expect(result.below).toBe(false)
  })

  it('below is true when close < vwap', () => {
    const candles = [candle({ close: 90 })]
    const indicators = emptyIndicators({ vwap: 100 })
    const result = computeVWAPAnalysis(candles, indicators, DEFAULT_CONFIG)
    expect(result.above).toBe(false)
    expect(result.below).toBe(true)
  })

  it('distancePercent is (close - vwap) / vwap * 100', () => {
    const candles = [candle({ close: 105 })]
    const indicators = emptyIndicators({ vwap: 100 })
    const result = computeVWAPAnalysis(candles, indicators, DEFAULT_CONFIG)
    expect(result.distancePercent).toBeCloseTo(5, 5)
  })

  it('distancePercent is 0 when vwap is 0', () => {
    const candles = [candle({ close: 100 })]
    const indicators = emptyIndicators({ vwap: 0 })
    const result = computeVWAPAnalysis(candles, indicators, DEFAULT_CONFIG)
    expect(result.distancePercent).toBe(0)
  })

  it('respectingVWAP is true when within vwapProximityPercent', () => {
    const candles = [candle({ close: 100.2 })]
    const indicators = emptyIndicators({ vwap: 100 })
    const result = computeVWAPAnalysis(candles, indicators, DEFAULT_CONFIG)
    expect(result.respectingVWAP).toBe(true)
  })

  it('respectingVWAP is false when far from VWAP and no recent cross', () => {
    const candles = flatCandles(5, 110)
    const indicators = emptyIndicators({ vwap: 100 })
    const result = computeVWAPAnalysis(candles, indicators, DEFAULT_CONFIG)
    expect(result.respectingVWAP).toBe(false)
  })

  it('respectingVWAP is true when price crossed VWAP in last 5 candles', () => {
    const candles = [
      candle({ close: 95 }),
      candle({ close: 97 }),
      candle({ close: 99 }),
      candle({ close: 101 }),  // crossed from below to above VWAP=100
      candle({ close: 102 }),
    ]
    const indicators = emptyIndicators({ vwap: 100 })
    const result = computeVWAPAnalysis(candles, indicators, DEFAULT_CONFIG)
    expect(result.respectingVWAP).toBe(true)
  })
})
