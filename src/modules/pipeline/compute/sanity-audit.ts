import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { TradeDecision, ConfidenceSanityResult, SanityFlag } from '../types'

/**
 * Internal diagnostic layer — detects suspicious or inconsistent situations.
 * DOES NOT modify confidence scores or decisions.
 * Pure observability: flags → consumed by UI and writer for transparency.
 */
export function computeSanityAudit(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  decision: TradeDecision,
): ConfidenceSanityResult {
  const flags: SanityFlag[] = []
  const { score, analysisQuality } = confidence
  const trend = analysis.fullTrend.trend
  const adxStrength = analysis.indicatorSummary.adx.trendStrength
  const contradictions = analysisQuality.contradictions

  // Flag 1: Strong trend + low confidence
  const isDirectional = trend.includes('strong') || trend.includes('moderate')
  if (isDirectional && score < 4.5) {
    flags.push({
      type: 'strong_trend_low_confidence',
      description: `Trend is "${trend}" but confidence is only ${score.toFixed(1)}/10 — evidence may be contradictory or sparse.`,
    })
  }

  // Flag 2: Ranging / neutral + high confidence
  const isRanging = trend.includes('ranging') || trend.includes('neutral')
  if (isRanging && score >= 7.0) {
    flags.push({
      type: 'ranging_high_confidence',
      description: `Market is ranging but confidence is ${score.toFixed(1)}/10 — verify that the high score reflects a valid read, not a model artifact.`,
    })
  }

  // Flag 3: High confidence + many strong contradictions
  const strongContradictions = contradictions.filter(c => c.severity === 'strong').length
  if (score >= 6.5 && strongContradictions >= 2) {
    flags.push({
      type: 'high_confidence_many_contradictions',
      description: `Confidence is ${score.toFixed(1)}/10 but ${strongContradictions} strong contradiction group(s) exist — signals are pulling in opposite directions.`,
    })
  }

  // Flag 4: Decision direction disagrees with trend
  const buyingDecision = decision.label.includes('Buy')
  const sellingDecision = decision.label.includes('Sell')
  const bullishTrend = trend.includes('bullish')
  const bearishTrend = trend.includes('bearish')
  if ((buyingDecision && bearishTrend) || (sellingDecision && bullishTrend)) {
    flags.push({
      type: 'decision_trend_mismatch',
      description: `Decision is "${decision.label}" but trend is "${trend}" — this reversal signal requires strong structural confirmation.`,
    })
  }

  // Flag 5: Weak ADX + strong directional trend label
  if ((trend.includes('strong bullish') || trend.includes('strong bearish')) && adxStrength === 'weak') {
    flags.push({
      type: 'strong_trend_weak_adx',
      description: `Trend is labelled "${trend}" but ADX indicates weak momentum — trend classification may be based on structure alone, not active momentum.`,
    })
  }

  // Flag 6: RSI extreme in the direction of trade
  const rsi = analysis.indicatorSummary.rsi.value
  if (rsi !== null && buyingDecision && rsi >= 75) {
    flags.push({
      type: 'overbought_buy_signal',
      description: `Buy signal generated with RSI at ${rsi.toFixed(0)} (overbought) — risk of near-term pullback is elevated.`,
    })
  }
  if (rsi !== null && sellingDecision && rsi <= 25) {
    flags.push({
      type: 'oversold_sell_signal',
      description: `Sell signal generated with RSI at ${rsi.toFixed(0)} (oversold) — risk of near-term bounce is elevated.`,
    })
  }

  // Flag 7: Volume contradicts the directional move
  const volumeContradicts =
    analysis.volumeContext.confirmsCurrentMove === false &&
    (trend.includes('strong bullish') || trend.includes('strong bearish'))
  if (volumeContradicts) {
    flags.push({
      type: 'volume_not_confirming_strong_trend',
      description: `A strong directional trend is present but volume is not confirming the move — watch for potential reversal or false breakout.`,
    })
  }

  return { flags, hasIssues: flags.length > 0 }
}
