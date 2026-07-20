import { describe, it, expect } from 'vitest'
import { computeReplayStats } from '../statistics'
import type { TrackedTrade } from '../types'

function makeTrade(overrides: Partial<TrackedTrade> = {}): TrackedTrade {
  return {
    id: 'trade_1',
    direction: 'bullish',
    detectedAtIndex: 60,
    detectedTimestamp: 60_000,
    entryZoneLower: 49_800,
    entryZoneUpper: 50_200,
    entryMid: 50_000,
    stopLoss: 49_000,
    takeProfit: 52_000,
    riskRewardRatio: 2,
    confidence: 7,
    setupQuality: 'A',
    trend: 'bullish',
    outcome: 'open',
    exitIndex: null,
    exitPrice: null,
    exitTimestamp: null,
    mfe: 0,
    mae: 0,
    durationCandles: null,
    ...overrides,
  }
}

describe('computeReplayStats — empty', () => {
  it('returns zero stats for empty trade list', () => {
    const stats = computeReplayStats([])
    expect(stats.totalTrades).toBe(0)
    expect(stats.wins).toBe(0)
    expect(stats.losses).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.avgRR).toBe(0)
    expect(stats.avgHoldTimeCandles).toBe(0)
    expect(stats.avgConfidence).toBe(0)
    expect(stats.tpPercent).toBe(0)
    expect(stats.slPercent).toBe(0)
    expect(stats.openPercent).toBe(0)
  })
})

describe('computeReplayStats — win rate', () => {
  it('computes 100% win rate for all TP hits', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'tp_hit', exitIndex: 62, durationCandles: 2, riskRewardRatio: 2 }),
      makeTrade({ id: '2', outcome: 'tp_hit', exitIndex: 65, durationCandles: 5, riskRewardRatio: 3 }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.winRate).toBe(1)
    expect(stats.wins).toBe(2)
    expect(stats.losses).toBe(0)
    expect(stats.tpPercent).toBe(1)
    expect(stats.slPercent).toBe(0)
  })

  it('computes 0% win rate for all SL hits', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'sl_hit', exitIndex: 61, durationCandles: 1, riskRewardRatio: 2 }),
      makeTrade({ id: '2', outcome: 'sl_hit', exitIndex: 63, durationCandles: 3, riskRewardRatio: 2 }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.winRate).toBe(0)
    expect(stats.wins).toBe(0)
    expect(stats.losses).toBe(2)
    expect(stats.slPercent).toBe(1)
    expect(stats.tpPercent).toBe(0)
  })

  it('computes 50% win rate for mixed outcomes', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'tp_hit', exitIndex: 62, durationCandles: 2, riskRewardRatio: 2 }),
      makeTrade({ id: '2', outcome: 'sl_hit', exitIndex: 63, durationCandles: 3, riskRewardRatio: 2 }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.winRate).toBeCloseTo(0.5)
    expect(stats.openTrades).toBe(0)
    expect(stats.openPercent).toBe(0)
  })
})

describe('computeReplayStats — open trades', () => {
  it('counts open trades and excludes them from win rate', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'tp_hit', exitIndex: 62, durationCandles: 2, riskRewardRatio: 2 }),
      makeTrade({ id: '2', outcome: 'open' }),
      makeTrade({ id: '3', outcome: 'open' }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.openTrades).toBe(2)
    expect(stats.totalTrades).toBe(3)
    expect(stats.winRate).toBe(1) // 1 closed, 1 win
    expect(stats.openPercent).toBeCloseTo(2 / 3)
  })
})

describe('computeReplayStats — averages', () => {
  it('computes avgRR from closed trades with non-null rr', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'tp_hit', riskRewardRatio: 2, exitIndex: 61, durationCandles: 1 }),
      makeTrade({ id: '2', outcome: 'sl_hit', riskRewardRatio: 3, exitIndex: 62, durationCandles: 2 }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.avgRR).toBeCloseTo(2.5)
  })

  it('computes avgHoldTimeCandles from closed trades', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'tp_hit', durationCandles: 4, exitIndex: 64, riskRewardRatio: 2 }),
      makeTrade({ id: '2', outcome: 'sl_hit', durationCandles: 6, exitIndex: 66, riskRewardRatio: 2 }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.avgHoldTimeCandles).toBeCloseTo(5)
  })

  it('computes avgConfidence from all trades including open', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'tp_hit', confidence: 8, exitIndex: 61, durationCandles: 1 }),
      makeTrade({ id: '2', outcome: 'open',  confidence: 6 }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.avgConfidence).toBeCloseTo(7)
  })

  it('computes avgMFE and avgMAE from all trades', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'open', mfe: 200, mae: 100 }),
      makeTrade({ id: '2', outcome: 'open', mfe: 400, mae: 300 }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.avgMFE).toBeCloseTo(300)
    expect(stats.avgMAE).toBeCloseTo(200)
  })
})

describe('computeReplayStats — confidence buckets', () => {
  it('places trades into correct confidence buckets', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'tp_hit', confidence: 7.5, exitIndex: 61, durationCandles: 1 }),
      makeTrade({ id: '2', outcome: 'sl_hit', confidence: 7.5, exitIndex: 62, durationCandles: 2 }),
      makeTrade({ id: '3', outcome: 'tp_hit', confidence: 5.5, exitIndex: 63, durationCandles: 3 }),
    ]
    const stats = computeReplayStats(trades)
    const bucket78 = stats.confidenceBuckets.find(b => b.label === '7–8')!
    expect(bucket78.count).toBe(2)
    expect(bucket78.wins).toBe(1)
    expect(bucket78.winRate).toBeCloseTo(0.5)

    const bucket56 = stats.confidenceBuckets.find(b => b.label === '5–6')!
    expect(bucket56.count).toBe(1)
    expect(bucket56.wins).toBe(1)
    expect(bucket56.winRate).toBe(1)
  })

  it('excludes open trades from confidence bucket counts', () => {
    const trades = [
      makeTrade({ id: '1', outcome: 'open', confidence: 7.5 }),
    ]
    const stats = computeReplayStats(trades)
    const bucket78 = stats.confidenceBuckets.find(b => b.label === '7–8')!
    expect(bucket78.count).toBe(0)
  })
})

describe('computeReplayStats — quality distribution', () => {
  it('counts setup quality occurrences across all trades', () => {
    const trades = [
      makeTrade({ id: '1', setupQuality: 'A', outcome: 'open' }),
      makeTrade({ id: '2', setupQuality: 'A', outcome: 'open' }),
      makeTrade({ id: '3', setupQuality: 'B', outcome: 'open' }),
    ]
    const stats = computeReplayStats(trades)
    expect(stats.qualityDistribution['A']).toBe(2)
    expect(stats.qualityDistribution['B']).toBe(1)
  })
})
