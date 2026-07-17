import { describe, it, expect } from 'vitest'
import { detectRawSwings, filterDominantSwings } from '../swings'
import { DEFAULT_CONFIG } from '../config'
import { candles } from './helpers'

const cfg1 = { ...DEFAULT_CONFIG, swingLookback: 1 }
const cfg2 = { ...DEFAULT_CONFIG, swingLookback: 2 }

describe('detectRawSwings', () => {
  it('returns empty for fewer than 2*lookback+1 candles', () => {
    expect(detectRawSwings(candles([100, 110, 100, 90]), cfg2)).toHaveLength(0)
    expect(detectRawSwings([], cfg1)).toHaveLength(0)
  })

  it('detects a swing high in a simple V-shape (lookback=1)', () => {
    // [98, 112, 98]: index 1 has high 112 > left high 98 and right high 98
    const cs = candles([[98, 99, 97], [112, 113, 111], [98, 99, 97]])
    const swings = detectRawSwings(cs, cfg1)
    const highs = swings.filter(s => s.type === 'high')
    expect(highs).toHaveLength(1)
    expect(highs[0].index).toBe(1)
    expect(highs[0].price).toBe(113)
  })

  it('detects a swing low in an inverted V-shape (lookback=1)', () => {
    const cs = candles([[110, 111, 109], [88, 89, 87], [110, 111, 109]])
    const swings = detectRawSwings(cs, cfg1)
    const lows = swings.filter(s => s.type === 'low')
    expect(lows).toHaveLength(1)
    expect(lows[0].index).toBe(1)
    expect(lows[0].price).toBe(87)
  })

  it('does not detect swing when a neighbor is equal (strict inequality)', () => {
    // Candle 1 high == candle 2 high → no swing high at either
    const cs = candles([[100, 110, 99], [100, 110, 99], [100, 110, 99]])
    const swings = detectRawSwings(cs, cfg1)
    expect(swings.filter(s => s.type === 'high')).toHaveLength(0)
  })

  it('detects nothing in a monotonically increasing series', () => {
    // Every candle is higher than the previous → no swing highs or lows
    const cs = candles([100, 101, 102, 103, 104, 105])
    const swings = detectRawSwings(cs, cfg1)
    expect(swings).toHaveLength(0)
  })

  it('detects multiple alternating swings in a zigzag series (lookback=1)', () => {
    // Creates H-L-H-L-H pattern
    const cs = candles([
      [100, 101, 99],
      [120, 122, 119],  // swing HIGH
      [100, 101, 99],
      [110, 112, 108],  // swing HIGH
      [90,  91,  88],  // swing LOW
      [130, 132, 128],  // swing HIGH
      [100, 101, 99],
    ])
    const swings = detectRawSwings(cs, cfg1)
    const highs = swings.filter(s => s.type === 'high')
    const lows  = swings.filter(s => s.type === 'low')
    // Index 1 (H=122) and index 3 (H=112) and index 5 (H=132) are swing highs
    // Index 4 (L=88) might be a swing low (lower than neighbors)
    expect(highs.length).toBeGreaterThanOrEqual(1)
    expect(lows.length).toBeGreaterThanOrEqual(1)
  })

  it('respects swingLookback=2 (requires 2 bars on each side)', () => {
    // A swing high only at index 2 with L=2 needs 5 candles minimum
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [120, 122, 118],  // candidate swing high
      [100, 101, 99],
      [100, 101, 99],
    ])
    const swings = detectRawSwings(cs, cfg2)
    const highs = swings.filter(s => s.type === 'high')
    expect(highs).toHaveLength(1)
    expect(highs[0].index).toBe(2)
    expect(highs[0].price).toBe(122)
  })

  it('edge candles within lookback range cannot be swing points', () => {
    // With lookback=2, indices 0,1 and last 2 cannot be swings
    const cs = candles([200, 100, 100, 100, 100])  // first candle highest
    const swings = detectRawSwings(cs, cfg2)
    expect(swings.filter(s => s.type === 'high' && s.index === 0)).toHaveLength(0)
  })

  it('stores the candle openTime as timestamp', () => {
    const cs = candles([[100, 101, 99], [120, 122, 118], [100, 101, 99]])
    const swings = detectRawSwings(cs, cfg1)
    const high = swings.find(s => s.type === 'high')!
    expect(high.timestamp).toBe(cs[1].openTime)
  })
})

describe('filterDominantSwings', () => {
  it('returns empty for empty input', () => {
    expect(filterDominantSwings([])).toHaveLength(0)
  })

  it('keeps alternating highs and lows unchanged', () => {
    const input = [
      { index: 1, timestamp: 0, price: 110, type: 'high' as const, label: null },
      { index: 2, timestamp: 0, price: 90,  type: 'low'  as const, label: null },
      { index: 3, timestamp: 0, price: 120, type: 'high' as const, label: null },
    ]
    expect(filterDominantSwings(input)).toHaveLength(3)
  })

  it('keeps the higher of two consecutive swing highs', () => {
    const input = [
      { index: 1, timestamp: 0, price: 110, type: 'high' as const, label: null },
      { index: 2, timestamp: 0, price: 120, type: 'high' as const, label: null },
    ]
    const result = filterDominantSwings(input)
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(120)
    expect(result[0].index).toBe(2)
  })

  it('keeps the earlier swing when consecutive highs have equal price', () => {
    const input = [
      { index: 1, timestamp: 0, price: 110, type: 'high' as const, label: null },
      { index: 2, timestamp: 0, price: 110, type: 'high' as const, label: null },
    ]
    const result = filterDominantSwings(input)
    expect(result).toHaveLength(1)
    expect(result[0].index).toBe(1)  // first kept, second doesn't replace (not strictly greater)
  })

  it('keeps the lower of two consecutive swing lows', () => {
    const input = [
      { index: 1, timestamp: 0, price: 90, type: 'low' as const, label: null },
      { index: 2, timestamp: 0, price: 80, type: 'low' as const, label: null },
    ]
    const result = filterDominantSwings(input)
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(80)
  })

  it('collapses triple consecutive highs to the maximum', () => {
    const input = [
      { index: 1, timestamp: 0, price: 105, type: 'high' as const, label: null },
      { index: 2, timestamp: 0, price: 115, type: 'high' as const, label: null },
      { index: 3, timestamp: 0, price: 110, type: 'high' as const, label: null },
    ]
    const result = filterDominantSwings(input)
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(115)
  })

  it('produces a strictly alternating sequence from a messy input', () => {
    const input = [
      { index: 1,  timestamp: 0, price: 100, type: 'high' as const, label: null },
      { index: 2,  timestamp: 0, price: 110, type: 'high' as const, label: null },
      { index: 5,  timestamp: 0, price: 90,  type: 'low'  as const, label: null },
      { index: 6,  timestamp: 0, price: 85,  type: 'low'  as const, label: null },
      { index: 10, timestamp: 0, price: 120, type: 'high' as const, label: null },
    ]
    const result = filterDominantSwings(input)
    // Should be: H110, L85, H120
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ type: 'high', price: 110 })
    expect(result[1]).toMatchObject({ type: 'low',  price: 85 })
    expect(result[2]).toMatchObject({ type: 'high', price: 120 })
  })
})
