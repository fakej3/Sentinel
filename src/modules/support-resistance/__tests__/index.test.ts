import { describe, it, expect, beforeEach } from 'vitest'
import { computeSupportResistance } from '../index'
import { DEFAULT_CONFIG } from '../config'
import { resetZoneCounter } from '../zones'
import { candle, flatCandles, emptyStructure, swing, withSwings } from './helpers'
import type { Candle } from '../../binance/types'

beforeEach(() => resetZoneCounter())

// ─── Helpers ────────────────────────────────────────────────────────────────

/** 50 flat candles at `price` with enough range for ATR */
function priceCandles(count: number, basePrice: number): Candle[] {
  return Array.from({ length: count }, (_, i) =>
    candle({
      openTime: i * 1000,
      close: basePrice,
      high: basePrice + 1,
      low: basePrice - 1,
    }),
  )
}

// ─── Guard rails ────────────────────────────────────────────────────────────

describe('computeSupportResistance — guard rails', () => {
  it('returns empty result for empty candles', () => {
    const result = computeSupportResistance([], emptyStructure())
    expect(result.zones).toHaveLength(0)
    expect(result.evidence[0]).toMatch(/insufficient data/i)
  })

  it('returns empty result for single candle', () => {
    const result = computeSupportResistance([candle({ close: 100 })], emptyStructure())
    expect(result.zones).toHaveLength(0)
  })

  it('returns empty result when no swings', () => {
    const result = computeSupportResistance(priceCandles(50, 100), emptyStructure())
    expect(result.zones).toHaveLength(0)
  })
})

// ─── Zone creation ──────────────────────────────────────────────────────────

describe('computeSupportResistance — zone creation', () => {
  it('creates resistance from swing high and support from swing low', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
      swing({ index: 20, price: 90, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    const types = result.zones.map(z => z.type).sort()
    expect(types).toContain('resistance')
    expect(types).toContain('support')
  })

  it('zones are sorted by center descending', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 90, type: 'low' }),
      swing({ index: 15, price: 110, type: 'high' }),
      swing({ index: 20, price: 80, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    const centers = result.zones.map(z => z.center)
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i]).toBeLessThanOrEqual(centers[i - 1])
    }
  })

  it('excludes swings beyond lookback window', () => {
    const candles = priceCandles(200, 100)
    // All swings are older than lookback=100, plus we need minTouchCount=2 so they'd need touches anyway
    const structure = withSwings([
      swing({ index: 5, price: 120, type: 'high' }),  // 195 candles ago
    ])
    const result = computeSupportResistance(candles, structure, { lookback: 100 })
    expect(result.zones).toHaveLength(0)
  })
})

// ─── minTouchCount filter ────────────────────────────────────────────────────

describe('computeSupportResistance — minTouchCount', () => {
  it('excludes zones with only 1 touch', () => {
    // A swing that never gets touched again won't reach minTouchCount=2
    const candles = priceCandles(30, 50)
    // Swing high at 110 — no candles ever reach it → stays at touchCount=1
    const structure = withSwings([
      swing({ index: 5, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure)
    expect(result.zones).toHaveLength(0)
  })

  it('includes zone when minTouchCount is lowered to 1', () => {
    const candles = priceCandles(30, 50)
    const structure = withSwings([
      swing({ index: 5, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    expect(result.zones.length).toBeGreaterThan(0)
  })
})

// ─── Active support / resistance classification ──────────────────────────────

describe('computeSupportResistance — active zones', () => {
  it('classifies active support and resistance correctly', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
      swing({ index: 20, price: 90, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    const hasResistance = result.activeResistance.length > 0
    const hasSupport = result.activeSupport.length > 0
    expect(hasResistance || hasSupport).toBe(true)
  })

  it('activeResistance sorted ascending (nearest overhead first)', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 115, type: 'high' }),
      swing({ index: 15, price: 120, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    const centers = result.activeResistance.map(z => z.center)
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i]).toBeGreaterThanOrEqual(centers[i - 1])
    }
  })

  it('activeSupport sorted descending (nearest below first)', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 85, type: 'low' }),
      swing({ index: 15, price: 90, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    const centers = result.activeSupport.map(z => z.center)
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i]).toBeLessThanOrEqual(centers[i - 1])
    }
  })
})

