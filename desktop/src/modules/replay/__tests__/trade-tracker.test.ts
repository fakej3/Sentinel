import { describe, it, expect, beforeEach } from 'vitest'
import { TradeTracker } from '../trade-tracker'
import type { PipelineResult } from '../../pipeline/types'
import type { Candle } from '../../market/types'
import { makeCandles } from './helpers'

function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    openTime: 0, closeTime: 3_599_999,
    open: 50_000, high: 50_500, low: 49_500, close: 50_000,
    volume: 1_000, quoteVolume: 50_000_000, trades: 100,
    takerBuyVolume: 500, takerSellVolume: 500,
    ...overrides,
  }
}

function makePipelineResult(overrides: {
  actionable?: boolean
  entryLower?: number
  entryUpper?: number
  invalidation?: number | null
  target?: number | null
  confidence?: number
  setupQuality?: string
  trend?: string
} = {}): PipelineResult {
  const {
    actionable    = true,
    entryLower    = 49_800,
    entryUpper    = 50_200,
    invalidation  = 49_000,
    target        = 52_000,
    confidence    = 7,
    setupQuality  = 'A',
    trend         = 'bullish',
  } = overrides

  return {
    candles: makeCandles(50),
    indicators: {} as PipelineResult['indicators'],
    marketStructure: { trend } as PipelineResult['marketStructure'],
    supportResistance: {} as PipelineResult['supportResistance'],
    fibonacci: {} as PipelineResult['fibonacci'],
    volumeAnalysis: {} as PipelineResult['volumeAnalysis'],
    analysis: {} as PipelineResult['analysis'],
    validation: { passed: true, issues: [] },
    confidence: { score: confidence, label: 'Good', penalties: [], bonuses: [] } as PipelineResult['confidence'],
    generatedAnalysis: {} as PipelineResult['generatedAnalysis'],
    metadata: {} as PipelineResult['metadata'],
    tradePlan: {
      actionable,
      entryZone: actionable ? { lower: entryLower, upper: entryUpper } : null,
      invalidationLevel: invalidation,
      targetLevel: target,
      setupQuality,
    } as PipelineResult['tradePlan'],
  }
}

describe('TradeTracker — basic detection', () => {
  let tracker: TradeTracker

  beforeEach(() => {
    tracker = new TradeTracker()
  })

  it('detects a bullish setup when invalidation is below entry', () => {
    const candle = makeCandle()
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 52_000 })
    const { newTrade } = tracker.processFrame(60, result, candle)
    expect(newTrade).not.toBeNull()
    expect(newTrade!.direction).toBe('bullish')
  })

  it('detects a bearish setup when invalidation is above entry', () => {
    const candle = makeCandle()
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 51_500, target: 48_000 })
    const { newTrade } = tracker.processFrame(60, result, candle)
    expect(newTrade).not.toBeNull()
    expect(newTrade!.direction).toBe('bearish')
  })

  it('returns null newTrade when plan is not actionable', () => {
    const candle = makeCandle()
    const result = makePipelineResult({ actionable: false })
    const { newTrade } = tracker.processFrame(60, result, candle)
    expect(newTrade).toBeNull()
  })

  it('returns null newTrade when invalidation is null', () => {
    const candle = makeCandle()
    const result = makePipelineResult({ invalidation: null })
    const { newTrade } = tracker.processFrame(60, result, candle)
    expect(newTrade).toBeNull()
  })

  it('returns null newTrade when target is null', () => {
    const candle = makeCandle()
    const result = makePipelineResult({ target: null })
    const { newTrade } = tracker.processFrame(60, result, candle)
    expect(newTrade).toBeNull()
  })
})

describe('TradeTracker — deduplication', () => {
  let tracker: TradeTracker

  beforeEach(() => {
    tracker = new TradeTracker()
  })

  it('does not record the same setup twice across consecutive frames', () => {
    const candle = makeCandle()
    const result = makePipelineResult()
    tracker.processFrame(60, result, candle)
    const { newTrade } = tracker.processFrame(61, result, candle)
    expect(newTrade).toBeNull()
  })

  it('records a new setup when direction changes', () => {
    const candle = makeCandle()
    const bullish = makePipelineResult({ invalidation: 49_000, target: 52_000 })
    const bearish = makePipelineResult({ invalidation: 51_500, target: 48_000 })
    tracker.processFrame(60, bullish, candle)
    const { newTrade } = tracker.processFrame(61, bearish, candle)
    expect(newTrade).not.toBeNull()
    expect(newTrade!.direction).toBe('bearish')
  })

  it('records a new setup when entry zone shifts by more than 0.2%', () => {
    const candle = makeCandle()
    const result1 = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200 })
    const result2 = makePipelineResult({ entryLower: 50_200, entryUpper: 50_600 })
    tracker.processFrame(60, result1, candle)
    const { newTrade } = tracker.processFrame(61, result2, candle)
    expect(newTrade).not.toBeNull()
  })

  it('does not record a new setup when entry zone shifts by less than 0.2%', () => {
    const candle = makeCandle()
    // Entry mid at 50_000; shift to 50_005 is 0.01% — below threshold
    const result1 = makePipelineResult({ entryLower: 49_900, entryUpper: 50_100 })
    const result2 = makePipelineResult({ entryLower: 49_905, entryUpper: 50_105 })
    tracker.processFrame(60, result1, candle)
    const { newTrade } = tracker.processFrame(61, result2, candle)
    expect(newTrade).toBeNull()
  })
})

