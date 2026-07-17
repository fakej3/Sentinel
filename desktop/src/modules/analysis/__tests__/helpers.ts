import type { Candle, MarketData, Ticker24h, Timeframe } from '../../binance/types'
import type { IndicatorResult, MACDResult, ADXResult, BollingerResult, StochRSIResult } from '../../indicators/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { PriceZone, SupportResistanceResult } from '../../support-resistance/types'
import type { VolumeAnalysisResult } from '../../volume-analysis/types'

// ─── Candle factory ───────────────────────────────────────────────────────────

export function candle(
  close: number,
  opts: { high?: number; low?: number; volume?: number } = {},
  index = 0,
): Candle {
  const high = opts.high ?? close + 0.5
  const low = opts.low ?? close - 0.5
  const volume = opts.volume ?? 1000
  return {
    openTime: index * 3_600_000,
    closeTime: index * 3_600_000 + 3_599_999,
    open: close,
    high,
    low,
    close,
    volume,
    quoteVolume: close * volume,
    trades: 10,
    takerBuyVolume: volume * 0.5,
    takerSellVolume: volume * 0.5,
  }
}

// ─── MarketData factory ───────────────────────────────────────────────────────

export function marketData(
  price: number,
  opts: {
    symbol?: string
    timeframe?: Timeframe
    change24hPercent?: number
    high24h?: number
    low24h?: number
  } = {},
): MarketData {
  const symbol = opts.symbol ?? 'BTCUSDT'
  const timeframe: Timeframe = opts.timeframe ?? '1h'
  const ticker: Ticker24h = {
    symbol,
    priceChange: price * (opts.change24hPercent ?? 0) / 100,
    priceChangePercent: opts.change24hPercent ?? 0,
    weightedAvgPrice: price,
    lastPrice: price,
    bidPrice: price - 1,
    askPrice: price + 1,
    openPrice: price,
    highPrice: opts.high24h ?? price * 1.02,
    lowPrice: opts.low24h ?? price * 0.98,
    volume: 10_000,
    quoteVolume: price * 10_000,
    openTime: 0,
    closeTime: 3_600_000,
    tradeCount: 1000,
  }
  return {
    symbol,
    timeframe,
    fetchedAt: 1_000_000,
    candles: [candle(price)],
    ticker,
    fundingRate: null,
    openInterest: null,
  }
}

// ─── IndicatorResult factory ──────────────────────────────────────────────────

export function indicators(overrides: Partial<IndicatorResult> = {}): IndicatorResult {
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

export function macd(macdLine: number, signalLine: number, previousHistogram: number | null = null): MACDResult {
  return {
    macdLine,
    signalLine,
    histogram: macdLine - signalLine,
    previousHistogram,
    bias: macdLine > signalLine ? 'bullish' : macdLine < signalLine ? 'bearish' : 'neutral',
  }
}

export function adx(adxValue: number, diPlus = 20, diMinus = 15): ADXResult {
  return { adx: adxValue, diPlus, diMinus }
}

export function bollinger(upper: number, middle: number, lower: number): BollingerResult {
  return { upper, middle, lower, bandwidth: upper - lower }
}

export function stochRsi(k: number, d: number): StochRSIResult {
  return { k, d }
}

// ─── Bullish indicators helper ────────────────────────────────────────────────

/** Returns indicators where price=100 satisfies all 5 bullish conditions */
export function bullishIndicators(): IndicatorResult {
  return indicators({
    ema20: 95,
    ema50: 90,
    ema100: 85,
    ema200: 80,
    rsi: 60,
    macd: macd(10, 5, 4), // histogram=5, previousHistogram=4 → increasing → macdBullish=true
    adx: adx(30),
  })
}

/** Returns indicators where price=100 satisfies all 5 bearish conditions */
export function bearishIndicators(): IndicatorResult {
  return indicators({
    ema20: 105,
    ema50: 110,
    ema100: 115,
    ema200: 120,
    rsi: 40,
    macd: macd(5, 10, -4), // histogram=-5, previousHistogram=-4 → decreasing → macdBearish=true
    adx: adx(30),
  })
}

// ─── MarketStructureResult factory ───────────────────────────────────────────

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
    evidence: [],
  }
}

export function bullishStructure(): MarketStructureResult {
  return {
    ...emptyStructure(),
    trend: 'bullish',
    strength: 'strong',
    structure: { higherHighs: 3, higherLows: 3, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 },
    recentStructure: { higherHighs: 3, higherLows: 3, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 },
  }
}

export function bearishStructure(): MarketStructureResult {
  return {
    ...emptyStructure(),
    trend: 'bearish',
    strength: 'strong',
    structure: { higherHighs: 0, higherLows: 0, lowerHighs: 3, lowerLows: 3, equalHighs: 0, equalLows: 0 },
    recentStructure: { higherHighs: 0, higherLows: 0, lowerHighs: 3, lowerLows: 3, equalHighs: 0, equalLows: 0 },
  }
}

// ─── PriceZone factory ────────────────────────────────────────────────────────

export function priceZone(
  type: 'support' | 'resistance',
  center: number,
  strengthScore = 5,
): PriceZone {
  return {
    id: `zone-${center}`,
    type,
    origin: 'swing-low',
    state: 'active',
    center,
    upper: center + 1,
    lower: center - 1,
    width: 2,
    touchCount: 3,
    successfulReactions: 2,
    failedReactions: 0,
    broken: false,
    retested: false,
    firstDetectedIndex: 0,
    lastInteractionIndex: 5,
    age: 10,
    strength: strengthScore,
    confidence: 6,
    evidence: [],
  }
}

// ─── SupportResistanceResult factory ─────────────────────────────────────────

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

// ─── VolumeAnalysisResult factory ─────────────────────────────────────────────

export function emptyVolumeAnalysis(): VolumeAnalysisResult {
  return {
    volumeTrend: { direction: 'flat', confidence: 0, evidence: [] },
    relativeVolume: { current: 1000, average: 1000, ratio: 1.0, classification: 'normal' },
    buySellPressure: { buyVolume: 500, sellVolume: 500, delta: 0, deltaPercent: 0, dominantSide: 'balanced' },
    volumeConfirmation: {
      confirmed: false,
      reason: 'Volume at 1.0× average',
      supportsTrend: false,
      supportsBreakout: false,
      supportsBOS: false,
      supportsCHOCH: false,
    },
    climax: { buyingClimax: false, sellingClimax: false, exhaustion: false },
    accumulationDistribution: { state: 'neutral', score: 0 },
    obvAnalysis: { direction: 'neutral', confirmingPrice: false, diverging: false },
    vwapAnalysis: { above: true, below: false, distancePercent: 0.2, respectingVWAP: true },
    overallStrength: 3,
    evidence: [],
  }
}
