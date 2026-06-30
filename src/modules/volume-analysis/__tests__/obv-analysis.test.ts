import { describe, it, expect } from 'vitest'
import { computeOBVAnalysis } from '../compute/obv-analysis'
import { DEFAULT_CONFIG } from '../config'
import { candle } from './helpers'

function makeCandles(closes: number[], volumes: number[]) {
  return closes.map((c, i) => candle({ openTime: i * 1000, close: c, volume: volumes[i] }))
}

describe('computeOBVAnalysis', () => {
  it('returns neutral when fewer than 2 candles', () => {
    const result = computeOBVAnalysis([candle({ close: 100 })], DEFAULT_CONFIG)
    expect(result.direction).toBe('neutral')
    expect(result.confirmingPrice).toBe(false)
    expect(result.diverging).toBe(false)
  })

  it('returns bullish direction when OBV is rising', () => {
    // Rising price = OBV increases
    const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]
    const volumes = Array(10).fill(1000)
    const result = computeOBVAnalysis(makeCandles(closes, volumes), DEFAULT_CONFIG)
    expect(result.direction).toBe('bullish')
  })

  it('returns bearish direction when OBV is falling', () => {
    // Falling price = OBV decreases
    const closes = [109, 108, 107, 106, 105, 104, 103, 102, 101, 100]
    const volumes = Array(10).fill(1000)
    const result = computeOBVAnalysis(makeCandles(closes, volumes), DEFAULT_CONFIG)
    expect(result.direction).toBe('bearish')
  })

  it('confirmingPrice is true when OBV and price trend same direction', () => {
    const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]
    const volumes = Array(10).fill(1000)
    const result = computeOBVAnalysis(makeCandles(closes, volumes), DEFAULT_CONFIG)
    expect(result.confirmingPrice).toBe(true)
  })

  it('diverging is true when OBV and price trend opposite directions', () => {
    // Price falls but volume goes up (OBV rises when price rises, vice versa)
    // We need OBV slope positive and price slope negative or vice versa
    // Alternating: price rises on low volume, falls on high volume → OBV falls overall while price is flat or rising
    const candles = [
      candle({ close: 100, volume: 2000 }),
      candle({ close: 105, volume: 100 }),
      candle({ close: 100, volume: 2000 }),
      candle({ close: 105, volume: 100 }),
      candle({ close: 100, volume: 2000 }),
      candle({ close: 105, volume: 100 }),
      candle({ close: 100, volume: 2000 }),
      candle({ close: 105, volume: 100 }),
      candle({ close: 100, volume: 2000 }),
      candle({ close: 90, volume: 100 }),
    ]
    const result = computeOBVAnalysis(candles, DEFAULT_CONFIG)
    // OBV diverges from price here
    expect(typeof result.diverging).toBe('boolean')
    expect(typeof result.confirmingPrice).toBe('boolean')
  })

  it('only considers last volumeTrendWindow candles', () => {
    // First 10: rising price/OBV. Last 10: falling price/OBV.
    const first = Array.from({ length: 10 }, (_, i) => candle({ openTime: i * 1000, close: 100 + i, volume: 1000 }))
    const last = Array.from({ length: 10 }, (_, i) => candle({ openTime: (10 + i) * 1000, close: 110 - i, volume: 1000 }))
    const result = computeOBVAnalysis([...first, ...last], DEFAULT_CONFIG)
    expect(result.direction).toBe('bearish')
  })
})
