import type { MarketAnalysisResult } from '../../analysis/types'
import type { IndicatorReliabilityContext } from '../types'

/**
 * Computes context-sensitive indicator reliability modifiers.
 *
 * Key insight: oscillators (RSI, MACD) are most useful in ranging markets where
 * they correctly identify overbought/oversold levels. In strong trends they
 * often stay at extreme readings for extended periods and are less actionable.
 * Trend-following indicators (EMAs, structure) are most reliable in trending markets.
 */
export function computeReliability(analysis: MarketAnalysisResult): IndicatorReliabilityContext {
  const { indicatorSummary, fullTrend, volumeContext } = analysis
  const trend = fullTrend.trend
  const adxStrength = indicatorSummary.adx.trendStrength

  const isStrongTrend    = trend === 'strong bullish' || trend === 'strong bearish'
  const isModerate       = trend === 'moderate bullish' || trend === 'moderate bearish'
  const isRanging        = trend === 'ranging'
  const adxWeak          = adxStrength === 'weak' || adxStrength === 'unavailable'

  // EMA/structure signals are most reliable in strong trends
  const trendReliability: number =
    isStrongTrend ? 9 :
    isModerate    ? 7 :
    isRanging     ? 4 : 6

  // Oscillators more useful in ranging/weak-ADX environments
  const oscillatorReliability: number =
    isRanging && adxWeak ? 8 :
    adxWeak              ? 7 :
    isStrongTrend        ? 4 : 6

  // Volume reliability depends on volume activity
  const volClass = volumeContext.volumeClassification
  const volumeReliability: number =
    volClass === 'very_low' ? 3 :
    volClass === 'low'      ? 5 : 8

  let note: string
  if (isStrongTrend && !adxWeak) {
    note = 'Strong trend — EMA/structure signals are most reliable; RSI/MACD may show sustained extreme readings'
  } else if (isRanging && adxWeak) {
    note = 'Ranging market with weak ADX — oscillators (RSI, MACD) are more reliable than trend-following indicators'
  } else if (adxWeak) {
    note = 'Weak trend strength — oscillators are relatively more reliable than EMA signals'
  } else {
    note = 'Mixed conditions — confirm signals across multiple indicator types'
  }

  return { trendReliability, oscillatorReliability, volumeReliability, note }
}
