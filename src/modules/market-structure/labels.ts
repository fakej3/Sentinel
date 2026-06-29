import type { SwingPoint, SwingLabel, MarketStructureConfig } from './types'

/**
 * Labels each swing point relative to the previous confirmed dominant swing
 * of the same type.
 *
 * Classification rules:
 *
 *   Swing Highs:
 *     HH — current high > previous high (by more than equalThreshold%)
 *     LH — current high < previous high (by more than equalThreshold%)
 *     EH — |current − previous| / previous × 100 < equalThreshold
 *
 *   Swing Lows:
 *     HL — current low > previous low (by more than equalThreshold%)
 *     LL — current low < previous low (by more than equalThreshold%)
 *     EL — |current − previous| / previous × 100 < equalThreshold
 *
 * The very first swing of each type receives label=null because there is no
 * previous of the same type to compare against.
 *
 * Input must be the output of filterDominantSwings (strictly alternating).
 * The label=null fields from that output are overwritten here.
 */
export function labelSwings(
  dominantSwings: SwingPoint[],
  config: MarketStructureConfig,
): SwingPoint[] {
  let prevHighPrice: number | null = null
  let prevLowPrice: number | null = null

  return dominantSwings.map((swing): SwingPoint => {
    let label: SwingLabel | null = null

    if (swing.type === 'high') {
      if (prevHighPrice !== null) {
        const pct = Math.abs(swing.price - prevHighPrice) / prevHighPrice * 100
        if (pct < config.equalThreshold) {
          label = 'EH'
        } else if (swing.price > prevHighPrice) {
          label = 'HH'
        } else {
          label = 'LH'
        }
      }
      prevHighPrice = swing.price
    } else {
      if (prevLowPrice !== null) {
        const pct = Math.abs(swing.price - prevLowPrice) / prevLowPrice * 100
        if (pct < config.equalThreshold) {
          label = 'EL'
        } else if (swing.price > prevLowPrice) {
          label = 'HL'
        } else {
          label = 'LL'
        }
      }
      prevLowPrice = swing.price
    }

    return { ...swing, label }
  })
}
