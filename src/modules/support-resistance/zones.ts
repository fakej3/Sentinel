import type { Candle } from '../binance/types'
import type { SwingPoint } from '../market-structure/types'
import type { PriceZone, SupportResistanceConfig } from './types'

let zoneCounter = 0

export function resetZoneCounter(): void {
  zoneCounter = 0
}

function nextZoneId(): string {
  zoneCounter++
  return `sr-${String(zoneCounter).padStart(3, '0')}`
}

/** Wilder ATR from raw candles (14-period). Falls back when insufficient data. */
export function computeAtr(candles: Candle[]): number | null {
  const period = 14
  if (candles.length < period + 1) return null

  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    ))
  }

  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
  }
  return atr
}

/** Half-width for a zone centered at `center`, given ATR and config. */
export function zoneHalfWidth(center: number, atr: number | null, config: SupportResistanceConfig): number {
  if (atr !== null && atr > 0) return atr * config.atrMultiplier
  return center * 0.003
}

/**
 * Build initial zone candidates from swing points.
 * Each swing high → resistance zone; each swing low → support zone.
 * Only swings within the lookback window are considered.
 * touchCount starts at 1 (the creating swing itself counts as the first touch).
 */
export function createZoneCandidates(
  swings: SwingPoint[],
  candles: Candle[],
  config: SupportResistanceConfig,
): PriceZone[] {
  const totalCandles = candles.length
  const minIndex = totalCandles - config.lookback

  const atr = computeAtr(candles)
  const zones: PriceZone[] = []

  for (const swing of swings) {
    if (swing.index < minIndex) continue

    const center = swing.price
    const half = zoneHalfWidth(center, atr, config)
    const upper = center + half
    const lower = center - half
    const age = totalCandles - 1 - swing.index

    zones.push({
      id: nextZoneId(),
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
      firstDetectedIndex: swing.index,
      lastInteractionIndex: swing.index,
      age,
      strength: 0,
      confidence: 0,
      evidence: [],
    })
  }

  return zones
}
