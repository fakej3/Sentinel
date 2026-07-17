import type { Timeframe } from '../../binance/types'
import type {
  MarketAnalysisResult,
  EvidenceItem,
  EvidenceDirection,
  FullTrendResult,
  EMAContextResult,
  IndicatorSummaryResult,
  SRContextResult,
  VolumeContextResult,
  PriceSummary,
} from '../../analysis/types'
import type { ValidationResult } from '../../validation/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { VolumeAnalysisResult } from '../../volume-analysis/types'
import type { IndicatorResult } from '../../indicators/types'

// ─── EvidenceItem factory ─────────────────────────────────────────────────────

export function ev(
  factor: string,
  direction: EvidenceDirection = 'bullish',
  impact: EvidenceItem['impact'] = 'medium',
): EvidenceItem {
  return { factor, impact, description: `Test: ${factor}`, source: 'indicators', direction }
}

// ─── MarketAnalysisResult stub ────────────────────────────────────────────────

const EMPTY_STRUCTURE: MarketStructureResult = {
  trend: 'ranging',
  strength: 'weak',
  confidence: 0,
  structure: { higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 },
  recentStructure: { higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0, equalHighs: 0, equalLows: 0 },
  bos: { detected: false, events: [], last: null },
  choch: { detected: false, events: [], last: null },
  pullback: { detected: false, depth: null },
  consolidation: { detected: false, rangeHigh: null, rangeLow: null, rangePercent: null, barsInRange: 0 },
  breakout: { confirmed: false, failed: false, level: null, direction: null },
  swings: [],
  events: [],
  evidence: [],
}

const EMPTY_SR: SupportResistanceResult = {
  zones: [],
  activeSupport: [],
  activeResistance: [],
  nearestSupport: null,
  nearestResistance: null,
  currentZone: null,
  evidence: [],
}

const EMPTY_VOLUME: VolumeAnalysisResult = {
  volumeTrend: { direction: 'flat', confidence: 0, evidence: [] },
  relativeVolume: { current: 1000, average: 1000, ratio: 1.0, classification: 'normal' },
  buySellPressure: { buyVolume: 500, sellVolume: 500, delta: 0, deltaPercent: 0, dominantSide: 'balanced' },
  volumeConfirmation: {
    confirmed: false,
    reason: 'Volume at 1.0×',
    supportsTrend: false,
    supportsBreakout: false,
    supportsBOS: false,
    supportsCHOCH: false,
  },
  climax: { buyingClimax: false, sellingClimax: false, exhaustion: false },
  accumulationDistribution: { state: 'neutral', score: 0 },
  obvAnalysis: { direction: 'neutral', confirmingPrice: false, diverging: false },
  vwapAnalysis: { above: true, below: false, distancePercent: 0.0, respectingVWAP: true },
  overallStrength: 3,
  evidence: [],
}

const EMPTY_INDICATORS: IndicatorResult = {
  ema20: null, ema50: null, ema100: null, ema200: null,
  sma20: null, sma50: null, sma200: null,
  rsi: null, macd: null, atr: null, atrPercent: null, adx: null,
  vwap: 0, bollingerBands: null, stochRsi: null,
  obv: 0, mfi: null, cci: null, volumeMA: null,
}

const EMPTY_FULL_TREND: FullTrendResult = {
  trend: 'ranging',
  bullishConditionsMet: 0,
  bearishConditionsMet: 0,
  neutralConditionsMet: 0,
  conditions: {
    priceAboveEMA20: false, priceAboveEMA50: false, priceAboveEMA100: false, priceAboveEMA200: false,
    priceAboveAllEMAs: false, emaInBullishOrder: false, hasConsistentHHHL: false,
    rsiSupportsBullish: false, macdBullish: false,
    priceBelowEMA20: false, priceBelowEMA50: false, priceBelowEMA100: false, priceBelowEMA200: false,
    priceBelowAllEMAs: false, emaInBearishOrder: false, hasConsistentLHLL: false,
    rsiSupportsBearish: false, macdBearish: false,
    adxBelowWeakThreshold: false, rsiInNeutralRange: false, noConsistentStructure: false,
    priceBetweenEMAsWithoutClearOrder: false,
  },
}

const EMPTY_EMA_CONTEXT: EMAContextResult = {
  priceVsEMA20: 'unavailable', priceVsEMA50: 'unavailable',
  priceVsEMA100: 'unavailable', priceVsEMA200: 'unavailable',
  emaAlignment: 'unavailable', confluenceZones: [],
}

