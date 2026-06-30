import type { MarketAnalysisResult, TrendConditions, FullTrendResult, EvidenceItem } from '../../analysis/types'
import type { IndicatorResult } from '../../indicators/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { PriceZone, SupportResistanceResult } from '../../support-resistance/types'
import type { VolumeAnalysisResult } from '../../volume-analysis/types'

// ─── Indicator factory ────────────────────────────────────────────────────────

export function makeIndicators(overrides: Partial<IndicatorResult> = {}): IndicatorResult {
  return {
    ema20: 95,
    ema50: 90,
    ema100: 85,
    ema200: 80,
    sma20: null,
    sma50: null,
    sma200: null,
    rsi: 65,
    macd: { macdLine: 5, signalLine: 3, histogram: 2, bias: 'bullish' },
    atr: 2,
    atrPercent: 2.0,
    adx: { adx: 30, diPlus: 25, diMinus: 15 },
    vwap: 92,
    bollingerBands: { upper: 105, middle: 95, lower: 85, bandwidth: 20 },
    stochRsi: { k: 65, d: 60 },
    obv: 50_000,
    mfi: null,
    cci: null,
    volumeMA: null,
    ...overrides,
  }
}

// ─── Market structure factory ─────────────────────────────────────────────────

export function makeStructure(overrides: Partial<MarketStructureResult> = {}): MarketStructureResult {
  return {
    trend: 'bullish',
    strength: 'strong',
    confidence: 7,
    structure: {
      higherHighs: 2,
      higherLows: 2,
      lowerHighs: 0,
      lowerLows: 0,
      equalHighs: 0,
      equalLows: 0,
    },
    bos: { detected: false, events: [], last: null },
    choch: { detected: false, events: [], last: null },
    pullback: { detected: false, depth: null },
    consolidation: { detected: false, rangeHigh: null, rangeLow: null, rangePercent: null, barsInRange: 0 },
    breakout: { confirmed: false, failed: false, level: null, direction: null },
    swings: [],
    events: [],
    evidence: [],
    ...overrides,
  }
}

// ─── S/R factory ─────────────────────────────────────────────────────────────

export function makePriceZone(
  type: 'support' | 'resistance',
  center: number,
  id = 'sr-001',
): PriceZone {
  const halfWidth = 1
  return {
    id,
    type,
    origin: 'swing-high',
    state: 'active',
    center,
    upper: center + halfWidth,
    lower: center - halfWidth,
    width: halfWidth * 2,
    touchCount: 2,
    successfulReactions: 1,
    failedReactions: 0,
    broken: false,
    retested: false,
    firstDetectedIndex: 0,
    lastInteractionIndex: 5,
    age: 5,
    strength: 3,
    confidence: 3,
    evidence: [],
  }
}

export function makeSupportResistance(overrides: Partial<SupportResistanceResult> = {}): SupportResistanceResult {
  return {
    zones: [],
    activeSupport: [],
    activeResistance: [],
    nearestSupport: null,
    nearestResistance: null,
    currentZone: null,
    evidence: [],
    ...overrides,
  }
}

// ─── Volume analysis factory ──────────────────────────────────────────────────

export function makeVolumeAnalysis(overrides: Partial<VolumeAnalysisResult> = {}): VolumeAnalysisResult {
  return {
    volumeTrend: { direction: 'flat', confidence: 5, evidence: [] },
    relativeVolume: { current: 1200, average: 1000, ratio: 1.2, classification: 'normal' },
    buySellPressure: { buyVolume: 600, sellVolume: 600, delta: 0, deltaPercent: 0, dominantSide: 'balanced' },
    volumeConfirmation: {
      confirmed: true,
      reason: 'volume above average',
      supportsTrend: true,
      supportsBreakout: false,
      supportsBOS: false,
      supportsCHOCH: false,
    },
    climax: { buyingClimax: false, sellingClimax: false, exhaustion: false },
    accumulationDistribution: { state: 'neutral', score: 0 },
    obvAnalysis: { direction: 'bullish', confirmingPrice: true, diverging: false },
    vwapAnalysis: { above: true, below: false, distancePercent: 8.7, respectingVWAP: false },
    overallStrength: 5,
    evidence: [],
    ...overrides,
  }
}

// ─── Trend conditions factory ─────────────────────────────────────────────────

