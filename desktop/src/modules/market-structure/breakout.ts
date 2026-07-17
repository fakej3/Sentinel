import type { Candle } from '../binance'
import type { ConsolidationResult, BreakoutResult, MarketStructureConfig } from './types'

/**
 * Detects whether the most recent candle represents a breakout from
 * an active consolidation zone.
 *
 * A CONFIRMED breakout requires (ENGINE_RULES.md §2 Breakout):
 *   1. Most recent close is outside the consolidation range.
 *   2. Volume on the breakout candle ≥ config.breakoutVolumeMultiplier × 20-period volume MA.
 *
 * An UNCONFIRMED breakout is when condition 1 is met but not condition 2
 * (the level was breached but without volume support).
 *
 * A FAILED breakout is when price exited the range on a previous candle but
 * the most recent close has returned inside. We detect this by checking
 * whether a prior candle closed outside while the last candle has returned.
 *
 * Returns confirmed=false / failed=false / direction=null when:
 *   - No consolidation is active.
 *   - The most recent candle remains inside the range (no breakout attempt).
 */
export function detectBreakout(
  candles: Candle[],
  consolidation: ConsolidationResult,
  config: MarketStructureConfig,
): BreakoutResult {
  const NOT_BREAKING: BreakoutResult = {
    confirmed: false,
    failed: false,
    level: null,
    direction: null,
  }

  if (
    !consolidation.detected ||
    consolidation.rangeHigh === null ||
    consolidation.rangeLow === null
  ) {
    return NOT_BREAKING
  }

  const { rangeHigh, rangeLow } = consolidation
  const lastCandle = candles[candles.length - 1]
  const lastClose = lastCandle.close

  // Compute 20-period volume MA from the candles BEFORE the breakout candle.
  // Excluding the breakout candle itself prevents self-referential inflation.
  const priorCandles = candles.slice(0, -1)
  const volWindow = Math.min(20, priorCandles.length)
  const volSlice = priorCandles.slice(-volWindow)
  const volMa = volSlice.length > 0
    ? volSlice.reduce((sum, c) => sum + c.volume, 0) / volSlice.length
    : 0
  const relVol = volMa > 0 ? lastCandle.volume / volMa : 0

  const breakoutDirection: 'bullish' | 'bearish' | null =
    lastClose > rangeHigh ? 'bullish' :
    lastClose < rangeLow  ? 'bearish' :
    null

  if (breakoutDirection === null) {
    // Check if a previous candle broke out but price returned (failed breakout).
    // Limit scan to the consolidation window to avoid flagging historical breakouts.
    const startIdx = Math.max(0, candles.length - 1 - (consolidation.barsInRange ?? candles.length))
    const prevBroke = candles.slice(startIdx, -1).some(
      c => c.close > rangeHigh || c.close < rangeLow,
    )
    if (prevBroke) {
      return { confirmed: false, failed: true, level: null, direction: null }
    }
    return NOT_BREAKING
  }

  const level = breakoutDirection === 'bullish' ? rangeHigh : rangeLow
  const confirmed = relVol >= config.breakoutVolumeMultiplier

  return { confirmed, failed: false, level, direction: breakoutDirection }
}
