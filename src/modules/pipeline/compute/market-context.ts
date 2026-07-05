import type { MarketAnalysisResult } from '../../analysis/types'
import type { MarketContext, MarketPhase } from '../types'

/**
 * Classifies the current market phase from existing analysis data.
 * Checks breakout → reversal → consolidation → pullback → directional → ranging,
 * in that priority order.
 */
export function computeMarketContext(analysis: MarketAnalysisResult): MarketContext {
  const { fullTrend, marketStructure: ms, volumeContext, indicatorSummary, price } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')
  const adxStrength = indicatorSummary.adx.trendStrength
  const isStrongADX = adxStrength === 'strong' || adxStrength === 'very_strong' || adxStrength === 'extreme'

  // ── Volatility ───────────────────────────────────────────────────────────────
  let volatility: MarketContext['volatility']
  if (
    (price.atrPercent !== null && price.atrPercent > 5) ||
    indicatorSummary.bollinger.bandwidthState === 'expansion'
  ) {
    volatility = 'high'
  } else if (
    indicatorSummary.bollinger.bandwidthState === 'squeeze' ||
    (price.atrPercent !== null && price.atrPercent < 1)
  ) {
    volatility = 'low'
  } else {
    volatility = 'normal'
  }

  // ── Secondary phases ─────────────────────────────────────────────────────────
  const secondaryPhases: MarketPhase[] = []

  // ── Primary phase (priority order) ──────────────────────────────────────────
  let phase: MarketPhase

  if (ms.breakout.confirmed) {
    phase = 'breakout'
    if (isBullish) secondaryPhases.push('trending_bullish')
    else if (isBearish) secondaryPhases.push('trending_bearish')

  } else if (ms.choch.detected) {
    phase = 'reversal_attempt'
    if (isBullish) secondaryPhases.push('trending_bullish')
    else if (isBearish) secondaryPhases.push('trending_bearish')

  } else if (ms.consolidation.detected) {
    phase = 'consolidation'

  } else if (ms.pullback.detected && (isBullish || isBearish)) {
    phase = 'pullback'
    secondaryPhases.push(isBullish ? 'trending_bullish' : 'trending_bearish')

  } else if (trend === 'ranging') {
    const accDist = volumeContext.accDistState
    if (
      accDist === 'distribution' ||
      volumeContext.climaxSignal === 'selling_climax'
    ) {
      phase = 'distribution'
      secondaryPhases.push('ranging')
    } else if (
      accDist === 'accumulation' ||
      volumeContext.climaxSignal === 'buying_climax'
    ) {
      phase = 'accumulation'
      secondaryPhases.push('ranging')
    } else {
      phase = 'ranging'
    }

  } else if (isBullish) {
    // Buying climax in an uptrend → distribution topping
    if (volumeContext.climaxSignal === 'buying_climax' && isStrongADX) {
      phase = 'distribution'
      secondaryPhases.push('trending_bullish')
    } else {
      phase = 'trending_bullish'
    }

  } else if (isBearish) {
    // Selling climax in a downtrend → accumulation bottoming
    if (volumeContext.climaxSignal === 'selling_climax' && isStrongADX) {
      phase = 'accumulation'
      secondaryPhases.push('trending_bearish')
    } else {
      phase = 'trending_bearish'
    }

  } else {
    phase = 'ranging'
  }

  const isTrending =
    phase === 'trending_bullish' ||
    phase === 'trending_bearish' ||
    secondaryPhases.includes('trending_bullish') ||
    secondaryPhases.includes('trending_bearish')

  // ── Description ──────────────────────────────────────────────────────────────
  const phaseDescriptions: Record<MarketPhase, string> = {
    trending_bullish:   'Market is in an established uptrend with consistent bullish structure',
    trending_bearish:   'Market is in an established downtrend with consistent bearish structure',
    ranging:            'Price is moving sideways without a clear directional bias',
    consolidation:      'Price is consolidating in a tight range, building energy for the next move',
    breakout:           'Price has broken out of a previous range with volume confirmation',
    pullback:           'Market is pulling back within the established trend — a potential re-entry point',
    reversal_attempt:   'Market structure has changed character, suggesting a potential trend reversal',
    distribution:       'High-volume selling activity indicates potential distribution by larger participants',
    accumulation:       'High-volume buying at key lows indicates potential accumulation by larger participants',
  }

  let description = phaseDescriptions[phase]
  if (volatility === 'high') description += ' with elevated volatility'
  else if (volatility === 'low') description += ' with compressed volatility'

  return { phase, secondaryPhases, description, volatility, isTrending }
}
