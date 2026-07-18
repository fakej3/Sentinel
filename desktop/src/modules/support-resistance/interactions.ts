import type { Candle } from '../market/types'
import type { PriceZone } from './types'

/**
 * Scan candles and update zone interaction fields.
 * Processes candles in chronological order starting after the zone's creation index.
 *
 * Touch: candle's high ≥ zone.lower AND candle's low ≤ zone.upper.
 *
 * Successful Reaction (Bounce):
 *   - Resistance: candle touched zone AND close < zone.lower; next candle doesn't re-enter.
 *   - Support: candle touched zone AND close > zone.upper; next candle doesn't re-enter.
 *
 * Failed Reaction (Break): price closed on the far side of the zone and did not reverse
 *   back into the zone within 3 candles.
 *
 * Retest: after a zone is broken, price returns to the zone from the opposite side.
 *
 * Returns a new PriceZone object (non-mutating).
 */
export function applyInteractions(zone: PriceZone, candles: Candle[]): PriceZone {
  let z = { ...zone, evidence: [...zone.evidence] }

  const startIdx = zone.firstDetectedIndex + 1

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i]
    const touched = c.high >= z.lower && c.low <= z.upper

    if (!touched) continue

    z = { ...z, touchCount: z.touchCount + 1, lastInteractionIndex: i }

    if (!z.broken) {
      // Determine if this touch is a bounce or break
      if (z.type === 'resistance') {
        if (c.close < z.lower) {
          // Closed below zone bottom — potential bounce (successful reaction)
          const nextCandle = i + 1 < candles.length ? candles[i + 1] : null
          // Bounce is confirmed only when the next candle exists and stays below the zone.
          // Without a next candle the reaction is inconclusive — no credit awarded either way.
          const failed = nextCandle !== null && nextCandle.close >= z.lower
          const confirmed = nextCandle !== null && !failed
          if (confirmed) {
            z = { ...z, successfulReactions: z.successfulReactions + 1 }
          } else if (failed) {
            z = { ...z, failedReactions: z.failedReactions + 1 }
          }
        } else if (c.close > z.upper) {
          // Closed above zone top — potential break (failed reaction for resistance)
          const reversedWithin3 = didReverseWithin3(z, candles, i + 1, 'resistance')
          if (!reversedWithin3) {
            z = { ...z, failedReactions: z.failedReactions + 1, broken: true }
          } else {
            // Reversed back — failed break attempt; count as failed reaction but not broken
            z = { ...z, failedReactions: z.failedReactions + 1 }
          }
        }
      } else {
        // support zone
        if (c.close > z.upper) {
          // Closed above zone top — bounce (successful reaction for support)
          const nextCandle = i + 1 < candles.length ? candles[i + 1] : null
          // Bounce is confirmed only when the next candle exists and stays above the zone.
          // Without a next candle the reaction is inconclusive — no credit awarded either way.
          const failed = nextCandle !== null && nextCandle.close <= z.upper
          const confirmed = nextCandle !== null && !failed
          if (confirmed) {
            z = { ...z, successfulReactions: z.successfulReactions + 1 }
          } else if (failed) {
            z = { ...z, failedReactions: z.failedReactions + 1 }
          }
        } else if (c.close < z.lower) {
          // Closed below zone bottom — break (failed reaction for support)
          const reversedWithin3 = didReverseWithin3(z, candles, i + 1, 'support')
          if (!reversedWithin3) {
            z = { ...z, failedReactions: z.failedReactions + 1, broken: true }
          } else {
            z = { ...z, failedReactions: z.failedReactions + 1 }
          }
        }
      }
    } else {
      // Zone is broken — check for retest from opposite side
      if (!z.retested) {
        // Retest: price re-enters zone and closes on the "bounced" side,
        // confirming the zone has flipped roles.
        // Broken resistance (now support): price enters zone and closes ≥ lower (bounces back up).
        // Broken support (now resistance): price enters zone and closes ≤ upper (bounces back down).
        const inZone = c.high >= z.lower && c.low <= z.upper
        const isRetest = inZone && (
          z.type === 'resistance'
            ? c.close >= z.lower   // former resistance acts as support → price bounced up
            : c.close <= z.upper   // former support acts as resistance → price bounced down
        )
        if (isRetest) {
          z = { ...z, retested: true }
        }
      }
    }
  }

  return z
}

/** Check if price reversed back into the zone within the next 3 candles */
function didReverseWithin3(
  zone: PriceZone,
  candles: Candle[],
  startIdx: number,
  zoneType: 'support' | 'resistance',
): boolean {
  for (let j = startIdx; j < Math.min(startIdx + 3, candles.length); j++) {
    const c = candles[j]
    const reentered = c.high >= zone.lower && c.low <= zone.upper
    if (reentered) {
      if (zoneType === 'resistance' && c.close < zone.upper) return true
      if (zoneType === 'support' && c.close > zone.lower) return true
    }
  }
  return false
}