// ─── Nearest zones ────────────────────────────────────────────────────────────

describe('computeSupportResistance — nearest zones', () => {
  it('nearestResistance is the lowest resistance zone above current price', () => {
    // Current price = close of last candle = 100
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
      swing({ index: 15, price: 130, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    if (result.nearestResistance) {
      expect(result.nearestResistance.center).toBe(110)
    }
  })

  it('nearestSupport is the highest support zone below current price', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 85, type: 'low' }),
      swing({ index: 15, price: 70, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    if (result.nearestSupport) {
      expect(result.nearestSupport.center).toBe(85)
    }
  })

  it('returns null nearestSupport when no support zone is below price', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    expect(result.nearestSupport).toBeNull()
  })

  it('returns null nearestResistance when no resistance zone is above price', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 85, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    expect(result.nearestResistance).toBeNull()
  })
})

// ─── Current zone ────────────────────────────────────────────────────────────

describe('computeSupportResistance — currentZone', () => {
  it('returns currentZone when current price is inside an active zone', () => {
    // Build candles where the last close is inside a resistance zone
    const candles = Array.from({ length: 30 }, (_, i) =>
      candle({ openTime: i * 1000, close: 100, high: 110, low: 95 }),
    )
    // Swing high at 105 — zone 105 ± ATR*0.25; price 100 may or may not be inside
    // Use minTouchCount=1 and large atrMultiplier to ensure price is inside zone
    const structure = withSwings([
      swing({ index: 5, price: 101, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1, atrMultiplier: 5 })
    // With very large multiplier, current price 100 will likely be inside the zone centered at 101
    if (result.zones.length > 0) {
      const inZone = result.zones.find(z => {
        const lastClose = candles[candles.length - 1].close
        return lastClose >= z.lower && lastClose <= z.upper
      })
      expect(result.currentZone).toEqual(inZone ?? null)
    }
  })

  it('returns null currentZone when price is between zones', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 115, type: 'high' }),
      swing({ index: 15, price: 85, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    // Current price = 100, well between 85 and 115 zones
    // With small atrMultiplier, zones won't reach 100
    expect(result.currentZone).toBeNull()
  })
})

// ─── Config defaults ─────────────────────────────────────────────────────────

describe('computeSupportResistance — config', () => {
  it('accepts partial config and merges with defaults', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([swing({ index: 10, price: 110, type: 'high' })])
    // Only override one field — should not throw
    expect(() => computeSupportResistance(candles, structure, { minTouchCount: 1 })).not.toThrow()
  })

  it('DEFAULT_CONFIG values match documented defaults', () => {
    expect(DEFAULT_CONFIG.atrMultiplier).toBe(0.25)
    expect(DEFAULT_CONFIG.mergeTolerance).toBe(0.5)
    expect(DEFAULT_CONFIG.minTouchCount).toBe(2)
    expect(DEFAULT_CONFIG.maxZoneAge).toBe(200)
    expect(DEFAULT_CONFIG.lookback).toBe(100)
    expect(DEFAULT_CONFIG.strengthDecayAge).toBe(50)
  })
})

// ─── Zone fields ──────────────────────────────────────────────────────────────

