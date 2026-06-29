import type { SwingPoint, StructureCounts, TrendDirection, TrendStrength, MarketStructureConfig } from './types'

export interface TrendResult {
  direction: TrendDirection
  strength: TrendStrength
}

/**
 * Counts all HH/HL/LH/LL/EH/EL labels in the labeled swing list.
 * Operates on the full swing history, not just a recent window.
 */
export function countStructure(labeledSwings: SwingPoint[]): StructureCounts {
  let higherHighs = 0
  let higherLows = 0
  let lowerHighs = 0
  let lowerLows = 0
  let equalHighs = 0
  let equalLows = 0

  for (const s of labeledSwings) {
    switch (s.label) {
      case 'HH': higherHighs++; break
      case 'HL': higherLows++; break
      case 'LH': lowerHighs++; break
      case 'LL': lowerLows++; break
      case 'EH': equalHighs++; break
      case 'EL': equalLows++; break
    }
  }

  return { higherHighs, higherLows, lowerHighs, lowerLows, equalHighs, equalLows }
}

/**
 * Determines the current trend direction and strength from recent swing structure.
 *
 * Algorithm:
 *   1. Take the most recent (minSwingsForTrend × 2) labeled swings.
 *   2. Score: bullish = HH + HL, bearish = LH + LL (EH/EL are neutral).
 *   3. If bullish / total ≥ 0.75 → bullish direction.
 *      If bullish / total ≤ 0.25 → bearish direction.
 *      Otherwise → ranging.
 *
 * Strength rules (bullish example; bearish is symmetric):
 *   strong   — HH ≥ 2 AND HL ≥ 2 AND total bullish points ≥ 6
 *   moderate — HH ≥ 2 AND HL ≥ 2 (both pairs confirmed but not yet strong)
 *   weak     — direction clear by ratio but not both pairs confirmed
 *
 * Requires at least 2 labeled swings. Returns ranging/weak otherwise.
 */
export function determineTrend(
  labeledSwings: SwingPoint[],
  config: MarketStructureConfig,
): TrendResult {
  const labeled = labeledSwings.filter(s => s.label !== null)

  if (labeled.length < 2) {
    return { direction: 'ranging', strength: 'weak' }
  }

  const window = labeled.slice(-(config.minSwingsForTrend * 2))

  let hh = 0, hl = 0, lh = 0, ll = 0

  for (const s of window) {
    if (s.label === 'HH') hh++
    else if (s.label === 'HL') hl++
    else if (s.label === 'LH') lh++
    else if (s.label === 'LL') ll++
  }

  const bullish = hh + hl
  const bearish = lh + ll
  const total = bullish + bearish

  if (total === 0) return { direction: 'ranging', strength: 'weak' }

  const ratio = bullish / total

  if (ratio >= 0.75) {
    let strength: TrendStrength = 'weak'
    if (hh >= 2 && hl >= 2) {
      strength = bullish >= 6 ? 'strong' : 'moderate'
    }
    return { direction: 'bullish', strength }
  }

  if (ratio <= 0.25) {
    let strength: TrendStrength = 'weak'
    if (lh >= 2 && ll >= 2) {
      strength = bearish >= 6 ? 'strong' : 'moderate'
    }
    return { direction: 'bearish', strength }
  }

  return { direction: 'ranging', strength: 'weak' }
}
