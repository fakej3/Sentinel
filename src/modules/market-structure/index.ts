import type { Candle } from '../binance'
import type { MarketStructureConfig, MarketStructureResult } from './types'
import { DEFAULT_CONFIG } from './config'
import { detectRawSwings, filterDominantSwings } from './swings'
import { labelSwings } from './labels'
import { countStructure, determineTrend } from './trend'
import { detectBosChoch } from './bos-choch'
import { detectConsolidation } from './consolidation'
import { detectBreakout } from './breakout'
import { detectPullback } from './pullback'
import { computeConfidence } from './confidence'
import { buildEvidence } from './evidence'

const EMPTY_RESULT: MarketStructureResult = {
  trend: 'ranging',
  strength: 'weak',
  confidence: 0,
  structure: {
    higherHighs: 0,
    higherLows: 0,
    lowerHighs: 0,
    lowerLows: 0,
    equalHighs: 0,
    equalLows: 0,
  },
  bos: { detected: false, events: [], last: null },
  choch: { detected: false, events: [], last: null },
  pullback: { detected: false, depth: null },
  consolidation: {
    detected: false,
    rangeHigh: null,
    rangeLow: null,
    rangePercent: null,
    barsInRange: 0,
  },
  breakout: { confirmed: false, failed: false, level: null, direction: null },
  swings: [],
  events: [],
  evidence: ['Insufficient data for market structure analysis'],
}

/**
 * Computes the full market structure analysis for a candle series.
 *
 * Processing pipeline:
 *   1. detectRawSwings       — find all pivot highs and lows
 *   2. filterDominantSwings  — collapse consecutive same-type swings into
 *                              the most extreme (alternating zigzag)
 *   3. labelSwings           — classify each swing as HH/HL/LH/LL/EH/EL
 *   4. countStructure        — aggregate counts for the full history
 *   5. determineTrend        — direction + strength from the recent window
 *   6. detectBosChoch        — scan candles for BOS and CHOCH events
 *   7. detectConsolidation   — check for tight range in recent swings
 *   8. detectBreakout        — check if current price broke out of the range
 *   9. detectPullback        — check for pullback after last BOS
 *  10. computeConfidence     — 0–100 evidence alignment score
 *  11. buildEvidence         — human-readable explanation strings
 *
 * Given the same candle array and config, the function always returns the
 * same result. No randomness, no AI, no stateful side effects.
 *
 * Returns the empty result object when fewer than (swingLookback×2 + 1)
 * candles are provided.
 */
export function computeMarketStructure(
  candles: Candle[],
  config: Partial<MarketStructureConfig> = {},
): MarketStructureResult {
  const cfg: MarketStructureConfig = { ...DEFAULT_CONFIG, ...config }

  const minCandles = cfg.swingLookback * 2 + 1
  if (candles.length < minCandles) {
    return { ...EMPTY_RESULT }
  }

  // Pipeline
  const rawSwings = detectRawSwings(candles, cfg)
  const dominantSwings = filterDominantSwings(rawSwings)
  const labeledSwings = labelSwings(dominantSwings, cfg)
  const structure = countStructure(labeledSwings)
  const { direction: trend, strength } = determineTrend(labeledSwings, cfg)
  const allEvents = detectBosChoch(candles, dominantSwings, cfg)
  const bosEvents = allEvents.filter(e => e.type === 'BOS')
  const chochEvents = allEvents.filter(e => e.type === 'CHOCH')
  const consolidation = detectConsolidation(labeledSwings, cfg)
  const breakout = detectBreakout(candles, consolidation, cfg)
  const pullback = detectPullback(candles, labeledSwings, bosEvents)
  const confidence = computeConfidence(
    trend, strength, labeledSwings, bosEvents, chochEvents, consolidation,
  )
  const evidence = buildEvidence(
    trend, strength, labeledSwings, bosEvents, chochEvents,
    consolidation, breakout, pullback,
  )

  return {
    trend,
    strength,
    confidence,
    structure,
    bos: {
      detected: bosEvents.length > 0,
      events: bosEvents,
      last: bosEvents[bosEvents.length - 1] ?? null,
    },
    choch: {
      detected: chochEvents.length > 0,
      events: chochEvents,
      last: chochEvents[chochEvents.length - 1] ?? null,
    },
    pullback,
    consolidation,
    breakout,
    swings: labeledSwings,
    events: allEvents,
    evidence,
  }
}
