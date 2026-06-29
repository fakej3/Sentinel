import type { Candle } from '../binance'
import type { SwingPoint, StructureEvent, MarketStructureConfig } from './types'

/**
 * Detects Break of Structure (BOS) and Change of Character (CHOCH) events
 * by scanning the candle series chronologically.
 *
 * ──────────────────────────────────────────────
 * DEFINITIONS
 * ──────────────────────────────────────────────
 *
 * Structural bias starts as null and is set by the first breach:
 *   - First close above a confirmed swing high → bias = 'bullish'
 *   - First close below a confirmed swing low  → bias = 'bearish'
 *
 * BOS (Break of Structure):
 *   Continuation event. Price closes beyond a swing level in the direction
 *   of the current bias.
 *   - Bullish bias + close > last confirmed swing high → BOS bullish
 *   - Bearish bias + close < last confirmed swing low  → BOS bearish
 *
 * CHOCH (Change of Character):
 *   Potential reversal. Price closes beyond a swing level AGAINST the bias.
 *   - Bullish bias + close < last confirmed swing low  → CHOCH bearish
 *   - Bearish bias + close > last confirmed swing high → CHOCH bullish
 *   CHOCH flips the bias.
 *
 * ──────────────────────────────────────────────
 * ALGORITHM
 * ──────────────────────────────────────────────
 *
 * Forward pass over candles:
 *   At candle i, swings with index ≤ (i − swingLookback) are considered
 *   "confirmed" (their right-side lookback has elapsed). They become the
 *   new reference levels for BOS / CHOCH checks.
 *
 *   Each swing level triggers at most ONE event (the first close that
 *   breaches it). After the breach, the level is marked as consumed and
 *   the next confirmed swing becomes the new reference.
 *
 * ──────────────────────────────────────────────
 * RULES (from ENGINE_RULES.md)
 * ──────────────────────────────────────────────
 *   - BOS / CHOCH require a candle CLOSE beyond the level. Wicks alone
 *     do not trigger an event.
 *   - CHOCH signals a potential reversal. It does not confirm one.
 */
export function detectBosChoch(
  candles: Candle[],
  dominantSwings: SwingPoint[],
  config: MarketStructureConfig,
): StructureEvent[] {
  if (candles.length === 0 || dominantSwings.length === 0) return []

  const L = config.swingLookback
  const events: StructureEvent[] = []

  // Build a map: candle index → swings that become confirmed at that index.
  // A swing at candle[k] is confirmed once candle[k+L] has formed, meaning
  // candle[k+L] is the first bar where we can act on this swing.
  const confirmAt = new Map<number, SwingPoint[]>()
  for (const s of dominantSwings) {
    const idx = s.index + L
    if (!confirmAt.has(idx)) confirmAt.set(idx, [])
    confirmAt.get(idx)!.push(s)
  }

  let lastHigh: SwingPoint | null = null
  let lastLow: SwingPoint | null = null
  // Track which reference object triggered the most recent event so we
  // don't emit duplicate events for the same swing level.
  let highUsed: SwingPoint | null = null
  let lowUsed: SwingPoint | null = null

  // Structural bias: null → unknown; 'bullish' → uptrend; 'bearish' → downtrend
  let bias: 'bullish' | 'bearish' | null = null

  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close
    const newSwings = confirmAt.get(i) ?? []

    // Pass 1: check breach against the currently-active reference levels.
    // Must happen BEFORE we promote new swings, so a close that simultaneously
    // breaches an existing level AND sees a new swing confirmed at the same
    // candle is correctly attributed to the pre-existing level.
    if (lastHigh && highUsed !== lastHigh && close > lastHigh.price) {
      const type = (bias === null || bias === 'bullish') ? 'BOS' : 'CHOCH'
      events.push({
        type,
        index: i,
        timestamp: candles[i].openTime,
        level: lastHigh.price,
        direction: 'bullish',
      })
      highUsed = lastHigh
      bias = 'bullish'
    }
    if (lastLow && lowUsed !== lastLow && close < lastLow.price) {
      const type = (bias === null || bias === 'bearish') ? 'BOS' : 'CHOCH'
      events.push({
        type,
        index: i,
        timestamp: candles[i].openTime,
        level: lastLow.price,
        direction: 'bearish',
      })
      lowUsed = lastLow
      bias = 'bearish'
    }

    // Pass 2: promote newly-confirmed swings to active reference levels.
    for (const s of newSwings) {
      if (s.type === 'high') {
        lastHigh = s
        highUsed = null
      } else {
        lastLow = s
        lowUsed = null
      }
    }

    // Pass 3: check breach against swings just made active this candle.
    // This handles the case where a swing is confirmed on the very candle
    // that first closes beyond it, and there was no prior active level of
    // that type to test in Pass 1.
    for (const s of newSwings) {
      if (s.type === 'high' && highUsed !== lastHigh && close > lastHigh!.price) {
        const type = (bias === null || bias === 'bullish') ? 'BOS' : 'CHOCH'
        events.push({
          type,
          index: i,
          timestamp: candles[i].openTime,
          level: lastHigh!.price,
          direction: 'bullish',
        })
        highUsed = lastHigh
        bias = 'bullish'
      } else if (s.type === 'low' && lowUsed !== lastLow && close < lastLow!.price) {
        const type = (bias === null || bias === 'bearish') ? 'BOS' : 'CHOCH'
        events.push({
          type,
          index: i,
          timestamp: candles[i].openTime,
          level: lastLow!.price,
          direction: 'bearish',
        })
        lowUsed = lastLow
        bias = 'bearish'
      }
    }
  }

  return events
}
