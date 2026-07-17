import { describe, it, expect } from 'vitest'
import { detectBosChoch } from '../bos-choch'
import { DEFAULT_CONFIG } from '../config'
import type { SwingPoint } from '../types'
import { candles } from './helpers'

const cfg1 = { ...DEFAULT_CONFIG, swingLookback: 1 }

function swing(type: 'high' | 'low', price: number, index: number): SwingPoint {
  return { index, timestamp: index * 1000, price, type, label: null }
}

describe('detectBosChoch', () => {
  it('returns empty array with no dominant swings', () => {
    const cs = candles([100, 110, 120, 130])
    expect(detectBosChoch(cs, [], cfg1)).toHaveLength(0)
  })

  it('returns empty array with empty candles', () => {
    const s = [swing('high', 110, 1)]
    expect(detectBosChoch([], s, cfg1)).toHaveLength(0)
  })

  it('detects bullish BOS when close exceeds confirmed swing high', () => {
    // Swing high at index 2 (price 115).
    // With lookback=1, it becomes visible at candle 3.
    // Candle 4 closes at 120 > 115 → BOS bullish.
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [115, 116, 114],  // swing high (index 2)
      [100, 101, 99],   // swing visible here (index 3 = 2+1)
      [120, 121, 119],  // close > 115 → BOS
    ])
    const swings = [swing('high', 116, 2)]
    const events = detectBosChoch(cs, swings, cfg1)
    const bos = events.filter(e => e.type === 'BOS' && e.direction === 'bullish')
    expect(bos).toHaveLength(1)
    expect(bos[0].level).toBe(116)
    expect(bos[0].index).toBe(4)
  })

  it('detects bearish BOS when close drops below confirmed swing low', () => {
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [85,  86,  84],   // swing low (index 2, low=84)
      [100, 101, 99],   // visible at index 3
      [80,  81,  79],   // close < 84 → BOS bearish
    ])
    const swings = [swing('low', 84, 2)]
    const events = detectBosChoch(cs, swings, cfg1)
    const bos = events.filter(e => e.type === 'BOS' && e.direction === 'bearish')
    expect(bos).toHaveLength(1)
    expect(bos[0].level).toBe(84)
  })

  it('wick breach alone does not trigger BOS (close-only rule)', () => {
    // Candle 4: high=120 pierces 116, but close=115 (exactly AT the level, not above)
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [115, 116, 114],
      [100, 101, 99],
      [115, 120, 110],  // high=120 wick above swing, close=115 (not above 116)
    ])
    const swings = [swing('high', 116, 2)]
    const events = detectBosChoch(cs, swings, cfg1)
    expect(events).toHaveLength(0)
  })

  it('swing is not visible before its confirmation candle', () => {
    // Swing at index 5, lookback=1 → visible from candle 6 onward
    const cs = candles([
      100, 100, 100, 100, 100,
      115,   // swing HIGH at index 5 (high=115.5 default)
      120,   // candle 6: first time swing is confirmed; close=120 > 115.5 → BOS
    ])
    const swings = [swing('high', 115.5, 5)]
    const events = detectBosChoch(cs, swings, cfg1)
    expect(events.find(e => e.index < 6)).toBeUndefined()
    expect(events.find(e => e.index === 6 && e.type === 'BOS')).toBeDefined()
  })

  it('each structural level triggers at most one event', () => {
    // Multiple candles close above the swing high — only the first counts
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [115, 116, 114],
      [100, 101, 99],
      [120, 121, 119],  // first close above → BOS
      [125, 126, 124],  // second close above → should NOT trigger another event
    ])
    const swings = [swing('high', 116, 2)]
    const events = detectBosChoch(cs, swings, cfg1)
    const bos = events.filter(e => e.direction === 'bullish')
    expect(bos).toHaveLength(1)
  })

  it('detects CHOCH when bias is bullish and price breaks below swing low', () => {
    // 1. First breach up → BOS bullish (bias = bullish)
    // 2. Then breach down → CHOCH bearish
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [115, 116, 114],  // swing high at 2
      [100, 101, 99],   // swing low at 3 (low=99)
      [120, 121, 119],  // BOS bullish (close > 116)
      [90,  91,  89],   // close < 99 → CHOCH bearish
    ])
    const swings = [
      swing('high', 116, 2),
      swing('low',  99,  3),
    ]
    const events = detectBosChoch(cs, swings, cfg1)
    const bos   = events.filter(e => e.type === 'BOS')
    const choch = events.filter(e => e.type === 'CHOCH')
    expect(bos).toHaveLength(1)
    expect(bos[0].direction).toBe('bullish')
    expect(choch).toHaveLength(1)
    expect(choch[0].direction).toBe('bearish')
  })

  it('detects CHOCH when bias is bearish and price breaks above swing high', () => {
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [85,  86,  84],   // swing low at 2
      [100, 101, 99],   // swing high at 3
      [80,  81,  79],   // BOS bearish (close < 84)
      [110, 111, 109],  // close > 101 → CHOCH bullish
    ])
    const swings = [
      swing('low',  84,  2),
      swing('high', 101, 3),
    ]
    const events = detectBosChoch(cs, swings, cfg1)
    const bos   = events.filter(e => e.type === 'BOS')
    const choch = events.filter(e => e.type === 'CHOCH')
    expect(bos[0].direction).toBe('bearish')
    expect(choch[0].direction).toBe('bullish')
  })

  it('consecutive BOS in same direction — second is also BOS, not CHOCH', () => {
    // Two consecutive bullish BOS without a bearish break in between
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [110, 111, 109],   // first swing high
      [100, 101, 99],
      [115, 116, 114],   // second swing high
      [100, 101, 99],
      [120, 121, 119],   // BOS 1: close > 111
      [125, 126, 124],   // BOS 2: close > 116
    ])
    const swings = [
      swing('high', 111, 2),
      swing('high', 116, 4),
    ]
    // dominance filter would keep 116 (higher), but let's pass them separately
    // to test the BOS detection logic with two distinct high levels
    const events = detectBosChoch(cs, swings, cfg1)
    const bos = events.filter(e => e.type === 'BOS')
    expect(bos.length).toBeGreaterThanOrEqual(1)
    expect(events.filter(e => e.type === 'CHOCH')).toHaveLength(0)
  })

  it('bias flips after CHOCH — next same-direction break is BOS', () => {
    // BOS bullish → CHOCH bearish (bias=bearish) → another bearish break → BOS bearish
    const cs = candles([
      [100, 101, 99],
      [100, 101, 99],
      [115, 116, 114],  // swing high
      [100, 101, 99],   // swing low (low=99)
      [120, 121, 119],  // BOS bullish
      [90,  91,  89],   // CHOCH bearish (close < 99, bias flips to bearish)
      [80,  81,  79],   // BOS bearish (consistent with new bearish bias)
    ])
    const swings = [
      swing('high', 116, 2),
      swing('low',  99,  3),
      swing('low',  89,  4),  // new lower low becomes reference
    ]
    const events = detectBosChoch(cs, swings, cfg1)
    const choch = events.filter(e => e.type === 'CHOCH')
    const bos   = events.filter(e => e.type === 'BOS')
    expect(choch).toHaveLength(1)
    // At least one bullish BOS and one bearish BOS
    expect(bos.some(e => e.direction === 'bullish')).toBe(true)
    expect(bos.some(e => e.direction === 'bearish')).toBe(true)
  })
})