describe('TradeTracker — TP/SL detection', () => {
  it('marks a bullish trade as tp_hit when high reaches takeProfit', () => {
    const tracker = new TradeTracker()
    const entry = makeCandle({ openTime: 60_000 })
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 51_000 })
    tracker.processFrame(60, result, entry)

    const tpCandle = makeCandle({ openTime: 61_000, high: 51_100, low: 50_100 })
    const neutral  = makePipelineResult({ actionable: false })
    const { trades } = tracker.processFrame(61, neutral, tpCandle)

    const trade = trades.find(t => t.outcome === 'tp_hit')
    expect(trade).toBeDefined()
    expect(trade!.exitPrice).toBe(51_000)
  })

  it('marks a bullish trade as sl_hit when low reaches stopLoss', () => {
    const tracker = new TradeTracker()
    const entry = makeCandle({ openTime: 60_000 })
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 51_000 })
    tracker.processFrame(60, result, entry)

    const slCandle = makeCandle({ openTime: 61_000, high: 50_100, low: 48_900 })
    const neutral  = makePipelineResult({ actionable: false })
    const { trades } = tracker.processFrame(61, neutral, slCandle)

    const trade = trades.find(t => t.outcome === 'sl_hit')
    expect(trade).toBeDefined()
    expect(trade!.exitPrice).toBe(49_000)
  })

  it('marks a bearish trade as tp_hit when low reaches takeProfit', () => {
    const tracker = new TradeTracker()
    const entry = makeCandle({ openTime: 60_000 })
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 51_500, target: 48_000 })
    tracker.processFrame(60, result, entry)

    const tpCandle = makeCandle({ openTime: 61_000, high: 50_100, low: 47_900 })
    const neutral  = makePipelineResult({ actionable: false })
    const { trades } = tracker.processFrame(61, neutral, tpCandle)

    const trade = trades.find(t => t.outcome === 'tp_hit')
    expect(trade).toBeDefined()
    expect(trade!.exitPrice).toBe(48_000)
  })

  it('leaves trade open when neither TP nor SL is reached', () => {
    const tracker = new TradeTracker()
    const entry = makeCandle({ openTime: 60_000 })
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 51_000 })
    tracker.processFrame(60, result, entry)

    const midCandle = makeCandle({ high: 50_500, low: 49_600 })
    const neutral   = makePipelineResult({ actionable: false })
    const { trades } = tracker.processFrame(61, neutral, midCandle)
    expect(trades[0].outcome).toBe('open')
  })
})

describe('TradeTracker — MFE/MAE tracking', () => {
  it('accumulates MFE for a bullish trade', () => {
    const tracker = new TradeTracker()
    const entry  = makeCandle({ openTime: 60_000 })
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 53_000 })
    tracker.processFrame(60, result, entry)

    const upCandle = makeCandle({ high: 50_800, low: 50_100 })
    const neutral  = makePipelineResult({ actionable: false })
    const { trades } = tracker.processFrame(61, neutral, upCandle)

    // entryMid = (49_800 + 50_200) / 2 = 50_000
    // favorable = high - entryMid = 50_800 - 50_000 = 800
    expect(trades[0].mfe).toBeGreaterThan(0)
  })

  it('accumulates MAE for a bullish trade', () => {
    const tracker = new TradeTracker()
    const entry  = makeCandle({ openTime: 60_000 })
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 53_000 })
    tracker.processFrame(60, result, entry)

    const downCandle = makeCandle({ high: 50_200, low: 49_600 })
    const neutral    = makePipelineResult({ actionable: false })
    const { trades } = tracker.processFrame(61, neutral, downCandle)

    // adverse = entryMid - low = 50_000 - 49_600 = 400
    expect(trades[0].mae).toBeGreaterThan(0)
  })
})

describe('TradeTracker — RR and duration', () => {
  it('computes riskRewardRatio correctly', () => {
    const tracker = new TradeTracker()
    const entry  = makeCandle({ openTime: 60_000 })
    // entry mid = 50_000; stop = 49_000 (risk = 1000); target = 53_000 (reward = 3000)
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 53_000 })
    const { newTrade } = tracker.processFrame(60, result, entry)
    expect(newTrade!.riskRewardRatio).toBeCloseTo(3, 1)
  })

  it('records durationCandles after close', () => {
    const tracker = new TradeTracker()
    const entry  = makeCandle({ openTime: 60_000 })
    const result = makePipelineResult({ entryLower: 49_800, entryUpper: 50_200, invalidation: 49_000, target: 51_000 })
    tracker.processFrame(60, result, entry)

    const neutral  = makePipelineResult({ actionable: false })
    const neutral2 = makePipelineResult({ actionable: false })
    tracker.processFrame(61, neutral, makeCandle({ high: 50_600, low: 49_700 }))
    const { trades } = tracker.processFrame(62, neutral2, makeCandle({ high: 51_100, low: 50_200 }))

    const closed = trades.find(t => t.outcome === 'tp_hit')
    expect(closed!.durationCandles).toBe(2) // closed at index 62, opened at index 60
  })
})

describe('TradeTracker — reset', () => {
  it('clears all trades and resets counter on reset()', () => {
    const tracker = new TradeTracker()
    const candle  = makeCandle()
    const result  = makePipelineResult()
    tracker.processFrame(60, result, candle)
    expect(tracker.getTrades()).toHaveLength(1)

    tracker.reset()
    expect(tracker.getTrades()).toHaveLength(0)
  })
})
