import type { IndicatorResult } from '../../indicators/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type {
  AnalysisConfig,
  EMAContextResult,
  EvidenceItem,
  FullTrendResult,
  IndicatorSummaryResult,
  SRContextResult,
  VolumeContextResult,
} from '../types'
import {
  F_PRICE_ABOVE_EMA200, F_PRICE_ABOVE_EMA100, F_PRICE_ABOVE_EMA50, F_PRICE_ABOVE_EMA20,
  F_PRICE_BELOW_EMA200, F_PRICE_BELOW_EMA100, F_PRICE_BELOW_EMA50, F_PRICE_BELOW_EMA20,
  F_EMA_BULLISH_ALIGNMENT, F_EMA_BEARISH_ALIGNMENT, F_EMA_CONFLUENCE_ZONE,
  F_HIGHER_HIGH, F_HIGHER_LOW, F_LOWER_HIGH, F_LOWER_LOW,
  F_BULLISH_BOS, F_BEARISH_BOS, F_BULLISH_CHOCH, F_BEARISH_CHOCH,
  F_BULLISH_BREAKOUT, F_BEARISH_BREAKOUT, F_MARKET_CONSOLIDATION, F_FAILED_BREAKOUT, F_ACTIVE_PULLBACK,
  F_RSI_SUPPORTS_BULLISH, F_RSI_SUPPORTS_BEARISH, F_RSI_OVERBOUGHT, F_RSI_OVERSOLD,
  F_RSI_NEUTRAL, F_RSI_NEUTRAL_OVERLAP,
  F_MACD_BULLISH, F_MACD_BEARISH,
  F_ADX_ABOVE_25, F_ADX_TREND_WEAK,
  F_BOLLINGER_SQUEEZE, F_BOLLINGER_EXPANSION, F_PRICE_AT_BOLLINGER_LOWER, F_PRICE_AT_BOLLINGER_UPPER,
  F_STOCHRSI_OVERSOLD, F_STOCHRSI_OVERBOUGHT,
  F_PRICE_AT_SUPPORT, F_PRICE_AT_RESISTANCE, F_STRONG_SUPPORT_BELOW, F_STRONG_RESISTANCE_ABOVE,
  F_ACTIVE_SUPPORT_ZONE, F_STRONG_RESISTANCE_OVERHEAD,
  F_STRONG_VOLUME, F_STRONG_BULLISH_VOLUME, F_STRONG_BEARISH_VOLUME, F_BELOW_AVERAGE_VOLUME,
  F_ACCUMULATION, F_DISTRIBUTION,
  F_BULLISH_OBV, F_BEARISH_OBV, F_OBV_DIVERGING, F_OBV_DIVERGING_BULLISH,
  F_VOLUME_CLIMAX_SELLING, F_VOLUME_CLIMAX_BUYING, F_VOLUME_EXHAUSTION,
  F_PRICE_ABOVE_VWAP, F_PRICE_BELOW_VWAP, F_HIGH_RELATIVE_VOLUME, F_LOW_RELATIVE_VOLUME,
} from '../evidence-factors'

function item(
  factor: EvidenceItem['factor'],
  impact: EvidenceItem['impact'],
  description: string,
  source: EvidenceItem['source'],
  direction: EvidenceItem['direction'],
): EvidenceItem {
  return { factor, impact, description, source, direction }
}

const IMPACT_ORDER: Record<EvidenceItem['impact'], number> = { high: 0, medium: 1, low: 2 }

