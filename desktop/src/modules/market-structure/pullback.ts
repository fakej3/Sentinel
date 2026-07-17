import type { Candle } from '../binance'
import type { SwingPoint, StructureEvent, PullbackResult } from './types'

/**
 * Detects whether the market is currently in a pullback after the last BOS.
 *
 * A pullback is defined structurally (not by EMA proximity, which belongs
 * to the Analysis Engine that combines indicators + structure):
 *
 * After a BULLISH BOS:
 *   - The most recent close is BELOW the BOS level (price has retraced).
 *   - The most recent close is ABOVE the last confirmed dominant swing LOW
 *     (structure has not been violated; this is a pullback, not a reversal).
 *   - depth = (bosLevel − close) / (bosLevel − swingLow)
 *     Range 0–1: 0 = at the BOS level, 1 = at the swing low anchor.
 *
 * After a BEARISH BOS (symmetric):
 *   - The most recent close is ABOVE the BOS level.
 *   - The most recent close is BELOW the last confirmed dominant swing HIGH.
 *   - depth = (close − bosLevel) / (swingHigh − bosLevel)
 *
 * Returns detected=false when:
 *   - No BOS events have occurred.
 *   - No swing low (bullish) or swing high (bearish) reference exists.
 *   - Current price is already beyond the anchor (structure violated).
 *   - Current price is on the breakout side of the BOS level (still in impulse).
 */
export function detectPullback(
  candles: Candle[],
  labeledSwings: SwingPoint[],
  bosEvents: StructureEvent[],
): PullbackResult {
  const NOT_PULLING: PullbackResult = { detected: false, depth: null }

  if (bosEvents.length === 0 || candles.length === 0) return NOT_PULLING

  const lastBos = bosEvents[bosEvents.length - 1]
  const lastClose = candles[candles.length - 1].close

  if (lastBos.direction === 'bullish') {
    // Pullback anchor: the dominant swing LOW most recent before the BOS
    const relevantLows = labeledSwings.filter(
      s => s.type === 'low' && s.index < lastBos.index,
    )
    const anchorSwing = relevantLows[relevantLows.length - 1]
    if (!anchorSwing) return NOT_PULLING

    const bosLevel = lastBos.level
    const anchorLow = anchorSwing.price

    // Price must be in [anchorLow, bosLevel) to be a pullback
    if (lastClose >= bosLevel) return NOT_PULLING   // still in impulse
    if (lastClose <= anchorLow) return NOT_PULLING  // structure violated

    const range = bosLevel - anchorLow
    const depth = range > 0 ? (bosLevel - lastClose) / range : 0

    return { detected: true, depth }
  }

  if (lastBos.direction === 'bearish') {
    const relevantHighs = labeledSwings.filter(
      s => s.type === 'high' && s.index < lastBos.index,
    )
    const anchorSwing = relevantHighs[relevantHighs.length - 1]
    if (!anchorSwing) return NOT_PULLING

    const bosLevel = lastBos.level
    const anchorHigh = anchorSwing.price

    if (lastClose <= bosLevel) return NOT_PULLING   // still in impulse
    if (lastClose >= anchorHigh) return NOT_PULLING // structure violated

    const range = anchorHigh - bosLevel
    const depth = range > 0 ? (lastClose - bosLevel) / range : 0

    return { detected: true, depth }
  }

  return NOT_PULLING
}
