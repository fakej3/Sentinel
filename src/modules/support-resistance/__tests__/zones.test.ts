import { describe, it, expect, beforeEach } from 'vitest'
import { resetZoneCounter, createZoneCandidates, computeAtr, zoneHalfWidth } from '../zones'
import { DEFAULT_CONFIG } from '../config'
import { candle, flatCandles, swing } from './helpers'

beforeEach(() => resetZoneCounter())

describe('computeAtr', () => {
  it('returns null when fewer than 15 candles', () => {
    expect(computeAtr(flatCandles(14, 100))).toBeNull()
  })

  it('returns a positive number for 15+ candles', () => {
    const candles = flatCandles(20, 100)
    // Inject some range to get non-zero ATR
    candles[5] = candle({ close: 105, high: 110, low: 95 })
    expect(computeAtr(candles)).toBeGreaterThan(0)
  })

  it('returns 0 for a perfectly flat series', () => {
    const result = computeAtr(flatCandles(20, 100))
    expect(result).toBe(0)
  })
})

describe('zoneHalfWidth', () => {
  it('uses ATR × atrMultiplier when ATR is positive', () => {
    expect(zoneHalfWidth(100, 10, DEFAULT_CONFIG)).toBe(10 * 0.25)
  })

  it('falls back to center × 0.003 when ATR is null', () => {
    expect(zoneHalfWidth(1000, null, DEFAULT_CONFIG)).toBeCloseTo(3, 5)
  })

  it('falls back to center × 0.003 when ATR is zero', () => {
    expect(zoneHalfWidth(1000, 0, DEFAULT_CONFIG)).toBeCloseTo(3, 5)
  })
})

describe('createZoneCandidates', () => {
  it('creates a resistance zone from a swing high', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG)
    expect(zones).toHaveLength(1)
    expect(zones[0].type).toBe('resistance')
    expect(zones[0].center).toBe(110)
    expect(zones[0].origin).toBe('swing-high')
    expect(zones[0].touchCount).toBe(1)
  })

  it('creates a support zone from a swing low', () => {
    const candles = flatCandles(50, 100)
    const swings = [swing({ index: 10, price: 90, type: 'low' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG)
    expect(zones[0].type).toBe('support')
    expect(zones[0].center).toBe(90)
    expect(zones[0].origin).toBe('swing-low')
  })

  it('excludes swings older than lookback window', () => {
    const candles = flatCandles(200, 100)
    // index 10 is 190 candles ago — older than lookback 100
    const swings = [swing({ index: 10, price: 110, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG)
    expect(zones).toHaveLength(0)
  })

  it('includes swings within lookback window', () => {
    const candles = flatCandles(50, 100)
    const swings = [
      swing({ index: 40, price: 110, type: 'high' }),
      swing({ index: 45, price: 90, type: 'low' }),
    ]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG)
    expect(zones).toHaveLength(2)
  })

  it('zone upper and lower are symmetric around center', () => {
    const candles = flatCandles(30, 0) // zero ATR → fallback
    candles[10] = candle({ close: 1000, high: 1000, low: 1000 })
    const swings = [swing({ index: 10, price: 1000, type: 'high' })]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG)
    const z = zones[0]
    expect(z.upper - z.center).toBeCloseTo(z.center - z.lower, 5)
  })

  it('assigns sequential IDs', () => {
    const candles = flatCandles(30, 100)
    const swings = [
      swing({ index: 10, price: 110, type: 'high' }),
      swing({ index: 15, price: 90, type: 'low' }),
    ]
    const zones = createZoneCandidates(swings, candles, DEFAULT_CONFIG)
    expect(zones[0].id).toBe('sr-001')
    expect(zones[1].id).toBe('sr-002')
  })
})
