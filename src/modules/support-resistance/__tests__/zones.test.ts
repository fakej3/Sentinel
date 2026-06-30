import { describe, it, expect } from 'vitest'
import { createZoneCandidates } from '../zones'
import { DEFAULT_CONFIG } from '../config'
import { candle, flatCandles, swing } from './helpers'

describe('createZoneCandidates', () => {
  it('creates a resistance zone from a swing high', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null)
    expect(zones).toHaveLength(1)
    expect(zones[0].type).toBe('resistance')
    expect(zones[0].center).toBe(110)
    expect(zones[0].origin).toBe('swing-high')
    expect(zones[0].touchCount).toBe(1)
  })

  it('creates a support zone from a swing low', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 90, type: 'low' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null)
    expect(zones[0].type).toBe('support')
    expect(zones[0].center).toBe(90)
    expect(zones[0].origin).toBe('swing-low')
  })

  it('excludes swings older than lookback window', () => {
    const candles = flatCandles(200, 100)
    // index 10 is 190 candles ago — older than lookback 100
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null)
    expect(zones).toHaveLength(0)
  })

  it('includes swings within lookback window', () => {
    const candles = flatCandles(50, 100)
    const swings = [
      swing({ index: 40, price: 110, type: 'high' }),
      swing({ index: 45, price: 90, type: 'low' }),
    ]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null)
    expect(zones).toHaveLength(2)
  })

  it('zone upper and lower are symmetric around center', () => {
    const candles = flatCandles(30, 0) // zero ATR → fallback
    candles[10] = candle({ close: 1000, high: 1000, low: 1000 })
    const swings = [swing({ index: 10, price: 1000, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null)
    const z = zones[0]
    expect(z.upper - z.center).toBeCloseTo(z.center - z.lower, 5)
  })

  it('uses ATR-based width when ATR is positive', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 200, type: 'high' })]
    // atr=10, atrMultiplier=0.25 → half=2.5 → width=5
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, 10)
    expect(zones[0].width).toBeCloseTo(5, 10)
  })

  it('falls back to center×0.003 width when ATR is null', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 1000, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null)
    // half = 1000 × 0.003 = 3 → width = 6
    expect(zones[0].width).toBeCloseTo(6, 5)
  })

  it('assigns sequential IDs starting at sr-001', () => {
    const candles = flatCandles(30, 100)
    const swings = [
      swing({ index: 10, price: 110, type: 'high' }),
      swing({ index: 15, price: 90, type: 'low' }),
    ]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null)
    expect(zones[0].id).toBe('sr-001')
    expect(zones[1].id).toBe('sr-002')
  })

  it('respects idOffset for sequential IDs across calls', () => {
    const candles = flatCandles(30, 100)
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG, null, 5)
    expect(zones[0].id).toBe('sr-006')
  })
})
