import type { Candle } from '../binance'
import type { SwingPoint, MarketStructureConfig } from './types'

/**
 * Detects confirmed swing highs and lows in a candle series.
 *
 * A swing high is confirmed at index i when:
 *   high[i] > high[j] for every j in [i−L, i−1] ∪ [i+1, i+L]
 *
 * A swing low is confirmed at index i when:
 *   low[i] < low[j] for every j in [i−L, i−1] ∪ [i+1, i+L]
 *
 * Strict inequality means equal-high/equal-low neighbors prevent detection.
 * Candles within L bars of either edge cannot be confirmed and are skipped.
 *
 * Both a swing high and a swing low can be detected on the same candle if
 * that candle's high and low satisfy the respective conditions independently.
 * This is uncommon after the dominance filter but is mathematically valid.
 */
export function detectRawSwings(
  candles: Candle[],
  config: MarketStructureConfig,
): SwingPoint[] {
  const L = config.swingLookback
  const minLen = 2 * L + 1
  if (candles.length < minLen) return []

  const result: SwingPoint[] = []

  for (let i = L; i < candles.length - L; i++) {
    const pivotHigh = candles[i].high
    const pivotLow = candles[i].low

    let isSwingHigh = true
    let isSwingLow = true

    for (let j = i - L; j <= i + L; j++) {
      if (j === i) continue
      if (candles[j].high >= pivotHigh) isSwingHigh = false
      if (candles[j].low <= pivotLow) isSwingLow = false
      // Short-circuit when both are already false
      if (!isSwingHigh && !isSwingLow) break
    }

    if (isSwingHigh) {
      result.push({
        index: i,
        timestamp: candles[i].openTime,
        price: pivotHigh,
        type: 'high',
        label: null,
      })
    }

    if (isSwingLow) {
      result.push({
        index: i,
        timestamp: candles[i].openTime,
        price: pivotLow,
        type: 'low',
        label: null,
      })
    }
  }

  // Sort by index ascending (handles the rare case where same candle produces both)
  return result.sort((a, b) => a.index - b.index || (a.type === 'high' ? -1 : 1))
}

/**
 * Filters a raw swing list to produce a strictly alternating high-low sequence.
 *
 * When multiple consecutive swings of the same type appear (e.g., two swing
 * highs without an intervening swing low), only the most extreme is kept:
 *   - Consecutive highs → keep the highest
 *   - Consecutive lows  → keep the lowest
 *
 * The result is a clean zigzag suitable for HH/HL/LH/LL classification.
 */
export function filterDominantSwings(rawSwings: SwingPoint[]): SwingPoint[] {
  const result: SwingPoint[] = []

  for (const swing of rawSwings) {
    const last = result[result.length - 1]

    if (!last) {
      result.push(swing)
      continue
    }

    if (last.type === swing.type) {
      const replaceWithCurrent =
        (swing.type === 'high' && swing.price > last.price) ||
        (swing.type === 'low' && swing.price < last.price)

      if (replaceWithCurrent) {
        result[result.length - 1] = swing
      }
    } else {
      result.push(swing)
    }
  }

  return result
}
