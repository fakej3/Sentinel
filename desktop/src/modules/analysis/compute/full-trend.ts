import type { IndicatorResult } from '../../indicators/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { AnalysisConfig, FullTrendResult, FullTrendLabel, TrendConditions } from '../types'

export function synthesizeFullTrend(
  price: number,
  indicators: IndicatorResult,
  marketStructure: MarketStructureResult,
  cfg: AnalysisConfig,
): FullTrendResult {
  const { ema20, ema50, ema100, ema200, rsi, macd, atr } = indicators
  const { recentStructure } = marketStructure

  // ── EMA availability: graceful degradation ────────────────────────────────
  // Previously `priceAboveAllEMAs` and `emaInBullishOrder` both required all
  // four EMAs to be non-null, so a dataset shorter than ~200 candles (EMA200
  // unavailable) silently zeroed TWO of the five directional conditions at
  // once — a 2-condition swing that pushed genuinely trending markets into
  // 'ranging' purely because history was short.
  //
  // Rule: evaluate both conditions over the EMAs that ARE available, and
  // require at least two of them so a single EMA can never masquerade as a
  // "stack". This degrades continuously (4 EMAs → 3 → 2) instead of
  // collapsing, and is exactly equivalent to the old behaviour when all four
  // are present. Below two available EMAs the conditions are false, because
  // "price above all EMAs" and "EMAs in order" are meaningless for one line.
  const availableEmas: Array<{ period: number; value: number }> = []
  if (ema20  !== null) availableEmas.push({ period: 20,  value: ema20 })
  if (ema50  !== null) availableEmas.push({ period: 50,  value: ema50 })
  if (ema100 !== null) availableEmas.push({ period: 100, value: ema100 })
  if (ema200 !== null) availableEmas.push({ period: 200, value: ema200 })
  const hasEnoughEmas = availableEmas.length >= 2

  // ── Bullish conditions ─────────────────────────────────────────────────────
  const priceAboveEMA20 = ema20 !== null && price > ema20
  const priceAboveEMA50 = ema50 !== null && price > ema50
  const priceAboveEMA100 = ema100 !== null && price > ema100
  const priceAboveEMA200 = ema200 !== null && price > ema200
  const priceAboveAllEMAs =
    hasEnoughEmas && availableEmas.every(e => price > e.value)
  // Ordered fast→slow: each faster EMA strictly above the next slower one.
  const emaInBullishOrder =
    hasEnoughEmas && availableEmas.every((e, i) => i === 0 || availableEmas[i - 1].value > e.value)
  const hasConsistentHHHL =
    recentStructure.higherHighs >= cfg.minBullishSwingsForTrend &&
    recentStructure.higherLows >= cfg.minBullishSwingsForTrend
  const rsiSupportsBullish = rsi !== null && rsi >= cfg.rsiBullishMin

  // ── MACD neutrality band ──────────────────────────────────────────────────
  // MACD line is always either above or below its signal, so a bare
  // `macdLine > signalLine` test ALWAYS votes directionally — even when the
  // two are separated by a rounding error. In a flat market that made MACD a
  // coin flip that reliably contributed a spurious directional condition.
  //
  // The separation is only meaningful relative to the price movement that
  // produced it, so the deadband is scaled by ATR — the market's own unit of
  // one-bar movement — rather than by an absolute constant that would mean
  // different things per symbol and per timeframe.
  //
  // Band = macdNeutralAtrFraction x ATR (default 0.05, i.e. 5% of one bar's
  // typical range). Rationale for the magnitude: MACD is a difference of two
  // EMAs of price, so it carries price units; a histogram smaller than a
  // twentieth of a normal bar's range is not a signal a trader could act on,
  // while anything larger is a real, visible separation. Below it, MACD
  // abstains rather than voting. When ATR is unavailable the band is zero,
  // which reproduces the previous strict-inequality behaviour exactly.
  const macdBand = atr !== null ? cfg.macdNeutralAtrFraction * atr : 0
  const macdSeparation = macd !== null ? macd.macdLine - macd.signalLine : 0
  const macdBullish = macd !== null && macdSeparation > macdBand

  // ── Bearish conditions ─────────────────────────────────────────────────────
  const priceBelowEMA20 = ema20 !== null && price < ema20
  const priceBelowEMA50 = ema50 !== null && price < ema50
  const priceBelowEMA100 = ema100 !== null && price < ema100
  const priceBelowEMA200 = ema200 !== null && price < ema200
  const priceBelowAllEMAs =
    hasEnoughEmas && availableEmas.every(e => price < e.value)
  const emaInBearishOrder =
    hasEnoughEmas && availableEmas.every((e, i) => i === 0 || availableEmas[i - 1].value < e.value)
  const hasConsistentLHLL =
    recentStructure.lowerHighs >= cfg.minBearishSwingsForTrend &&
    recentStructure.lowerLows >= cfg.minBearishSwingsForTrend
  const rsiSupportsBearish = rsi !== null && rsi <= cfg.rsiBearishMax
  const macdBearish = macd !== null && macdSeparation < -macdBand

  // ── Neutral conditions ─────────────────────────────────────────────────────
  const adxBelowWeakThreshold =
    indicators.adx !== null && indicators.adx.adx < cfg.adxWeakThreshold
  const rsiInNeutralRange =
    rsi !== null && rsi >= cfg.rsiNeutralLow && rsi <= cfg.rsiNeutralHigh
  const noConsistentStructure =
    !hasConsistentHHHL && !hasConsistentLHLL
  // Requires enough EMAs to judge: with fewer than two available every compound
  // condition above is false, which would make this vacuously true and inflate
  // neutralConditionsMet.
  const priceBetweenEMAsWithoutClearOrder =
    hasEnoughEmas &&
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
