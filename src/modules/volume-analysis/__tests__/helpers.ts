import type { Candle } from '../../binance/types'
import type { IndicatorResult } from '../../indicators/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { SupportResistanceResult } from '../../support-resistance/types'

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

export function flatCandles(count: number, price: number, volume = 1000): Candle[] {
  return Array.from({ length: count }, (_, i) =>
    candle({ openTime: i * 1000, close: price, high: price, low: price, volume }),
  )
}

export function emptyIndicators(overrides: Partial<IndicatorResult> = {}): IndicatorResult {
  return {
    ema20: null,
    ema50: null,
    ema100: null,
    ema200: null,
    sma20: null,
    sma50: null,
    sma200: null,
    rsi: null,
    macd: null,
    atr: null,
    atrPercent: null,
    adx: null,
    vwap: 0,
    bollingerBands: null,
    stochRsi: null,
    obv: 0,
    mfi: null,
    cci: null,
    volumeMA: null,
    ...overrides,
  }
}

export function emptyStructure(): MarketStructureResult {
  return {
    trend: 'ranging',
    strength: 'weak',
    confidence: 0,
    structure: { higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 },
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

export function emptySupportResistance(): SupportResistanceResult {
  return {
    zones: [],
    activeSupport: [],
    activeResistance: [],
    nearestSupport: null,
    nearestResistance: null,
    currentZone: null,
    evidence: [],
  }
}