export function makeTrendConditions(overrides: Partial<TrendConditions> = {}): TrendConditions {
  return {
    // Bullish conditions — all true for the default strong-bullish scenario
    priceAboveEMA20: true,
    priceAboveEMA50: true,
    priceAboveEMA100: true,
    priceAboveEMA200: true,
    priceAboveAllEMAs: true,
    emaInBullishOrder: true,
    hasConsistentHHHL: true,
    rsiSupportsBullish: true,
    macdBullish: true,
    // Bearish conditions — all false
    priceBelowEMA20: false,
    priceBelowEMA50: false,
    priceBelowEMA100: false,
    priceBelowEMA200: false,
    priceBelowAllEMAs: false,
    emaInBearishOrder: false,
    hasConsistentLHLL: false,
    rsiSupportsBearish: false,
    macdBearish: false,
    // Neutral conditions — all false (strong directional trend)
    adxBelowWeakThreshold: false,
    rsiInNeutralRange: false,
    noConsistentStructure: false,
    priceBetweenEMAsWithoutClearOrder: false,
    ...overrides,
  }
}

export function makeFullTrend(overrides: Partial<FullTrendResult> = {}): FullTrendResult {
  return {
    trend: 'strong bullish',
    conditions: makeTrendConditions(),
    bullishConditionsMet: 5,
    bearishConditionsMet: 0,
    neutralConditionsMet: 0,
    ...overrides,
  }
}

// ─── Evidence factory ─────────────────────────────────────────────────────────

export function makeEvidence(items: EvidenceItem[] = []): EvidenceItem[] {
  const base: EvidenceItem[] = [
    { factor: 'Price above EMA200', impact: 'high', description: 'Price is above EMA200', source: 'indicators' },
    { factor: 'Higher High confirmed', impact: 'high', description: 'HH detected', source: 'market_structure' },
    { factor: 'MACD bullish bias', impact: 'medium', description: 'MACD is bullish', source: 'indicators' },
  ]
  return items.length > 0 ? items : base
}

// ─── Full result factory ──────────────────────────────────────────────────────

/**
 * Returns a MarketAnalysisResult in which all fields are internally consistent.
 * Defaults to a 'strong bullish' scenario with:
 *   price=100, ema20=95, ema50=90, ema100=85, ema200=80,
 *   rsi=65, macd bullish, adx=30, bullishConditionsMet=5
 */
export function makeValidResult(overrides: Partial<MarketAnalysisResult> = {}): MarketAnalysisResult {
  const indicators = makeIndicators()
  const marketStructure = makeStructure()
  const supportResistance = makeSupportResistance()
  const volumeAnalysis = makeVolumeAnalysis()

  return {
    symbol: 'BTCUSDT',
    timeframe: '4h',
    analysedAt: 1_700_000_000_000,
    price: {
      current: 100,
      change24hPercent: 2.5,
      high24h: 102,
      low24h: 98,
      atrPercent: 2.0,
    },
    fullTrend: makeFullTrend(),
    emaContext: {
      priceVsEMA20: 'above',
      priceVsEMA50: 'above',
      priceVsEMA100: 'above',
      priceVsEMA200: 'above',
      emaAlignment: 'bullish_stack',
      confluenceZones: [],
    },
    indicatorSummary: {
      rsi: { value: 65, classification: 'healthy_bullish' },
      macd: { histogram: 2, bias: 'bullish' },
      adx: { adx: 30, trendStrength: 'strong', dominantDirection: 'bullish' },
      bollinger: { bandwidth: 20, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
      stochRsi: { k: 65, d: 60, zone: 'neutral' },
    },
    srContext: {
      nearestSupportDistance: null,
      nearestResistanceDistance: null,
      insideSupport: false,
      insideResistance: false,
      approachingSupport: false,
      approachingResistance: false,
      strongestActiveSupport: null,
      strongestActiveResistance: null,
    },
    volumeContext: {
      relativeVolume: 1.2,
      volumeClassification: 'normal',
      confirmsCurrentMove: true,
      climaxSignal: 'none',
      accDistState: 'neutral',
      priceAboveVWAP: true,
      vwapDistancePercent: 8.7,
      respectingVWAP: false,
      obvDirection: 'bullish',
      obvConfirmingPrice: true,
      overallStrength: 5,
    },
    evidence: makeEvidence(),
    indicators,
    marketStructure,
    supportResistance,
    volumeAnalysis,
    ...overrides,
  }
}
