import { describe, it, expect } from 'vitest'
import { simulateOutcome } from '../outcome'
import type { TradePlan } from '../../pipeline/types'
import type { Candle } from '../../binance/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    entryZone:       { lower: 100, upper: 102 }, // midpoint = 101
    invalidationLevel: 98,
    targetLevel:     110,
    riskRewardRatio: 3.0,
    setupQuality:    'excellent',
    setupQualityReason: 'test',
    actionable:      true,
    patienceMessage: 'test',
    ...overrides,
  }
}

function makeCandle(low: number, high: number): Candle {
  const mid = (low + high) / 2
  return {
    openTime: 0, closeTime: 1,
    open: mid, high, low, close: mid,
    volume: 100, quoteVolume: 10000,
    trades: 10, takerBuyVolume: 50, takerSellVolume: 50,
  }
}

// ── No-trade cases ────────────────────────────────────────────────────────────

describe('simulateOutcome — no_trade', () => {
  it('returns no_trade when plan is not actionable', () => {
    const r = simulateOutcome('id', makePlan({ actionable: false }), 'bullish', [makeCandle(99, 115)])
    expect(r.result).toBe('no_trade')
    expect(r.entryPrice).toBeNull()
    expect(r.actualRR).toBeNull()
  })

  it('returns no_trade when direction is neutral', () => {
    const r = simulateOutcome('id', makePlan(), 'neutral', [makeCandle(99, 115)])
    expect(r.result).toBe('no_trade')
  })

  it('returns no_trade when entryZone is null', () => {
    const r = simulateOutcome('id', makePlan({ entryZone: null }), 'bullish', [makeCandle(99, 115)])
    expect(r.result).toBe('no_trade')
  })

  it('returns no_trade when invalidationLevel is null', () => {
    const r = simulateOutcome('id', makePlan({ invalidationLevel: null }), 'bullish', [makeCandle(99, 115)])
    expect(r.result).toBe('no_trade')
  })

  it('returns no_trade when targetLevel is null', () => {
    const r = simulateOutcome('id', makePlan({ targetLevel: null }), 'bullish', [makeCandle(99, 115)])
    expect(r.result).toBe('no_trade')
  })

  it('no_trade has zero MFE and MAE', () => {
    const r = simulateOutcome('id', makePlan({ actionable: false }), 'bullish', [makeCandle(90, 120)])
    expect(r.mfe).toBe(0)
    expect(r.mae).toBe(0)
  })
})

// ── Bullish TP hit ────────────────────────────────────────────────────────────

describe('simulateOutcome — bullish TP hit', () => {
  it('detects TP on 2nd candle', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [
      makeCandle(99, 108), // high=108 < TP=110
      makeCandle(100, 112), // high=112 >= TP=110 → hit
    ])
    expect(r.result).toBe('tp_hit')
    expect(r.barsToOutcome).toBe(2)
    expect(r.actualRR).toBe(3.0)
  })

  it('detects TP on first candle', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [makeCandle(100, 115)])
    expect(r.result).toBe('tp_hit')
    expect(r.barsToOutcome).toBe(1)
  })

  it('entry level exactly at TP boundary triggers hit', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [makeCandle(100, 110)])
    expect(r.result).toBe('tp_hit')
  })
})

// ── Bullish SL hit ────────────────────────────────────────────────────────────

describe('simulateOutcome — bullish SL hit', () => {
  it('detects SL on 2nd candle', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [
      makeCandle(99, 107), // low=99 > SL=98 → no hit
      makeCandle(97, 106), // low=97 <= SL=98 → SL hit
    ])
    expect(r.result).toBe('sl_hit')
    expect(r.barsToOutcome).toBe(2)
    expect(r.actualRR).toBe(-1.0)
  })

  it('SL exactly at invalidationLevel triggers hit', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [makeCandle(98, 105)])
    expect(r.result).toBe('sl_hit')
  })

  it('assumes SL first when both SL and TP touched in same candle', () => {
    // low=97 <= SL=98 AND high=115 >= TP=110 → SL wins (conservative)
    const r = simulateOutcome('id', makePlan(), 'bullish', [makeCandle(97, 115)])
    expect(r.result).toBe('sl_hit')
  })
})

