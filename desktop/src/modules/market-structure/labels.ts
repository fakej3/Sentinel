import type { SwingPoint, SwingLabel, MarketStructureConfig } from './types'

/**
 * Labels each swing point relative to the previous confirmed dominant swing
 * of the same type — WITHIN the current structural regime.
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
 * Regime boundaries: `regimeResets` carries the candle indices of CHoCH
 * events. A CHoCH is BY DEFINITION a change of structural character — the
 * old regime's reference highs/lows stop being the comparison baseline the
 * moment character changes. At each reset, the previous-high/previous-low
 * state is cleared, so the first swing of each type in the new regime gets
 * label=null (no predecessor in this regime) and subsequent swings are
 * labeled against new-regime references only.
 *
 * Without this, a market that V-reverses keeps printing LH/LL deep into the
 * new uptrend because every new high is compared against the pre-reversal
 * extreme — labels that contradict what any trader sees on the chart, and
 * that poison every downstream consumer (trend window, fullTrend conditions,
 * structural confidence, Fibonacci impulse selection).
 *
 * The very first swing of each type (per regime) receives label=null because
 * there is no previous of the same type to compare against.
 *
 * Input must be the output of filterDominantSwings (strictly alternating).
 * The label=null fields from that output are overwritten here.
 */
export function labelSwings(
  dominantSwings: SwingPoint[],
  config: MarketStructureConfig,
  regimeResets: readonly number[] = [],
): SwingPoint[] {
  const resets = [...regimeResets].sort((a, b) => a - b)
  let resetPtr = 0
  let prevHighPrice: number | null = null
  let prevLowPrice: number | null = null

  return dominantSwings.map((swing): SwingPoint => {
    // Apply every regime boundary at or before this swing's candle. The
    // breach candle itself is the first candle of the new regime — a swing
    // whose pivot sits exactly on it belongs to the new regime.
    let crossedBoundary = false
    while (resetPtr < resets.length && resets[resetPtr] <= swing.index) {
      resetPtr++
      crossedBoundary = true
    }
    if (crossedBoundary) {
      prevHighPrice = null
      prevLowPrice = null
    }

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
