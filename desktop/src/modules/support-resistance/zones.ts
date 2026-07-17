import type { Candle } from '../market/types'
import type { SwingPoint } from '../market-structure/types'
import type { PriceZone, SupportResistanceConfig } from './types'

/** Half-width for a zone centered at `center`, given ATR and config. */
function zoneHalfWidth(center: number, atr: number | null, config: SupportResistanceConfig): number {
  if (atr !== null && atr > 0) return atr * config.atrMultiplier
  return center * 0.003
}

/**
 * Build initial zone candidates from swing points.
 * Each swing high → resistance zone; each swing low → support zone.
 * Only swings within the lookback window are considered.
 * touchCount starts at 1 (the creating swing itself counts as the first touch).
 *
 * `atr` must be pre-computed by the caller (Module 2's computeAtr).
 * `idOffset` allows the caller to control the numeric prefix of generated IDs
 * so that IDs remain sequential and unique across calls.
 */
export function createZoneCandidates(
  swings: SwingPoint[],
  candles: Candle[],
  config: SupportResistanceConfig,
  atr: number | null,
  idOffset: number = 0,
): PriceZone[] {
  const totalCandles = candles.length
  const minIndex = totalCandles - config.lookback

  const zones: PriceZone[] = []

  for (const swing of swings) {
    if (swing.index < minIndex) continue

    const center = swing.price
    const half = zoneHalfWidth(center, atr, config)
    const upper = center + half
    const lower = center - half
    const age = totalCandles - 1 - swing.index

    zones.push({
      id: `sr-${String(idOffset + zones.length + 1).padStart(3, '0')}`,
      type: swing.type === 'high' ? 'resistance' : 'support',
      origin: swing.type === 'high' ? 'swing-high' : 'swing-low',
      state: 'active',
      center,
      upper,
      lower,
      width: upper - lower,
      touchCount: 1,
      successfulReactions: 0,
      failedReactions: 0,
      broken: false,
      retested: false,
      firstDetectedIndex: swing.index + (config.swingLookback ?? 0),
      lastInteractionIndex: swing.index,
      age,
      strength: 0,
      confidence: 0,
      evidence: [],
    })
  }

  return zones
}