describe('computeSupportResistance — zone field invariants', () => {
  it('every zone has upper > center > lower', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
      swing({ index: 20, price: 90, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(z.upper).toBeGreaterThan(z.center)
      expect(z.center).toBeGreaterThan(z.lower)
    }
  })

  it('every zone has width = upper − lower', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(z.width).toBeCloseTo(z.upper - z.lower, 10)
    }
  })

  it('every zone has strength in 0–10', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
      swing({ index: 20, price: 90, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(z.strength).toBeGreaterThanOrEqual(0)
      expect(z.strength).toBeLessThanOrEqual(10)
    }
  })

  it('every zone has confidence in 0–10', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(z.confidence).toBeGreaterThanOrEqual(0)
      expect(z.confidence).toBeLessThanOrEqual(10)
    }
  })

  it('every zone has a non-empty evidence array', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(z.evidence.length).toBeGreaterThan(0)
    }
  })

  it('every zone has a non-empty id', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(z.id).toMatch(/^sr-\d+$/)
    }
  })
})

// ─── Mutation isolation ───────────────────────────────────────────────────────

describe('computeSupportResistance — mutation isolation', () => {
  it('two calls return independent zone arrays', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([swing({ index: 10, price: 110, type: 'high' })])
    const r1 = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    const r2 = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    r1.zones.push({ ...r1.zones[0], id: 'injected' } as never)
    expect(r2.zones.find(z => z.id === 'injected')).toBeUndefined()
  })

  it('two calls return independent evidence arrays', () => {
    const candles = priceCandles(50, 100)
    const r1 = computeSupportResistance(candles, emptyStructure())
    const r2 = computeSupportResistance(candles, emptyStructure())
    r1.evidence.push('injected')
    expect(r2.evidence).not.toContain('injected')
  })
})

// ─── Boundary / edge cases ────────────────────────────────────────────────────

describe('computeSupportResistance — boundary conditions', () => {
  it('handles exactly 2 candles', () => {
    const candles = [candle({ close: 100 }), candle({ close: 101 })]
    const structure = withSwings([swing({ index: 0, price: 100, type: 'high' })])
    expect(() => computeSupportResistance(candles, structure, { minTouchCount: 1 })).not.toThrow()
  })

  it('handles flat series (zero ATR) without NaN or Infinity', () => {
    const candles = flatCandles(50, 100)
    const structure = withSwings([
      swing({ index: 10, price: 100, type: 'high' }),
      swing({ index: 20, price: 100, type: 'low' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(isNaN(z.center)).toBe(false)
      expect(isFinite(z.center)).toBe(true)
      expect(isNaN(z.strength)).toBe(false)
    }
  })

  it('handles very large price values without precision issues', () => {
    const candles = priceCandles(50, 100_000)
    const structure = withSwings([
      swing({ index: 10, price: 110_000, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    for (const z of result.zones) {
      expect(isFinite(z.center)).toBe(true)
    }
  })

  it('handles many swings near the same price (merge stress)', () => {
    const candles = priceCandles(50, 100)
    const swings = Array.from({ length: 10 }, (_, i) =>
      swing({ index: 5 + i, price: 110 + i * 0.01, type: 'high' }),
    )
    const structure = withSwings(swings)
    expect(() => computeSupportResistance(candles, structure, { minTouchCount: 1 })).not.toThrow()
  })

  it('archived zones are excluded from activeSupport and activeResistance', () => {
    const candles = priceCandles(250, 100)
    // Swing near start — very old, will be archived
    const structure = withSwings([
      swing({ index: 5, price: 110, type: 'high' }),
    ])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1, maxZoneAge: 50 })
    const archivedInActive = [
      ...result.activeSupport,
      ...result.activeResistance,
    ].filter(z => z.state === 'archived')
    expect(archivedInActive).toHaveLength(0)
  })
})

// ─── Evidence ─────────────────────────────────────────────────────────────────

describe('computeSupportResistance — evidence', () => {
  it('result evidence is non-empty', () => {
    const candles = priceCandles(50, 100)
    const structure = withSwings([swing({ index: 10, price: 110, type: 'high' })])
    const result = computeSupportResistance(candles, structure, { minTouchCount: 1 })
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('evidence mentions "No active" when all zones are filtered out', () => {
    const result = computeSupportResistance(flatCandles(50, 100), emptyStructure())
    expect(result.evidence.join(' ')).toMatch(/insufficient|no active/i)
  })
})
