import { describe, it, expect } from 'vitest'
import { computeClimax } from '../compute/climax'
import { DEFAULT_CONFIG } from '../config'
import { candle, flatCandles } from './helpers'

describe('computeClimax', () => {
  it('no climax when volume is below threshold', () => {
    const candles = flatCandles(5, 100)
    const result = computeClimax(candles, 1.0, DEFAULT_CONFIG)
    expect(result.buyingClimax).toBe(false)
    expect(result.sellingClimax).toBe(false)
    expect(result.exhaustion).toBe(false)
  })

  it('detects buying climax: high volume + bullish body + multi-bar high close', () => {
    const current = candle({ close: 120, open: 100, high: 121, low: 99, volume: 5000 })
    const priors = Array.from({ length: 9 }, () => candle({ close: 100, high: 110, low: 90, volume: 1000 }))
    const candles = [...priors, current]
    const result = computeClimax(candles, 3.0, DEFAULT_CONFIG)
    expect(result.buyingClimax).toBe(true)
  })

  it('no buying climax when close is not the multi-bar high', () => {
    const current = candle({ close: 105, open: 100, high: 110, low: 99, volume: 5000 })
    const priors = Array.from({ length: 9 }, () => candle({ close: 115, high: 120, low: 90, volume: 1000 }))
    const candles = [...priors, current]
    const result = computeClimax(candles, 3.0, DEFAULT_CONFIG)
    expect(result.buyingClimax).toBe(false)
  })

  it('detects selling climax: high volume + bearish body + multi-bar low close', () => {
    const current = candle({ close: 80, open: 100, high: 101, low: 79, volume: 5000 })
    const priors = Array.from({ length: 9 }, () => candle({ close: 100, high: 110, low: 90, volume: 1000 }))
    const candles = [...priors, current]
    const result = computeClimax(candles, 3.0, DEFAULT_CONFIG)
    expect(result.sellingClimax).toBe(true)
  })

  it('detects exhaustion: high volume + small body', () => {
    // doji-like: close ≈ open, wide range
    const current = candle({ close: 100.5, open: 100, high: 130, low: 70, volume: 5000 })
    const priors = Array.from({ length: 9 }, () => candle({ close: 100, volume: 1000 }))
    const candles = [...priors, current]
    const result = computeClimax(candles, 3.0, DEFAULT_CONFIG)
    expect(result.exhaustion).toBe(true)
    expect(result.buyingClimax).toBe(false)
    expect(result.sellingClimax).toBe(false)
  })

  it('returns false for all when candle range is zero', () => {
    const candles = flatCandles(5, 100)
    const result = computeClimax(candles, 3.0, DEFAULT_CONFIG)
    expect(result.buyingClimax).toBe(false)
    expect(result.sellingClimax).toBe(false)
    // exhaustion: bodyRatio = 0 (0 <= exhaustionBodyRatio 0.3) with high volume
    expect(result.exhaustion).toBe(true)
  })
})
