import { describe, it, expect } from 'vitest'
import { computeRelativeVolume } from '../compute/relative-volume'
import { DEFAULT_CONFIG } from '../config'
import { candle, flatCandles, emptyIndicators } from './helpers'

describe('computeRelativeVolume', () => {
  describe('using pre-computed volumeMA from indicators', () => {
    it('uses indicators.volumeMA when non-null', () => {
      const candles = flatCandles(5, 100, 2000)
      const indicators = emptyIndicators({ volumeMA: { ma: 1000, relativeVolume: 2.0 } })
      const result = computeRelativeVolume(candles, indicators, DEFAULT_CONFIG)
      expect(result.average).toBe(1000)
      expect(result.ratio).toBe(2.0)
      expect(result.classification).toBe('high')
    })

    it('reports current candle volume from the last candle', () => {
      const candles = [
        ...flatCandles(3, 100, 1000),
        candle({ close: 100, volume: 3000 }),
      ]
      const indicators = emptyIndicators({ volumeMA: { ma: 1000, relativeVolume: 3.0 } })
      const result = computeRelativeVolume(candles, indicators, DEFAULT_CONFIG)
      expect(result.current).toBe(3000)
    })
  })

  describe('fallback: computing from raw candles (volumeMA null)', () => {
    it('returns zero when only one candle is present (no prior bars)', () => {
      const candles = [candle({ close: 100, volume: 500 })]
      const result = computeRelativeVolume(candles, emptyIndicators(), DEFAULT_CONFIG)
      expect(result.current).toBe(500)
      expect(result.average).toBe(0)
      expect(result.ratio).toBe(0)
    })

    it('excludes the current (last) candle from the average', () => {
      // 4 candles: prior 3 have volume 100, current has volume 1000
      const candles = [
        ...flatCandles(3, 100, 100),
        candle({ close: 100, volume: 1000 }),
      ]
      const result = computeRelativeVolume(candles, emptyIndicators(), { ...DEFAULT_CONFIG, relativeVolumePeriod: 3 })
      expect(result.current).toBe(1000)
      expect(result.average).toBeCloseTo(100, 5)
      expect(result.ratio).toBeCloseTo(10, 5)
    })

    it('uses at most relativeVolumePeriod prior candles', () => {
      // 10 prior candles at 200 vol, period=5 → average of last 5 prior = 200
      const candles = [
        ...flatCandles(10, 100, 200),
        candle({ close: 100, volume: 400 }),
      ]
      const result = computeRelativeVolume(candles, emptyIndicators(), { ...DEFAULT_CONFIG, relativeVolumePeriod: 5 })
      expect(result.average).toBeCloseTo(200, 5)
      expect(result.ratio).toBeCloseTo(2.0, 5)
    })

    it('uses all available prior bars when fewer than period', () => {
      // Only 2 prior candles, period=20 → uses both
      const candles = [
        candle({ close: 100, volume: 100 }),
        candle({ close: 100, volume: 200 }),
        candle({ close: 100, volume: 300 }),
      ]
      const result = computeRelativeVolume(candles, emptyIndicators(), DEFAULT_CONFIG)
      expect(result.average).toBeCloseTo(150, 5)
      expect(result.ratio).toBeCloseTo(2.0, 5)
    })

    it('returns ratio 0 when prior average is zero', () => {
      const candles = [
        candle({ close: 100, volume: 0 }),
        candle({ close: 100, volume: 0 }),
        candle({ close: 100, volume: 500 }),
      ]
      const result = computeRelativeVolume(candles, emptyIndicators(), DEFAULT_CONFIG)
      expect(result.ratio).toBe(0)
    })
  })

  describe('classification', () => {
    it.each([
      [0.3,  'very_low'],
      [0.6,  'low'],
      [1.0,  'normal'],
      [1.8,  'high'],
      [3.0,  'very_high'],
    ])('ratio %s → %s', (ratio, expected) => {
      const candles = [candle({ close: 100, volume: ratio * 1000 }), candle({ close: 100, volume: ratio * 1000 })]
      const indicators = emptyIndicators({ volumeMA: { ma: 1000, relativeVolume: ratio } })
      const result = computeRelativeVolume(candles, indicators, DEFAULT_CONFIG)
      expect(result.classification).toBe(expected)
    })
  })
})
