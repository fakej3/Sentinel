import type { SwingPoint, ConsolidationResult, MarketStructureConfig } from './types'

/**
 * Detects consolidation from the labeled dominant swing list.
 *
 * A consolidation is declared when ALL of the following hold for the
 * last N dominant swings (N = config.consolidationSwings):
 *
 *   1. None of the N swings carry a HH or LL label.
 *      (The market is not making new structural extremes.)
 *
 *   2. The high-low range of those N swings satisfies:
 *        (max swing-high − min swing-low) / min swing-low × 100
 *        ≤ config.consolidationThreshold (%)
 *
 * These rules come directly from ENGINE_RULES.md §2 Consolidation.
 *
 * Returns detected=false (with nulls) when:
 *   - Fewer than consolidationSwings dominant swings exist.
 *   - A new extreme (HH or LL) exists within the window.
 *   - The price range of the window exceeds the threshold.
 *   - No swing highs or no swing lows are present in the window
 *     (needed to compute a meaningful range).
 */
export function detectConsolidation(
  labeledSwings: SwingPoint[],
  config: MarketStructureConfig,
): ConsolidationResult {
  const { consolidationSwings, consolidationThreshold } = config

  const NOT_CONSOLIDATING: ConsolidationResult = {
    detected: false,
    rangeHigh: null,
    rangeLow: null,
    rangePercent: null,
    barsInRange: 0,
  }

  if (labeledSwings.length < consolidationSwings) return NOT_CONSOLIDATING

  const recent = labeledSwings.slice(-consolidationSwings)

  // Rule 1: no new structural extremes
  if (recent.some(s => s.label === 'HH' || s.label === 'LL')) {
    return NOT_CONSOLIDATING
  }

  const recentHighs = recent.filter(s => s.type === 'high').map(s => s.price)
  const recentLows = recent.filter(s => s.type === 'low').map(s => s.price)

  if (recentHighs.length === 0 || recentLows.length === 0) {
    return NOT_CONSOLIDATING
  }

  const rangeHigh = Math.max(...recentHighs)
  const rangeLow = Math.min(...recentLows)
  const rangePercent = (rangeHigh - rangeLow) / rangeLow * 100

  // Rule 2: range is tight enough
  if (rangePercent > consolidationThreshold) {
    return NOT_CONSOLIDATING
  }

  const barsInRange = recent[recent.length - 1].index - recent[0].index + 1

  return { detected: true, rangeHigh, rangeLow, rangePercent, barsInRange }
}
