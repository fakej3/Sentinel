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

function item(
  factor: string,
  impact: EvidenceItem['impact'],
  description: string,
  source: EvidenceItem['source'],
): EvidenceItem {
  return { factor, impact, description, source }
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
    items.push(item('Price above EMA200', 'high',
      `Price is above the EMA200 (${indicators.ema200?.toFixed(2)}) — major long-term bullish bias`, 'indicators'))
  }
  if (conditions.priceBelowEMA200) {
    items.push(item('Price below EMA200', 'high',
      `Price is below the EMA200 (${indicators.ema200?.toFixed(2)}) — major long-term bearish bias`, 'indicators'))
  }
  if (conditions.priceAboveEMA100) {
    items.push(item('Price above EMA100', 'medium',
      `Price is above the EMA100 (${indicators.ema100?.toFixed(2)})`, 'indicators'))
  }
  if (conditions.priceBelowEMA100) {
    items.push(item('Price below EMA100', 'medium',
      `Price is below the EMA100 (${indicators.ema100?.toFixed(2)})`, 'indicators'))
  }
  if (conditions.priceAboveEMA50) {
    items.push(item('Price above EMA50', 'medium',
      `Price is above the EMA50 (${indicators.ema50?.toFixed(2)})`, 'indicators'))
  }
  if (conditions.priceBelowEMA50) {
    items.push(item('Price below EMA50', 'medium',
      `Price is below the EMA50 (${indicators.ema50?.toFixed(2)})`, 'indicators'))
  }
  if (conditions.priceAboveEMA20) {
    items.push(item('Price above EMA20', 'low',
      `Price is above the EMA20 (${indicators.ema20?.toFixed(2)})`, 'indicators'))
  }
  if (conditions.priceBelowEMA20) {
    items.push(item('Price below EMA20', 'low',
      `Price is below the EMA20 (${indicators.ema20?.toFixed(2)})`, 'indicators'))
  }

  // ── EMA alignment ─────────────────────────────────────────────────────────
  if (emaContext.emaAlignment === 'bullish_stack') {
    items.push(item('EMA bullish alignment', 'high',
      'EMA20 > EMA50 > EMA100 > EMA200 — full bullish EMA stack', 'indicators'))
  }
  if (emaContext.emaAlignment === 'bearish_stack') {
    items.push(item('EMA bearish alignment', 'high',
      'EMA20 < EMA50 < EMA100 < EMA200 — full bearish EMA stack', 'indicators'))
  }
  if (emaContext.confluenceZones.length > 0) {
    const zone = emaContext.confluenceZones[0]
    items.push(item('EMA confluence zone', 'medium',
      `EMA${zone.emaPeriods.join('/')} clustered within ${cfg.emaConfluencePercent}% at ${zone.centerPrice.toFixed(2)} — strong dynamic level`,
      'indicators'))
  }

  // ── Market structure evidence ──────────────────────────────────────────────
  if (conditions.hasConsistentHHHL) {
    items.push(item('Higher High confirmed', 'high',
      `${marketStructure.structure.higherHighs} Higher Highs detected`, 'market_structure'))
    items.push(item('Higher Low confirmed', 'high',
      `${marketStructure.structure.higherLows} Higher Lows detected`, 'market_structure'))
  }
  if (conditions.hasConsistentLHLL) {
    items.push(item('Lower High confirmed', 'high',
      `${marketStructure.structure.lowerHighs} Lower Highs detected`, 'market_structure'))
    items.push(item('Lower Low confirmed', 'high',
      `${marketStructure.structure.lowerLows} Lower Lows detected`, 'market_structure'))
  }
  if (marketStructure.bos.last?.direction === 'bullish') {
    items.push(item('Bullish BOS', 'high',
      `Bullish Break of Structure at ${marketStructure.bos.last.level.toFixed(2)}`, 'market_structure'))
  }
  if (marketStructure.bos.last?.direction === 'bearish') {
    items.push(item('Bearish BOS', 'high',
      `Bearish Break of Structure at ${marketStructure.bos.last.level.toFixed(2)}`, 'market_structure'))
  }
  if (marketStructure.choch.last?.direction === 'bullish') {
    items.push(item('Bullish CHoCH', 'high',
      `Bullish Change of Character at ${marketStructure.choch.last.level.toFixed(2)} — potential reversal signal`, 'market_structure'))
  }
  if (marketStructure.choch.last?.direction === 'bearish') {
    items.push(item('Bearish CHoCH', 'high',
      `Bearish Change of Character at ${marketStructure.choch.last.level.toFixed(2)} — potential reversal signal`, 'market_structure'))
  }
  if (marketStructure.consolidation.detected) {
    items.push(item('Market in consolidation', 'medium',
      `Price consolidated within ${marketStructure.consolidation.rangePercent?.toFixed(2) ?? '?'}% range over ${marketStructure.consolidation.barsInRange} bars`,
      'market_structure'))
  }
  if (marketStructure.breakout.detected && marketStructure.breakout.confirmed) {
    items.push(item('Breakout confirmed', 'high',
      `Confirmed ${marketStructure.breakout.direction ?? ''} breakout at ${marketStructure.breakout.level?.toFixed(2) ?? '?'}`,
      'market_structure'))
  }
  if (marketStructure.breakout.detected && !marketStructure.breakout.confirmed) {
    items.push(item('Failed breakout', 'medium',
      `Breakout attempted at ${marketStructure.breakout.level?.toFixed(2) ?? '?'} but reversed — trap signal`,
      'market_structure'))
  }
  if (marketStructure.pullback.active) {
    items.push(item('Active pullback', 'medium',
      `Pullback in progress — depth ratio ${marketStructure.pullback.depth?.toFixed(2) ?? '?'}`,
      'market_structure'))
  }

  // ── RSI evidence ──────────────────────────────────────────────────────────
  if (conditions.rsiSupportsBullish && indicatorSummary.rsi.value !== null) {
    items.push(item('RSI supports bullish', 'medium',
      `RSI ${indicatorSummary.rsi.value.toFixed(1)} ≥ ${cfg.rsiBullishMin} — momentum supports bullish bias`, 'indicators'))
  }
  if (!conditions.rsiSupportsBullish && !conditions.rsiSupportsBearish && indicatorSummary.rsi.value !== null) {
    items.push(item('RSI neutral', 'low',
      `RSI ${indicatorSummary.rsi.value.toFixed(1)} — neutral momentum`, 'indicators'))
  }
  if (indicatorSummary.rsi.classification === 'overbought') {
    items.push(item('Overbought RSI (>70)', 'medium',
      `RSI ${indicatorSummary.rsi.value?.toFixed(1)} is overbought — potential exhaustion risk`, 'indicators'))
  }
  if (indicatorSummary.rsi.classification === 'oversold') {
    items.push(item('Oversold RSI (<30)', 'medium',
      `RSI ${indicatorSummary.rsi.value?.toFixed(1)} is oversold — potential reversal setup`, 'indicators'))
  }
  if (indicatorSummary.rsi.classification === 'weak_bearish') {
    items.push(item('RSI in 30–45 range', 'medium',
      `RSI ${indicatorSummary.rsi.value?.toFixed(1)} in weak/bearish zone — bearish momentum`, 'indicators'))
  }
  if (indicatorSummary.rsi.classification === 'healthy_bullish') {
    items.push(item('RSI in 55–70 range', 'medium',
      `RSI ${indicatorSummary.rsi.value?.toFixed(1)} in healthy bullish zone`, 'indicators'))
  }

  // ── MACD evidence ─────────────────────────────────────────────────────────
  if (indicatorSummary.macd.bias === 'bullish') {
    items.push(item('MACD bullish bias', 'medium',
      `MACD line above signal line (histogram ${indicatorSummary.macd.histogram?.toFixed(4) ?? '?'})`, 'indicators'))
  }
  if (indicatorSummary.macd.bias === 'bearish') {
    items.push(item('MACD bearish bias', 'medium',
      `MACD line below signal line (histogram ${indicatorSummary.macd.histogram?.toFixed(4) ?? '?'})`, 'indicators'))
  }

  // ── ADX evidence ──────────────────────────────────────────────────────────
  if (indicatorSummary.adx.adx !== null && indicatorSummary.adx.adx >= cfg.adxStrongThreshold) {
    items.push(item('ADX above 25', 'medium',
      `ADX ${indicatorSummary.adx.adx.toFixed(1)} — ${indicatorSummary.adx.trendStrength.replace('_', ' ')} trend momentum`, 'indicators'))
  }
  if (conditions.adxBelowWeakThreshold && indicatorSummary.adx.adx !== null) {
    items.push(item('ADX trend weak', 'low',
      `ADX ${indicatorSummary.adx.adx.toFixed(1)} < ${cfg.adxWeakThreshold} — trend momentum is weak`, 'indicators'))
  }

  // ── Bollinger Bands evidence ───────────────────────────────────────────────
  if (indicatorSummary.bollinger.bandwidthState === 'squeeze') {
    items.push(item('Bollinger squeeze', 'medium',
      'Bollinger Bands in squeeze — breakout likely approaching', 'indicators'))
  }
  if (indicatorSummary.bollinger.bandwidthState === 'expansion') {
    items.push(item('Bollinger expansion', 'medium',
      'Bollinger Bands expanding — volatility increasing, trend accelerating', 'indicators'))
  }
  if (indicatorSummary.bollinger.priceRelativeToBands === 'above_upper') {
    items.push(item('Price at Bollinger upper', 'medium',
      'Price above the upper Bollinger Band — near overbought territory', 'indicators'))
  }
  if (indicatorSummary.bollinger.priceRelativeToBands === 'below_lower') {
    items.push(item('Price at Bollinger lower', 'medium',
      'Price below the lower Bollinger Band — near oversold territory', 'indicators'))
  }

  // ── StochRSI evidence ─────────────────────────────────────────────────────
  if (indicatorSummary.stochRsi.zone === 'overbought') {
    items.push(item('StochRSI overbought', 'low',
      `StochRSI K ${indicatorSummary.stochRsi.k?.toFixed(1)} ≥ ${cfg.stochRsiOverboughtThreshold} — overbought`, 'indicators'))
  }
  if (indicatorSummary.stochRsi.zone === 'oversold') {
    items.push(item('StochRSI oversold', 'low',
      `StochRSI K ${indicatorSummary.stochRsi.k?.toFixed(1)} ≤ ${cfg.stochRsiOversoldThreshold} — oversold`, 'indicators'))
  }

  // ── S/R evidence ──────────────────────────────────────────────────────────
  if (srContext.insideSupport) {
    items.push(item('Price at active support', 'high',
      `Price is inside an active support zone (strength ${srContext.strongestActiveSupport?.strength?.toFixed(1) ?? '?'}/10)`,
      'support_resistance'))
  }
  if (srContext.insideResistance) {
    items.push(item('Price at active resistance', 'high',
      `Price is inside an active resistance zone — supply overhead`,
      'support_resistance'))
  }
  if (srContext.approachingSupport && !srContext.insideSupport && srContext.nearestSupportDistance !== null) {
    items.push(item('Strong support below', 'medium',
      `Active support zone ${srContext.nearestSupportDistance.toFixed(2)}% below current price`,
      'support_resistance'))
  }
  if (srContext.approachingResistance && !srContext.insideResistance && srContext.nearestResistanceDistance !== null) {
    items.push(item('Strong resistance above', 'medium',
      `Active resistance zone ${srContext.nearestResistanceDistance.toFixed(2)}% above current price`,
      'support_resistance'))
  }
  if (srContext.strongestActiveSupport !== null && !srContext.insideSupport && !srContext.approachingSupport) {
    items.push(item('Active support zone', 'low',
      `Active support zone at ${srContext.strongestActiveSupport.center.toFixed(2)} (strength ${srContext.strongestActiveSupport.strength.toFixed(1)}/10)`,
      'support_resistance'))
  }
  if (srContext.strongestActiveResistance !== null && !srContext.insideResistance && !srContext.approachingResistance) {
    items.push(item('Strong resistance overhead', 'low',
      `Active resistance zone at ${srContext.strongestActiveResistance.center.toFixed(2)} (strength ${srContext.strongestActiveResistance.strength.toFixed(1)}/10)`,
      'support_resistance'))
  }

  // ── Volume evidence ───────────────────────────────────────────────────────
  if (volumeContext.confirmsCurrentMove) {
    items.push(item('Strong volume confirmation', 'high',
      `Volume at ${volumeContext.relativeVolume.toFixed(2)}× average confirms the current price move`, 'volume'))
  }
  if (!volumeContext.confirmsCurrentMove) {
    items.push(item('Below average volume on move', 'medium',
      `Volume at ${volumeContext.relativeVolume.toFixed(2)}× average — move lacks volume confirmation`, 'volume'))
  }
  if (volumeContext.climaxSignal === 'buying_climax') {
    items.push(item('Volume climax buying', 'high',
      'Buying climax detected — high-volume bullish candle near multi-bar high; possible exhaustion', 'volume'))
  }
  if (volumeContext.climaxSignal === 'selling_climax') {
    items.push(item('Volume climax selling', 'high',
      'Selling climax detected — high-volume bearish candle near multi-bar low; possible exhaustion', 'volume'))
  }
  if (volumeContext.climaxSignal === 'exhaustion') {
    items.push(item('Volume exhaustion', 'medium',
      'Volume exhaustion candle — high volume with small body; supply and demand in equilibrium', 'volume'))
  }
  if (volumeContext.accDistState === 'accumulation') {
    items.push(item('Accumulation detected', 'high',
      'Multiple signals indicate accumulation — smart money positioning long', 'volume'))
  }
  if (volumeContext.accDistState === 'distribution') {
    items.push(item('Distribution detected', 'high',
      'Multiple signals indicate distribution — smart money exiting long positions', 'volume'))
  }
  if (volumeContext.obvConfirmingPrice) {
    items.push(item('Bullish OBV trend', 'medium',
      'OBV trending in same direction as price — volume flow confirms move', 'volume'))
  }
  if (volumeContext.obvDirection === 'bearish' && !volumeContext.obvConfirmingPrice) {
    items.push(item('OBV diverging from price', 'medium',
      'OBV trending opposite to price — hidden divergence warning', 'volume'))
  }
  if (volumeContext.priceAboveVWAP) {
    items.push(item('Price above VWAP', 'low',
      `Price is ${volumeContext.vwapDistancePercent.toFixed(2)}% above VWAP — bullish intraday positioning`, 'volume'))
  } else {
    items.push(item('Price below VWAP', 'low',
      `Price is ${Math.abs(volumeContext.vwapDistancePercent).toFixed(2)}% below VWAP — bearish intraday positioning`, 'volume'))
  }
  if (volumeContext.volumeClassification === 'very_high' || volumeContext.volumeClassification === 'high') {
    items.push(item('High relative volume', 'medium',
      `Relative volume ${volumeContext.relativeVolume.toFixed(2)}× (${volumeContext.volumeClassification.replace('_', ' ')})`, 'volume'))
  }
  if (volumeContext.volumeClassification === 'very_low' || volumeContext.volumeClassification === 'low') {
    items.push(item('Low relative volume', 'medium',
      `Relative volume ${volumeContext.relativeVolume.toFixed(2)}× (${volumeContext.volumeClassification.replace('_', ' ')}) — low participation`, 'volume'))
  }

  // Sort: high first, then medium, then low
  return items.sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
}
