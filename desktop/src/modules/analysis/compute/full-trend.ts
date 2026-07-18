import type { IndicatorResult } from '../../indicators/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { AnalysisConfig, FullTrendResult, FullTrendLabel, TrendConditions } from '../types'

export function synthesizeFullTrend(
  price: number,
  indicators: IndicatorResult,
  marketStructure: MarketStructureResult,
  cfg: AnalysisConfig,
): FullTrendResult {
  const { ema20, ema50, ema100, ema200, rsi, macd } = indicators
  const { recentStructure } = marketStructure

  // ── Bullish conditions ─────────────────────────────────────────────────────
  const priceAboveEMA20 = ema20 !== null && price > ema20
  const priceAboveEMA50 = ema50 !== null && price > ema50
  const priceAboveEMA100 = ema100 !== null && price > ema100
  const priceAboveEMA200 = ema200 !== null && price > ema200
  const priceAboveAllEMAs =
    ema20 !== null && ema50 !== null && ema100 !== null && ema200 !== null &&
    priceAboveEMA20 && priceAboveEMA50 && priceAboveEMA100 && priceAboveEMA200
  const emaInBullishOrder =
    ema20 !== null && ema50 !== null && ema100 !== null && ema200 !== null &&
    ema20 > ema50 && ema50 > ema100 && ema100 > ema200
  const hasConsistentHHHL =
    recentStructure.higherHighs >= cfg.minBullishSwingsForTrend &&
    recentStructure.higherLows >= cfg.minBullishSwingsForTrend
  const rsiSupportsBullish = rsi !== null && rsi >= cfg.rsiBullishMin
  const macdBullish = macd !== null && macd.macdLine > macd.signalLine

  // ── Bearish conditions ─────────────────────────────────────────────────────
  const priceBelowEMA20 = ema20 !== null && price < ema20
  const priceBelowEMA50 = ema50 !== null && price < ema50
  const priceBelowEMA100 = ema100 !== null && price < ema100
  const priceBelowEMA200 = ema200 !== null && price < ema200
  const priceBelowAllEMAs =
    ema20 !== null && ema50 !== null && ema100 !== null && ema200 !== null &&
    priceBelowEMA20 && priceBelowEMA50 && priceBelowEMA100 && priceBelowEMA200
  const emaInBearishOrder =
    ema20 !== null && ema50 !== null && ema100 !== null && ema200 !== null &&
    ema20 < ema50 && ema50 < ema100 && ema100 < ema200
  const hasConsistentLHLL =
    recentStructure.lowerHighs >= cfg.minBearishSwingsForTrend &&
    recentStructure.lowerLows >= cfg.minBearishSwingsForTrend
  const rsiSupportsBearish = rsi !== null && rsi <= cfg.rsiBearishMax
  const macdBearish = macd !== null && macd.macdLine < macd.signalLine

  // ── Neutral conditions ─────────────────────────────────────────────────────
  const adxBelowWeakThreshold =
    indicators.adx !== null && indicators.adx.adx < cfg.adxWeakThreshold
  const rsiInNeutralRange =
    rsi !== null && rsi >= cfg.rsiNeutralLow && rsi <= cfg.rsiNeutralHigh
  const noConsistentStructure =
    !hasConsistentHHHL && !hasConsistentLHLL
  // Requires all 4 EMAs to be available: when any EMA is null every compound condition
  // above is false, which would make this vacuously true and inflate neutralConditionsMet.
  const priceBetweenEMAsWithoutClearOrder =
    ema20 !== null && ema50 !== null && ema100 !== null && ema200 !== null &&
    !priceAboveAllEMAs && !priceBelowAllEMAs && !emaInBullishOrder && !emaInBearishOrder

  const conditions: TrendConditions = {
    priceAboveEMA20,
    priceAboveEMA50,
    priceAboveEMA100,
    priceAboveEMA200,
    priceAboveAllEMAs,
    emaInBullishOrder,
    hasConsistentHHHL,
    rsiSupportsBullish,
    macdBullish,
    priceBelowEMA20,
    priceBelowEMA50,
    priceBelowEMA100,
    priceBelowEMA200,
    priceBelowAllEMAs,
    emaInBearishOrder,
    hasConsistentLHLL,
    rsiSupportsBearish,
    macdBearish,
    adxBelowWeakThreshold,
    rsiInNeutralRange,
    noConsistentStructure,
    priceBetweenEMAsWithoutClearOrder,
  }

  // Count satisfied conditions
  const bullishConditionsMet = [
    priceAboveAllEMAs,
    emaInBullishOrder,
    hasConsistentHHHL,
    rsiSupportsBullish,
    macdBullish,
  ].filter(Boolean).length

  const bearishConditionsMet = [
    priceBelowAllEMAs,
    emaInBearishOrder,
    hasConsistentLHLL,
    rsiSupportsBearish,
    macdBearish,
  ].filter(Boolean).length

  const neutralConditionsMet = [
    adxBelowWeakThreshold,
    rsiInNeutralRange,
    noConsistentStructure,
    priceBetweenEMAsWithoutClearOrder,
  ].filter(Boolean).length

  // ── Label assignment (ENGINE_RULES.md §1) ─────────────────────────────────
  let trend: FullTrendLabel

  if (bullishConditionsMet === 5) {
    trend = 'strong bullish'
  } else if (bullishConditionsMet >= 3 && bullishConditionsMet > bearishConditionsMet) {
    trend = 'moderate bullish'
  } else if (bearishConditionsMet === 5) {
    trend = 'strong bearish'
  } else if (bearishConditionsMet >= 3 && bearishConditionsMet > bullishConditionsMet) {
    trend = 'moderate bearish'
  } else if (neutralConditionsMet >= 3) {
    trend = 'ranging'
  } else if (bullishConditionsMet > bearishConditionsMet && bullishConditionsMet > 0) {
    trend = 'weak bullish'
  } else if (bearishConditionsMet > bullishConditionsMet && bearishConditionsMet > 0) {
    trend = 'weak bearish'
  } else {
    trend = 'ranging'
  }

  return { trend, conditions, bullishConditionsMet, bearishConditionsMet, neutralConditionsMet }
}