const EMPTY_INDICATOR_SUMMARY: IndicatorSummaryResult = {
  rsi: { value: null, classification: 'unavailable' },
  macd: { histogram: null, bias: 'unavailable' },
  adx: { adx: null, trendStrength: 'unavailable', dominantDirection: 'unavailable' },
  bollinger: { bandwidth: null, bandwidthState: 'unavailable', priceRelativeToBands: 'unavailable' },
  stochRsi: { k: null, d: null, zone: 'unavailable' },
}

const EMPTY_SR_CONTEXT: SRContextResult = {
  nearestSupportDistance: null, nearestResistanceDistance: null,
  insideSupport: false, insideResistance: false,
  approachingSupport: false, approachingResistance: false,
  strongestActiveSupport: null, strongestActiveResistance: null,
}

const EMPTY_VOLUME_CONTEXT: VolumeContextResult = {
  relativeVolume: 1.0, volumeClassification: 'normal',
  confirmsCurrentMove: false, climaxSignal: 'none',
  accDistState: 'neutral', priceAboveVWAP: true,
  vwapDistancePercent: 0.0, respectingVWAP: true,
  obvDirection: 'neutral', obvConfirmingPrice: false,
  overallStrength: 3,
}

const EMPTY_PRICE: PriceSummary = {
  current: 100, change24hPercent: 0, high24h: 102, low24h: 98, atrPercent: null,
}

/**
 * Creates a minimal MarketAnalysisResult suitable for Module 8 testing.
 * Only the evidence field varies between tests.
 */
export function makeAnalysis(evidence: EvidenceItem[] = []): MarketAnalysisResult {
  return {
    symbol: 'BTCUSDT',
    timeframe: '1h' as Timeframe,
    analysedAt: 1_000_000,
    price: EMPTY_PRICE,
    fullTrend: EMPTY_FULL_TREND,
    emaContext: EMPTY_EMA_CONTEXT,
    indicatorSummary: EMPTY_INDICATOR_SUMMARY,
    srContext: EMPTY_SR_CONTEXT,
    volumeContext: EMPTY_VOLUME_CONTEXT,
    evidence,
    indicators: EMPTY_INDICATORS,
    marketStructure: EMPTY_STRUCTURE,
    supportResistance: EMPTY_SR,
    volumeAnalysis: EMPTY_VOLUME,
  }
}

/**
 * Creates a MarketAnalysisResult with a specific trend direction.
 * Used for testing direction-aware confidence scoring (Module 25).
 */
export function makeDirectionalAnalysis(
  trend: 'strong bullish' | 'moderate bullish' | 'weak bullish' | 'ranging' | 'weak bearish' | 'moderate bearish' | 'strong bearish',
  evidence: EvidenceItem[] = [],
): MarketAnalysisResult {
  return {
    ...makeAnalysis(evidence),
    fullTrend: {
      ...EMPTY_FULL_TREND,
      trend,
    },
  }
}

// ─── ValidationResult factory ─────────────────────────────────────────────────

export function cleanValidation(): ValidationResult {
  return {
    passed: true,
    clean: true,
    issues: [],
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    summary: 'All checks passed',
  }
}

export function validationWithWarnings(count: number): ValidationResult {
  return {
    passed: false,
    clean: false,
    issues: Array.from({ length: count }, (_, i) => ({
      severity: 'warning' as const,
      category: 'consistency' as const,
      field: `field.${i}`,
      message: `Warning ${i + 1}`,
    })),
    criticalCount: 0,
    warningCount: count,
    infoCount: 0,
    summary: `${count} warning(s) found`,
  }
}

export function validationWithCriticals(count: number): ValidationResult {
  return {
    passed: false,
    clean: false,
    issues: Array.from({ length: count }, (_, i) => ({
      severity: 'critical' as const,
      category: 'structural' as const,
      field: `field.${i}`,
      message: `Critical ${i + 1}`,
    })),
    criticalCount: count,
    warningCount: 0,
    infoCount: 0,
    summary: `${count} critical issue(s) found`,
  }
}

export function validationWithBoth(criticals: number, warnings: number): ValidationResult {
  return {
    passed: false,
    clean: false,
    issues: [
      ...Array.from({ length: criticals }, (_, i) => ({
        severity: 'critical' as const,
        category: 'structural' as const,
        field: `field.crit.${i}`,
        message: `Critical ${i + 1}`,
      })),
      ...Array.from({ length: warnings }, (_, i) => ({
        severity: 'warning' as const,
        category: 'consistency' as const,
        field: `field.warn.${i}`,
        message: `Warning ${i + 1}`,
      })),
    ],
    criticalCount: criticals,
    warningCount: warnings,
    infoCount: 0,
    summary: `${criticals} critical, ${warnings} warning(s)`,
  }
}