export function collectEvidence(
  fullTrend: FullTrendResult,
  emaContext: EMAContextResult,
  indicatorSummary: IndicatorSummaryResult,
  marketStructure: MarketStructureResult,
  srContext: SRContextResult,
  volumeContext: VolumeContextResult,
  indicators: IndicatorResult,
  cfg: AnalysisConfig,
): EvidenceItem[] {
  const items: EvidenceItem[] = []
  const { conditions } = fullTrend

  // ── EMA position evidence ─────────────────────────────────────────────────
  if (conditions.priceAboveEMA200) {
    items.push(item(F_PRICE_ABOVE_EMA200, 'high',
      `Price is above the EMA200 (${indicators.ema200?.toFixed(2)}) — major long-term bullish bias`, 'indicators', 'bullish'))
  }
  if (conditions.priceBelowEMA200) {
    items.push(item(F_PRICE_BELOW_EMA200, 'high',
      `Price is below the EMA200 (${indicators.ema200?.toFixed(2)}) — major long-term bearish bias`, 'indicators', 'bearish'))
  }
  if (conditions.priceAboveEMA100) {
    items.push(item(F_PRICE_ABOVE_EMA100, 'medium',
      `Price is above the EMA100 (${indicators.ema100?.toFixed(2)})`, 'indicators', 'bullish'))
  }
  if (conditions.priceBelowEMA100) {
    items.push(item(F_PRICE_BELOW_EMA100, 'medium',
      `Price is below the EMA100 (${indicators.ema100?.toFixed(2)})`, 'indicators', 'bearish'))
  }
  if (conditions.priceAboveEMA50) {
    items.push(item(F_PRICE_ABOVE_EMA50, 'medium',
      `Price is above the EMA50 (${indicators.ema50?.toFixed(2)})`, 'indicators', 'bullish'))
  }
  if (conditions.priceBelowEMA50) {
    items.push(item(F_PRICE_BELOW_EMA50, 'medium',
      `Price is below the EMA50 (${indicators.ema50?.toFixed(2)})`, 'indicators', 'bearish'))
  }
  if (conditions.priceAboveEMA20) {
    items.push(item(F_PRICE_ABOVE_EMA20, 'low',
      `Price is above the EMA20 (${indicators.ema20?.toFixed(2)})`, 'indicators', 'bullish'))
  }
  if (conditions.priceBelowEMA20) {
    items.push(item(F_PRICE_BELOW_EMA20, 'low',
      `Price is below the EMA20 (${indicators.ema20?.toFixed(2)})`, 'indicators', 'bearish'))
  }

  // ── EMA alignment ─────────────────────────────────────────────────────────
  if (emaContext.emaAlignment === 'bullish_stack') {
    items.push(item(F_EMA_BULLISH_ALIGNMENT, 'high',
      'EMA20 > EMA50 > EMA100 > EMA200 — full bullish EMA stack', 'indicators', 'bullish'))
  }
  if (emaContext.emaAlignment === 'bearish_stack') {
    items.push(item(F_EMA_BEARISH_ALIGNMENT, 'high',
      'EMA20 < EMA50 < EMA100 < EMA200 — full bearish EMA stack', 'indicators', 'bearish'))
  }
  if (emaContext.confluenceZones.length > 0) {
    const zone = emaContext.confluenceZones[0]
    items.push(item(F_EMA_CONFLUENCE_ZONE, 'medium',
      `EMA${zone.emaPeriods.join('/')} clustered within ${cfg.emaConfluencePercent}% at ${zone.centerPrice.toFixed(2)} — strong dynamic level`,
      'indicators', 'neutral'))
  }

  // ── Market structure evidence ──────────────────────────────────────────────
  if (conditions.hasConsistentHHHL) {
    items.push(item(F_HIGHER_HIGH, 'high',
      `${marketStructure.recentStructure.higherHighs} Higher Highs detected (recent window)`, 'market_structure', 'bullish'))
    items.push(item(F_HIGHER_LOW, 'high',
      `${marketStructure.recentStructure.higherLows} Higher Lows detected (recent window)`, 'market_structure', 'bullish'))
  }
  if (conditions.hasConsistentLHLL) {
    items.push(item(F_LOWER_HIGH, 'high',
      `${marketStructure.recentStructure.lowerHighs} Lower Highs detected (recent window)`, 'market_structure', 'bearish'))
    items.push(item(F_LOWER_LOW, 'high',
      `${marketStructure.recentStructure.lowerLows} Lower Lows detected (recent window)`, 'market_structure', 'bearish'))
  }
  if (marketStructure.bos.last?.direction === 'bullish') {
    items.push(item(F_BULLISH_BOS, 'high',
      `Bullish Break of Structure at ${marketStructure.bos.last.level.toFixed(2)}`, 'market_structure', 'bullish'))
  }
  if (marketStructure.bos.last?.direction === 'bearish') {
    items.push(item(F_BEARISH_BOS, 'high',
      `Bearish Break of Structure at ${marketStructure.bos.last.level.toFixed(2)}`, 'market_structure', 'bearish'))
  }
  if (marketStructure.choch.last?.direction === 'bullish') {
    items.push(item(F_BULLISH_CHOCH, 'high',
      `Bullish Change of Character at ${marketStructure.choch.last.level.toFixed(2)} — potential reversal signal`, 'market_structure', 'bullish'))
  }
  if (marketStructure.choch.last?.direction === 'bearish') {
    items.push(item(F_BEARISH_CHOCH, 'high',
      `Bearish Change of Character at ${marketStructure.choch.last.level.toFixed(2)} — potential reversal signal`, 'market_structure', 'bearish'))
  }
  if (marketStructure.consolidation.detected) {
    items.push(item(F_MARKET_CONSOLIDATION, 'medium',
      `Price consolidated within ${marketStructure.consolidation.rangePercent?.toFixed(2) ?? '?'}% range over ${marketStructure.consolidation.barsInRange} bars`,
      'market_structure', 'neutral'))
  }
  if (marketStructure.breakout.confirmed) {
    const breakoutDir: EvidenceItem['direction'] = marketStructure.breakout.direction === 'bearish' ? 'bearish' : 'bullish'
    const breakoutFactor = breakoutDir === 'bullish' ? F_BULLISH_BREAKOUT : F_BEARISH_BREAKOUT
    items.push(item(breakoutFactor, 'high',
      `Confirmed ${marketStructure.breakout.direction ?? ''} breakout at ${marketStructure.breakout.level?.toFixed(2) ?? '?'}`,
      'market_structure', breakoutDir))
  }
  if (marketStructure.breakout.failed) {
    items.push(item(F_FAILED_BREAKOUT, 'medium',
      `Breakout attempted at ${marketStructure.breakout.level?.toFixed(2) ?? '?'} but reversed — trap signal`,
      'market_structure', 'neutral'))
  }
  if (marketStructure.pullback.detected) {
    items.push(item(F_ACTIVE_PULLBACK, 'medium',
      `Pullback in progress — depth ratio ${marketStructure.pullback.depth?.toFixed(2) ?? '?'}`,
      'market_structure', 'neutral'))
  }

  // ── RSI evidence ──────────────────────────────────────────────────────────
  // Overbought/oversold take priority — they subsume the bullish/bearish support signals
  // to prevent double-counting (e.g. RSI=75 simultaneously emitting +7 and -10).
  if (indicatorSummary.rsi.value !== null) {
    if (indicatorSummary.rsi.classification === 'overbought') {
      items.push(item(F_RSI_OVERBOUGHT, 'medium',
        `RSI ${indicatorSummary.rsi.value.toFixed(1)} is overbought — potential exhaustion risk`, 'indicators', 'bearish'))
    } else if (indicatorSummary.rsi.classification === 'oversold') {
      items.push(item(F_RSI_OVERSOLD, 'medium',
        `RSI ${indicatorSummary.rsi.value.toFixed(1)} is oversold — potential reversal setup`, 'indicators', 'bullish'))
    } else if (conditions.rsiSupportsBullish && conditions.rsiSupportsBearish) {
      items.push(item(F_RSI_NEUTRAL_OVERLAP, 'medium',
        `RSI ${indicatorSummary.rsi.value.toFixed(1)} satisfies both bullish (≥${cfg.rsiBullishMin}) and bearish (≤${cfg.rsiBearishMax}) thresholds — momentum is neutral and contributes one point to each direction`,
        'indicators', 'neutral'))
    } else if (conditions.rsiSupportsBullish) {
      items.push(item(F_RSI_SUPPORTS_BULLISH, 'medium',
        `RSI ${indicatorSummary.rsi.value.toFixed(1)} ≥ ${cfg.rsiBullishMin} — momentum supports bullish bias`, 'indicators', 'bullish'))
    } else if (conditions.rsiSupportsBearish) {
      items.push(item(F_RSI_SUPPORTS_BEARISH, 'medium',
        `RSI ${indicatorSummary.rsi.value.toFixed(1)} ≤ ${cfg.rsiBearishMax} — momentum supports bearish bias`, 'indicators', 'bearish'))
    } else {
      items.push(item(F_RSI_NEUTRAL, 'low',
        `RSI ${indicatorSummary.rsi.value.toFixed(1)} — neutral momentum`, 'indicators', 'neutral'))
    }
  }

  // ── MACD evidence ─────────────────────────────────────────────────────────
  if (indicatorSummary.macd.bias === 'bullish') {
    items.push(item(F_MACD_BULLISH, 'medium',
      `MACD line above signal line (histogram ${indicatorSummary.macd.histogram?.toFixed(4) ?? '?'})`, 'indicators', 'bullish'))
  }
  if (indicatorSummary.macd.bias === 'bearish') {
    items.push(item(F_MACD_BEARISH, 'medium',
      `MACD line below signal line (histogram ${indicatorSummary.macd.histogram?.toFixed(4) ?? '?'})`, 'indicators', 'bearish'))
  }

  // ── ADX evidence ──────────────────────────────────────────────────────────
  if (indicatorSummary.adx.adx !== null && indicatorSummary.adx.adx >= cfg.adxStrongThreshold) {
    items.push(item(F_ADX_ABOVE_25, 'medium',
      `ADX ${indicatorSummary.adx.adx.toFixed(1)} — ${indicatorSummary.adx.trendStrength.replace('_', ' ')} trend momentum`, 'indicators', 'neutral'))
  }
  if (conditions.adxBelowWeakThreshold && indicatorSummary.adx.adx !== null) {
    items.push(item(F_ADX_TREND_WEAK, 'low',
      `ADX ${indicatorSummary.adx.adx.toFixed(1)} < ${cfg.adxWeakThreshold} — trend momentum is weak`, 'indicators', 'neutral'))
  }

  // ── Bollinger Bands evidence ───────────────────────────────────────────────
  if (indicatorSummary.bollinger.bandwidthState === 'squeeze') {
    items.push(item(F_BOLLINGER_SQUEEZE, 'medium',
      'Bollinger Bands in squeeze — breakout likely approaching', 'indicators', 'neutral'))
  }
  if (indicatorSummary.bollinger.bandwidthState === 'expansion') {
    items.push(item(F_BOLLINGER_EXPANSION, 'medium',
      'Bollinger Bands expanding — volatility increasing, trend accelerating', 'indicators', 'neutral'))
  }
  if (indicatorSummary.bollinger.priceRelativeToBands === 'above_upper') {
    items.push(item(F_PRICE_AT_BOLLINGER_UPPER, 'medium',
      'Price above the upper Bollinger Band — near overbought territory', 'indicators', 'bearish'))
  }
  if (indicatorSummary.bollinger.priceRelativeToBands === 'below_lower') {
    items.push(item(F_PRICE_AT_BOLLINGER_LOWER, 'medium',
      'Price below the lower Bollinger Band — near oversold territory', 'indicators', 'bullish'))
  }

  // ── StochRSI evidence ─────────────────────────────────────────────────────
  if (indicatorSummary.stochRsi.zone === 'overbought') {
    items.push(item(F_STOCHRSI_OVERBOUGHT, 'low',
      `StochRSI K ${indicatorSummary.stochRsi.k != null ? (indicatorSummary.stochRsi.k * 100).toFixed(1) : '?'} ≥ ${(cfg.stochRsiOverboughtThreshold * 100).toFixed(0)} — overbought`, 'indicators', 'bearish'))
  }
  if (indicatorSummary.stochRsi.zone === 'oversold') {
    items.push(item(F_STOCHRSI_OVERSOLD, 'low',
      `StochRSI K ${indicatorSummary.stochRsi.k != null ? (indicatorSummary.stochRsi.k * 100).toFixed(1) : '?'} ≤ ${(cfg.stochRsiOversoldThreshold * 100).toFixed(0)} — oversold`, 'indicators', 'bullish'))
  }

  // ── S/R evidence ──────────────────────────────────────────────────────────
  if (srContext.insideSupport) {
    items.push(item(F_PRICE_AT_SUPPORT, 'high',
      `Price is inside an active support zone (strength ${srContext.strongestActiveSupport?.strength?.toFixed(1) ?? '?'}/10)`,
      'support_resistance', 'bullish'))
  }
  if (srContext.insideResistance) {
    items.push(item(F_PRICE_AT_RESISTANCE, 'high',
      `Price is inside an active resistance zone — supply overhead`,
      'support_resistance', 'bearish'))
  }
  if (srContext.approachingSupport && !srContext.insideSupport && srContext.nearestSupportDistance !== null) {
    items.push(item(F_STRONG_SUPPORT_BELOW, 'medium',
      `Active support zone ${srContext.nearestSupportDistance.toFixed(2)}% below current price`,
      'support_resistance', 'bullish'))
  }
  if (srContext.approachingResistance && !srContext.insideResistance && srContext.nearestResistanceDistance !== null) {
    items.push(item(F_STRONG_RESISTANCE_ABOVE, 'medium',
      `Active resistance zone ${srContext.nearestResistanceDistance.toFixed(2)}% above current price`,
      'support_resistance', 'bearish'))
  }
  if (srContext.strongestActiveSupport !== null && !srContext.insideSupport && !srContext.approachingSupport) {
    items.push(item(F_ACTIVE_SUPPORT_ZONE, 'low',
      `Active support zone at ${srContext.strongestActiveSupport.center.toFixed(2)} (strength ${srContext.strongestActiveSupport.strength.toFixed(1)}/10)`,
      'support_resistance', 'bullish'))
  }
  if (srContext.strongestActiveResistance !== null && !srContext.insideResistance && !srContext.approachingResistance) {
    items.push(item(F_STRONG_RESISTANCE_OVERHEAD, 'low',
      `Active resistance zone at ${srContext.strongestActiveResistance.center.toFixed(2)} (strength ${srContext.strongestActiveResistance.strength.toFixed(1)}/10)`,
      'support_resistance', 'bearish'))
  }

  // ── Volume evidence ───────────────────────────────────────────────────────
  if (volumeContext.confirmsCurrentMove) {
    const isBullishTrend = fullTrend.trend.includes('bullish')
    const isBearishTrend = fullTrend.trend.includes('bearish')
    if (isBullishTrend) {
      items.push(item(F_STRONG_BULLISH_VOLUME, 'high',
        `Volume at ${volumeContext.relativeVolume.toFixed(2)}× average confirms the bullish price move`, 'volume', 'bullish'))
    } else if (isBearishTrend) {
      items.push(item(F_STRONG_BEARISH_VOLUME, 'high',
        `Volume at ${volumeContext.relativeVolume.toFixed(2)}× average confirms the bearish price move`, 'volume', 'bearish'))
    } else {
      items.push(item(F_STRONG_VOLUME, 'high',
        `Volume at ${volumeContext.relativeVolume.toFixed(2)}× average confirms the current price move`, 'volume', 'neutral'))
    }
  }
  if (!volumeContext.confirmsCurrentMove
      && volumeContext.volumeClassification !== 'high'
      && volumeContext.volumeClassification !== 'very_high') {
    items.push(item(F_BELOW_AVERAGE_VOLUME, 'medium',
      `Volume at ${volumeContext.relativeVolume.toFixed(2)}× average — move lacks volume confirmation`, 'volume', 'neutral'))
  }
  if (volumeContext.climaxSignal === 'buying_climax') {
    items.push(item(F_VOLUME_CLIMAX_BUYING, 'high',
      'Buying climax detected — high-volume bullish candle near multi-bar high; possible exhaustion', 'volume', 'bearish'))
  }
  if (volumeContext.climaxSignal === 'selling_climax') {
    items.push(item(F_VOLUME_CLIMAX_SELLING, 'high',
      'Selling climax detected — high-volume bearish candle near multi-bar low; possible exhaustion', 'volume', 'bullish'))
  }
  if (volumeContext.climaxSignal === 'exhaustion') {
    items.push(item(F_VOLUME_EXHAUSTION, 'medium',
      'Volume exhaustion candle — high volume with small body; supply and demand in equilibrium', 'volume', 'neutral'))
  }
  if (volumeContext.accDistState === 'accumulation') {
    items.push(item(F_ACCUMULATION, 'high',
      'Multiple signals indicate accumulation — smart money positioning long', 'volume', 'bullish'))
  }
  if (volumeContext.accDistState === 'distribution') {
    items.push(item(F_DISTRIBUTION, 'high',
      'Multiple signals indicate distribution — smart money exiting long positions', 'volume', 'bearish'))
  }
  if (volumeContext.obvConfirmingPrice) {
    if (volumeContext.obvDirection === 'bullish') {
      items.push(item(F_BULLISH_OBV, 'medium',
        'OBV trending in same direction as price — volume flow confirms bullish move', 'volume', 'bullish'))
    } else if (volumeContext.obvDirection === 'bearish') {
      items.push(item(F_BEARISH_OBV, 'medium',
        'OBV trending in same direction as price — volume flow confirms bearish move', 'volume', 'bearish'))
    }
    // neutral OBV direction: volume flow has no directional conviction — no signal emitted
  }
  if (volumeContext.obvDirection === 'bearish' && !volumeContext.obvConfirmingPrice) {
    items.push(item(F_OBV_DIVERGING, 'medium',
      'OBV trending opposite to price — hidden divergence warning', 'volume', 'bearish'))
  }
  if (volumeContext.obvDirection === 'bullish' && !volumeContext.obvConfirmingPrice) {
    items.push(item(F_OBV_DIVERGING_BULLISH, 'medium',
      'OBV rising while price falls — potential bullish reversal signal', 'volume', 'bullish'))
  }
  if (!volumeContext.respectingVWAP) {
    if (volumeContext.priceAboveVWAP) {
      items.push(item(F_PRICE_ABOVE_VWAP, 'low',
        `Price is ${volumeContext.vwapDistancePercent.toFixed(2)}% above VWAP`, 'volume', 'bullish'))
    } else {
      items.push(item(F_PRICE_BELOW_VWAP, 'low',
        `Price is ${Math.abs(volumeContext.vwapDistancePercent).toFixed(2)}% below VWAP`, 'volume', 'bearish'))
    }
  }
  if (volumeContext.volumeClassification === 'very_high' || volumeContext.volumeClassification === 'high') {
    items.push(item(F_HIGH_RELATIVE_VOLUME, 'medium',
      `Relative volume ${volumeContext.relativeVolume.toFixed(2)}× (${volumeContext.volumeClassification.replace('_', ' ')})`, 'volume', 'neutral'))
  }
  if (volumeContext.volumeClassification === 'very_low' || volumeContext.volumeClassification === 'low') {
    items.push(item(F_LOW_RELATIVE_VOLUME, 'medium',
      `Relative volume ${volumeContext.relativeVolume.toFixed(2)}× (${volumeContext.volumeClassification.replace('_', ' ')}) — low participation`, 'volume', 'neutral'))
  }

  // Sort: high first, then medium, then low
  return items.sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
}
