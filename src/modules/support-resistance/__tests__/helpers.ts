import type { Candle } from '../../binance/types'
import type { MarketStructureResult, SwingPoint } from '../../market-structure'

export function candle(overrides: Partial<Candle> & { close: number }): Candle {
  const c = overrides.close
  return {
    openTime: overrides.openTime ?? 0,
    closeTime: overrides.closeTime ?? 0,
    open: overrides.open ?? c,
    high: overrides.high ?? c,
    low: overrides.low ?? c,
    close: c,
    volume: overrides.volume ?? 1000,
    quoteVolume: overrides.quoteVolume ?? c * 1000,
    trades: overrides.trades ?? 100,
    takerBuyVolume: overrides.takerBuyVolume ?? 500,
    takerSellVolume: overrides.takerSellVolume ?? 500,
  }
}

/** Build a flat candle series at `price` with high/low as specified */
export function flatCandles(count: number, price: number): Candle[] {
  return Array.from({ length: count }, (_, i) =>
    candle({ openTime: i * 1000, close: price, high: price, low: price }),
  )
}

/** Canonical empty MarketStructureResult */
export function emptyStructure(): MarketStructureResult {
  const emptyCounts = { higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 }
  return {
    trend: 'ranging',
    strength: 'weak',
    confidence: 0,
    structure: { ...emptyCounts },
    recentStructure: { ...emptyCounts },
    bos: { detected: false, events: [], last: null },
    choch: { detected: false, events: [], last: null },
    pullback: { detected: false, depth: null },
    consolidation: { detected: false, rangeHigh: null, rangeLow: null, rangePercent: null, barsInRange: 0 },
    breakout: { confirmed: false, failed: false, level: null, direction: null },
    swings: [],
    events: [],
    evidence: [],
  }
}

export function swing(overrides: {
  index: number
  price: number
  type: 'high' | 'low'
  timestamp?: number
  label?: SwingPoint['label']
}): SwingPoint {
  return {
    index: overrides.index,
    timestamp: overrides.timestamp ?? overrides.index * 1000,
    price: overrides.price,
    type: overrides.type,
    label: overrides.label ?? null,
  }
}

export function withSwings(swings: SwingPoint[]): MarketStructureResult {
  return { ...emptyStructure(), swings }
}