// ── Neither ───────────────────────────────────────────────────────────────────

describe('simulateOutcome — neither', () => {
  it('returns neither when no forward candles provided', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [])
    expect(r.result).toBe('neither')
    expect(r.barsToOutcome).toBeNull()
    expect(r.actualRR).toBeNull()
  })

  it('returns neither when price stays between SL and TP', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [
      makeCandle(99, 108),
      makeCandle(100, 109),
    ])
    expect(r.result).toBe('neither')
  })
})

// ── MFE and MAE (bullish) ─────────────────────────────────────────────────────

describe('simulateOutcome — MFE / MAE (bullish)', () => {
  it('computes MFE as max favorable move from entry midpoint', () => {
    // entry midpoint = 101; candle high=106 → MFE = 6-1=5
    const r = simulateOutcome('id', makePlan(), 'bullish', [
      makeCandle(100, 106),
      makeCandle(101, 104), // lower high than previous
    ])
    expect(r.mfe).toBeCloseTo(5, 2)
  })

  it('computes MAE as max adverse move from entry midpoint', () => {
    // entry midpoint = 101; candle low=99 → MAE = 101-99 = 2
    const r = simulateOutcome('id', makePlan(), 'bullish', [
      makeCandle(99, 105),
      makeCandle(100, 107),
    ])
    expect(r.mae).toBeCloseTo(2, 2)
  })

  it('mfePct and maePct are percentages of entry price', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [makeCandle(100, 106)])
    expect(r.mfePct).toBeCloseTo((5 / 101) * 100, 1)
    expect(r.maePct).toBeCloseTo((1 / 101) * 100, 1)
  })
})

// ── Bearish ───────────────────────────────────────────────────────────────────

describe('simulateOutcome — bearish', () => {
  const bearishPlan = makePlan({
    entryZone:        { lower: 100, upper: 102 }, // midpoint = 101
    invalidationLevel: 105, // SL above entry for bearish
    targetLevel:      90,  // TP below entry for bearish
    riskRewardRatio:  2.75,
  })

  it('TP hit for bearish when low <= targetLevel', () => {
    const r = simulateOutcome('id', bearishPlan, 'bearish', [
      makeCandle(94, 103), // low=94 > TP=90
      makeCandle(88, 102), // low=88 <= TP=90 → TP hit
    ])
    expect(r.result).toBe('tp_hit')
    expect(r.barsToOutcome).toBe(2)
    expect(r.actualRR).toBe(2.75)
  })

  it('SL hit for bearish when high >= invalidationLevel', () => {
    const r = simulateOutcome('id', bearishPlan, 'bearish', [
      makeCandle(94, 103), // high=103 < SL=105
      makeCandle(95, 107), // high=107 >= SL=105 → SL hit
    ])
    expect(r.result).toBe('sl_hit')
    expect(r.barsToOutcome).toBe(2)
    expect(r.actualRR).toBe(-1.0)
  })

  it('MFE for bearish is max downside from entry', () => {
    // entry = 101; low = 96 → MFE = 101-96 = 5
    const r = simulateOutcome('id', bearishPlan, 'bearish', [makeCandle(96, 103)])
    expect(r.mfe).toBeCloseTo(5, 2)
  })
})

// ── Entry price stored correctly ──────────────────────────────────────────────

describe('simulateOutcome — stored levels', () => {
  it('entryPrice is midpoint of entryZone', () => {
    const r = simulateOutcome('id', makePlan({ entryZone: { lower: 100, upper: 104 } }), 'bullish', [])
    expect(r.entryPrice).toBeCloseTo(102)
  })

  it('stopPrice matches invalidationLevel', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [])
    expect(r.stopPrice).toBe(98)
  })

  it('targetPrice matches targetLevel', () => {
    const r = simulateOutcome('id', makePlan(), 'bullish', [])
    expect(r.targetPrice).toBe(110)
  })

  it('snapshotId is echoed in result', () => {
    const r = simulateOutcome('my-snap-id', makePlan(), 'bullish', [])
    expect(r.snapshotId).toBe('my-snap-id')
  })
})
