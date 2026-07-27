import type { IndicatorResult } from '../../indicators/types'
import type {
  AnalysisConfig,
  IndicatorSummaryResult,
  RSIClassification,
  ADXTrendStrength,
  BollingerBandwidthState,
  PriceVsBands,
} from '../types'

export function classifyRSI(rsi: number | null): RSIClassification {
  if (rsi === null) return 'unavailable'
  if (rsi < 30) return 'oversold'
  if (rsi < 45) return 'weak_bearish'
  if (rsi <= 55) return 'neutral'
  if (rsi <= 70) return 'healthy_bullish'
  return 'overbought'
}

function classifyADXStrength(adx: number): ADXTrendStrength {
  if (adx < 20) return 'weak'
  if (adx < 25) return 'emerging'
  if (adx < 40) return 'strong'
  if (adx <= 60) return 'very_strong'
  return 'extreme'
}

/**
 * Classifies an ALREADY-NORMALISED bandwidth percentage.
 *
 * Takes the percentage rather than recomputing it, so the state and the
 * exposed `bandwidthPercent` are guaranteed to come from one number. The
 * previous version computed the percentage here, classified from it, and threw
 * it away — leaving the raw price-unit width to be exposed under a name every
 * consumer read as a percentage.
 */
function classifyBandwidth(bwPercent: number, cfg: AnalysisConfig): BollingerBandwidthState {
  if (bwPercent < cfg.bollingerTightThreshold) return 'squeeze'
  if (bwPercent > cfg.bollingerWideThreshold) return 'expansion'
  return 'normal'
}

export function interpretIndicators(
  price: number,
  indicators: IndicatorResult,
  cfg: AnalysisConfig,
): IndicatorSummaryResult {
  // RSI
  const rsiClassification = classifyRSI(indicators.rsi)

  // MACD
  const macdBias = indicators.macd === null
    ? 'unavailable' as const
    : indicators.macd.macdLine > indicators.macd.signalLine
      ? 'bullish' as const
      : indicators.macd.macdLine < indicators.macd.signalLine
        ? 'bearish' as const
        : 'neutral' as const

  // ADX
  const adxTrendStrength: ADXTrendStrength =
    indicators.adx === null ? 'unavailable' : classifyADXStrength(indicators.adx.adx)

  let adxDominantDirection: 'bullish' | 'bearish' | 'neutral' | 'unavailable' = 'unavailable'
  if (indicators.adx !== null) {
    const { diPlus, diMinus } = indicators.adx
    if (diPlus > diMinus) adxDominantDirection = 'bullish'
    else if (diMinus > diPlus) adxDominantDirection = 'bearish'
    else adxDominantDirection = 'neutral'
  }

  // Bollinger Bands
  let bandwidthPercent: number | null = null
  let bandwidthState: 'squeeze' | 'normal' | 'expansion' | 'unavailable' = 'unavailable'
  let priceRelativeToBands: PriceVsBands | 'unavailable' = 'unavailable'
  if (indicators.bollingerBands !== null && price > 0) {
    const { upper, lower, bandwidth } = indicators.bollingerBands
    bandwidthPercent = (bandwidth / price) * 100
    bandwidthState = classifyBandwidth(bandwidthPercent, cfg)
    if (price > upper) priceRelativeToBands = 'above_upper'
    else if (price < lower) priceRelativeToBands = 'below_lower'
    else priceRelativeToBands = 'inside'
  }

  // StochRSI
  let stochZone: 'overbought' | 'neutral' | 'oversold' | 'unavailable' = 'unavailable'
  if (indicators.stochRsi !== null) {
    const { k } = indicators.stochRsi
    if (k >= cfg.stochRsiOverboughtThreshold) stochZone = 'overbought'
    else if (k <= cfg.stochRsiOversoldThreshold) stochZone = 'oversold'
    else stochZone = 'neutral'
  }

  return {
    rsi: {
      value: indicators.rsi,
      classification: rsiClassification,
    },
    macd: {
      histogram: indicators.macd?.histogram ?? null,
      bias: macdBias,
    },
    adx: {
      adx: indicators.adx?.adx ?? null,
      trendStrength: adxTrendStrength,
      dominantDirection: adxDominantDirection,
    },
    bollinger: {
      bandwidthPercent,
      bandwidthState,
      priceRelativeToBands,
    },
    stochRsi: {
      k: indicators.stochRsi?.k ?? null,
      d: indicators.stochRsi?.d ?? null,
      zone: stochZone,
    },
  }
}
