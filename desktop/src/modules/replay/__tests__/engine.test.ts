import { describe, it, expect, beforeEach } from 'vitest'
import { ReplayEngine } from '../engine'
import { REPLAY_MIN_CANDLES } from '../types'
import { makeCandles } from './helpers'

const SYMBOL   = 'BTCUSDT'
const INTERVAL = '1h' as const

describe('ReplayEngine — constructor', () => {
  it('throws when candle count is below minimum', () => {
    expect(() => new ReplayEngine({
      symbol: SYMBOL, interval: INTERVAL,
      candles: makeCandles(REPLAY_MIN_CANDLES - 1),
    })).toThrow(/at least/)
  })

  it('accepts exactly REPLAY_MIN_CANDLES candles', () => {
    expect(() => new ReplayEngine({
      symbol: SYMBOL, interval: INTERVAL,
      candles: makeCandles(REPLAY_MIN_CANDLES),
    })).not.toThrow()
  })
})

describe('ReplayEngine — index bounds', () => {
  const TOTAL = 100
  let engine: ReplayEngine

  beforeEach(() => {
    engine = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(TOTAL) })
  })

  it('starts at minIndex (REPLAY_MIN_CANDLES - 1)', () => {
    expect(engine.currentIndex).toBe(REPLAY_MIN_CANDLES - 1)
  })

  it('minIndex is REPLAY_MIN_CANDLES - 1', () => {
    expect(engine.minIndex).toBe(REPLAY_MIN_CANDLES - 1)
  })

  it('maxIndex is totalCandles - 1', () => {
    expect(engine.maxIndex).toBe(TOTAL - 1)
  })

  it('isAtStart is true initially', () => {
    expect(engine.isAtStart).toBe(true)
  })

  it('isAtEnd is false initially', () => {
    expect(engine.isAtEnd).toBe(false)
  })

  it('respects startIndex option', () => {
    const e = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(TOTAL), startIndex: 70 })
    expect(e.currentIndex).toBe(70)
  })

  it('clamps startIndex below minIndex', () => {
    const e = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(TOTAL), startIndex: 0 })
    expect(e.currentIndex).toBe(engine.minIndex)
  })

  it('clamps startIndex above maxIndex', () => {
    const e = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(TOTAL), startIndex: 999 })
    expect(e.currentIndex).toBe(TOTAL - 1)
  })
})

describe('ReplayEngine — no look-ahead guarantee', () => {
  it('currentFrame only exposes candles up to current index', async () => {
    const candles = makeCandles(100)
    const engine  = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles, startIndex: 60 })
    const frame   = await engine.currentFrame()

    expect(frame.candles).toHaveLength(61)
    expect(frame.candles[frame.candles.length - 1].openTime).toBe(candles[60].openTime)
  })

  it('stepForward exposes exactly one more candle than before', async () => {
    const engine = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(100) })
    const before  = await engine.currentFrame()
    const after   = await engine.stepForward()

    expect(after).not.toBeNull()
    expect(after!.candles).toHaveLength(before.candles.length + 1)
  })

  it('candle timestamps are strictly non-decreasing', async () => {
    const candles = makeCandles(80)
    const engine  = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles })
    for (let i = 0; i < 10; i++) {
      const frame = await engine.stepForward()
      if (!frame) break
      const times = frame.candles.map(c => c.openTime)
      for (let j = 1; j < times.length; j++) {
        expect(times[j]).toBeGreaterThanOrEqual(times[j - 1])
      }
    }
  })
})

describe('ReplayEngine — frame content', () => {
  it('currentFrame returns a valid PipelineResult', async () => {
    const engine = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(80) })
    const frame  = await engine.currentFrame()

    expect(frame.result.indicators).toBeDefined()
    expect(frame.result.marketStructure).toBeDefined()
    expect(frame.result.confidence).toBeDefined()
    expect(frame.result.tradePlan).toBeDefined()
    expect(typeof frame.result.confidence.score).toBe('number')
    expect(frame.result.confidence.score).toBeGreaterThanOrEqual(0)
    expect(frame.result.confidence.score).toBeLessThanOrEqual(10)
  })

  it('frame index matches engine currentIndex', async () => {
    const engine = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(80) })
    await engine.jumpToIndex(65)
    const frame = await engine.currentFrame()
    expect(frame.index).toBe(65)
    expect(engine.currentIndex).toBe(65)
  })

  it('frame candleTimestamp matches the openTime of the last visible candle', async () => {
    const candles = makeCandles(80)
    const engine  = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles, startIndex: 65 })
    const frame   = await engine.currentFrame()
    expect(frame.candleTimestamp).toBe(candles[65].openTime)
  })
})

describe('ReplayEngine — navigation', () => {
  let engine: ReplayEngine
  const TOTAL = 100

  beforeEach(() => {
    engine = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(TOTAL) })
  })

  it('stepBack returns null at start', async () => {
    const result = await engine.stepBack()
    expect(result).toBeNull()
    expect(engine.currentIndex).toBe(engine.minIndex)
  })

  it('stepForward returns null at end', async () => {
    await engine.jumpToIndex(TOTAL - 1)
    const result = await engine.stepForward()
    expect(result).toBeNull()
    expect(engine.currentIndex).toBe(TOTAL - 1)
    expect(engine.isAtEnd).toBe(true)
  })

  it('stepForward then stepBack returns to same index', async () => {
    const idx = engine.currentIndex
    await engine.stepForward()
    await engine.stepBack()
    expect(engine.currentIndex).toBe(idx)
  })

  it('jumpForward clamps to maxIndex', async () => {
    await engine.jumpForward(9999)
    expect(engine.currentIndex).toBe(TOTAL - 1)
    expect(engine.isAtEnd).toBe(true)
  })

  it('jumpBack clamps to minIndex', async () => {
    await engine.jumpToIndex(TOTAL - 1)
    await engine.jumpBack(9999)
    expect(engine.currentIndex).toBe(engine.minIndex)
    expect(engine.isAtStart).toBe(true)
  })

  it('jumpToIndex clamps within valid range', async () => {
    await engine.jumpToIndex(-99)
    expect(engine.currentIndex).toBe(engine.minIndex)
    await engine.jumpToIndex(9999)
    expect(engine.currentIndex).toBe(TOTAL - 1)
  })

  it('restart goes back to minIndex', async () => {
    await engine.jumpToIndex(80)
    await engine.restart()
    expect(engine.currentIndex).toBe(engine.minIndex)
    expect(engine.isAtStart).toBe(true)
  })

  it('jumpToTimestamp finds nearest candle not after timestamp', async () => {
    const candles = makeCandles(TOTAL)
    const e = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles })
    await e.jumpToTimestamp(candles[65].openTime)
    expect(e.currentIndex).toBe(65)
  })

  it('jumpToTimestamp with timestamp before first candle lands at minIndex', async () => {
    const candles = makeCandles(TOTAL)
    const e = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles })
    await e.jumpToTimestamp(-1)
    expect(e.currentIndex).toBe(e.minIndex)
  })
})

describe('ReplayEngine — progress', () => {
  it('progress is between 0 and 1', async () => {
    const engine = new ReplayEngine({ symbol: SYMBOL, interval: INTERVAL, candles: makeCandles(100) })
    expect(engine.progress).toBeGreaterThanOrEqual(0)
    expect(engine.progress).toBeLessThanOrEqual(1)
    await engine.jumpToIndex(100 - 1)
    expect(engine.progress).toBe(1)
  })
})
