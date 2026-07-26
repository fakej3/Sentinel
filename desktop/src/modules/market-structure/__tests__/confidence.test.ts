import { describe, it, expect } from 'vitest'
import { computeConfidence } from '../confidence'
import { DEFAULT_CONFIG } from '../config'
import type { SwingPoint, StructureEvent, ConsolidationResult, SwingLabel } from '../types'

const NO_CONSOLIDATION: ConsolidationResult = {
  detected: false, rangeHigh: null, rangeLow: null, rangePercent: null, barsInRange: 0,
}

function swing(index: number, label: SwingLabel, type: 'high' | 'low' = 'high'): SwingPoint {
  return { index, confirmedIndex: index, timestamp: index * 1000, price: 100, type, label }
}

function event(index: number, direction: 'bullish' | 'bearish'): StructureEvent {
  return { type: 'BOS', index, timestamp: index * 1000, level: 100, direction }
}

function choch(index: number, direction: 'bullish' | 'bearish'): StructureEvent {
  return { type: 'CHOCH', index, timestamp: index * 1000, level: 100, direction }
}

// determineTrend and countRecentStructure both use slice(-(minSwingsForTrend * 2)).
const WINDOW = DEFAULT_CONFIG.minSwingsForTrend * 2   // 8

describe('computeConfidence — horizon consistency with determineTrend', () => {
  it('scores swings over exactly the trend window, ignoring older ones', () => {
    // WINDOW recent bullish swings, preceded by many bearish ones that the
    // trend determination never saw. Previously the hardcoded slice(-10)
    // reached past the 8-swing trend window and mixed those in.
    const older  = Array.from({ length: 12 }, (_, i) => swing(i, 'LL', 'low'))
    const recent = Array.from({ length: WINDOW }, (_, i) =>
      swing(100 + i, i % 2 === 0 ? 'HH' : 'HL', i % 2 === 0 ? 'high' : 'low'))

    const withOlder = computeConfidence('bullish', 'strong', [...older, ...recent], [], [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const alone     = computeConfidence('bullish', 'strong', recent,               [], [], NO_CONSOLIDATION, DEFAULT_CONFIG)

    // Identical: swings outside the trend window contribute nothing.
    expect(withOlder).toBe(alone)
  })

  it('ignores structural events that occurred before the trend horizon', () => {
    const recent = Array.from({ length: WINDOW }, (_, i) =>
      swing(100 + i, i % 2 === 0 ? 'HH' : 'HL', i % 2 === 0 ? 'high' : 'low'))

    // A CHoCH 400 candles in the past previously subtracted 20 raw points
    // (2.0 on the 0–10 scale) from TODAY's confidence.
    const staleChoch = choch(5, 'bearish')

    const withStale = computeConfidence('bullish', 'strong', recent, [], [staleChoch], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const without   = computeConfidence('bullish', 'strong', recent, [], [],           NO_CONSOLIDATION, DEFAULT_CONFIG)

    expect(withStale).toBe(without)
  })

  it('still counts structural events that fall INSIDE the trend horizon', () => {
    const recent = Array.from({ length: WINDOW }, (_, i) =>
      swing(100 + i, i % 2 === 0 ? 'HH' : 'HL', i % 2 === 0 ? 'high' : 'low'))

    // An in-horizon CHoCH must reduce confidence — the filter must not be a
    // blanket suppression.
    const liveChoch = choch(105, 'bearish')
    const withLive  = computeConfidence('bullish', 'strong', recent, [], [liveChoch], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const without   = computeConfidence('bullish', 'strong', recent, [], [],          NO_CONSOLIDATION, DEFAULT_CONFIG)

    expect(withLive).toBeLessThan(without)
  })

  it('in-horizon BOS raises confidence; out-of-horizon BOS does not', () => {
    const recent = Array.from({ length: WINDOW }, (_, i) =>
      swing(100 + i, i % 2 === 0 ? 'HH' : 'HL', i % 2 === 0 ? 'high' : 'low'))

    const base    = computeConfidence('bullish', 'weak', recent, [],                  [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const inHoriz = computeConfidence('bullish', 'weak', recent, [event(103, 'bullish')], [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const stale   = computeConfidence('bullish', 'weak', recent, [event(3,   'bullish')], [], NO_CONSOLIDATION, DEFAULT_CONFIG)

    expect(inHoriz).toBeGreaterThan(base)
    expect(stale).toBe(base)
  })

  it('ranging: only in-horizon BOS applies the structure-broken deduction', () => {
    const recent = Array.from({ length: WINDOW }, (_, i) =>
      swing(100 + i, i % 2 === 0 ? 'EH' : 'EL', i % 2 === 0 ? 'high' : 'low'))

    const base  = computeConfidence('ranging', 'weak', recent, [],                     [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const stale = computeConfidence('ranging', 'weak', recent, [event(2, 'bullish')],   [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const live  = computeConfidence('ranging', 'weak', recent, [event(104, 'bullish')], [], NO_CONSOLIDATION, DEFAULT_CONFIG)

    expect(stale).toBe(base)
    expect(live).toBeLessThan(base)
  })
})

describe('computeConfidence — bounds and determinism', () => {
  it('is always within [0, 10]', () => {
    const many = Array.from({ length: 40 }, (_, i) => swing(i, 'HH'))
    const chochs = Array.from({ length: 10 }, (_, i) => choch(i, 'bearish'))
    for (const t of ['bullish', 'bearish', 'ranging'] as const) {
      const v = computeConfidence(t, 'strong', many, [], chochs, NO_CONSOLIDATION, DEFAULT_CONFIG)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('handles an empty swing list without producing NaN', () => {
    const v = computeConfidence('bullish', 'weak', [], [event(1, 'bullish')], [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
  })

  it('is deterministic', () => {
    const recent = Array.from({ length: WINDOW }, (_, i) => swing(100 + i, 'HH'))
    const a = computeConfidence('bullish', 'strong', recent, [], [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    const b = computeConfidence('bullish', 'strong', recent, [], [], NO_CONSOLIDATION, DEFAULT_CONFIG)
    expect(a).toBe(b)
  })
})
