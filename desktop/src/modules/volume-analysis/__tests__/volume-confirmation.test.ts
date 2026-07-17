import { describe, it, expect } from 'vitest'
import { computeVolumeConfirmation } from '../compute/volume-confirmation'
import { DEFAULT_CONFIG } from '../config'
import { candle, flatCandles, emptyStructure } from './helpers'
import type { RelativeVolumeResult } from '../types'

function relVol(ratio: number): RelativeVolumeResult {
  return { current: ratio * 1000, average: 1000, ratio, classification: 'normal' }
}

describe('computeVolumeConfirmation', () => {
  it('confirmed is true when ratio >= confirmationThreshold', () => {
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.3), emptyStructure(), DEFAULT_CONFIG,
    )
    expect(result.confirmed).toBe(true)
  })

  it('confirmed is false when ratio < confirmationThreshold', () => {
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.0), emptyStructure(), DEFAULT_CONFIG,
    )
    expect(result.confirmed).toBe(false)
  })

  it('reason is a non-empty string', () => {
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.5), emptyStructure(), DEFAULT_CONFIG,
    )
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('supportsTrend is true when confirmed, trend is not ranging, and candle is directional', () => {
    const structure = { ...emptyStructure(), trend: 'bullish' as const }
    // Bullish candle: open=99, close=100 (close > open)
    const bullishCandles = [candle({ open: 99, close: 100, high: 101, low: 98, volume: 1500 })]
    const result = computeVolumeConfirmation(bullishCandles, relVol(1.5), structure, DEFAULT_CONFIG)
    expect(result.supportsTrend).toBe(true)
  })

  it('supportsTrend is false when candle is neutral (doji)', () => {
    const structure = { ...emptyStructure(), trend: 'bullish' as const }
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.5), structure, DEFAULT_CONFIG,
    )
    expect(result.supportsTrend).toBe(false)
  })

  it('supportsTrend is false when trend is ranging', () => {
    const structure = { ...emptyStructure(), trend: 'ranging' as const }
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.5), structure, DEFAULT_CONFIG,
    )
    expect(result.supportsTrend).toBe(false)
  })

  it('supportsBreakout is true when confirmed and breakout.confirmed', () => {
    const structure = {
      ...emptyStructure(),
      breakout: { confirmed: true, failed: false, level: 100, direction: 'bullish' as const },
    }
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.5), structure, DEFAULT_CONFIG,
    )
    expect(result.supportsBreakout).toBe(true)
  })

  it('supportsBOS is true when the BOS candle had high volume', () => {
    // 25 candles total, BOS at index 20 with very high volume
    const candles = [
      ...flatCandles(20, 100, 100),
      ...Array.from({ length: 4 }, (_, i) =>
        ({ ...flatCandles(1, 100, i === 0 ? 3000 : 200)[0], openTime: (20 + i) * 1000 }),
      ),
      { ...flatCandles(1, 100, 200)[0], openTime: 24000 },
    ]
    const structure = {
      ...emptyStructure(),
      bos: {
        detected: true,
        events: [{ type: 'BOS' as const, index: 20, timestamp: 20000, level: 100, direction: 'bullish' as const }],
        last: { type: 'BOS' as const, index: 20, timestamp: 20000, level: 100, direction: 'bullish' as const },
      },
    }
    const result = computeVolumeConfirmation(
      candles, relVol(1.5), structure, { ...DEFAULT_CONFIG, relativeVolumePeriod: 5 },
    )
    expect(result.supportsBOS).toBe(true)
  })

  it('supportsBOS is false when no BOS exists', () => {
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.5), emptyStructure(), DEFAULT_CONFIG,
    )
    expect(result.supportsBOS).toBe(false)
  })

  it('supportsCHOCH is false when no CHoCH exists', () => {
    const result = computeVolumeConfirmation(
      flatCandles(5, 100), relVol(1.5), emptyStructure(), DEFAULT_CONFIG,
    )
    expect(result.supportsCHOCH).toBe(false)
  })
})
