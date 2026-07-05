import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { DecisionQuality } from '../types'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Computes an internal 0–10 quality score for the trade decision.
 * Measures clarity, multi-category agreement, contradictions, risk, and signal cleanliness.
 * This score is not for direct display — it gates hedging language and recommendation strength.
 */
export function computeDecisionQuality(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  validation: ValidationResult,
): DecisionQuality {
  const { fullTrend, indicatorSummary } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  // ── Clarity (0–10): how many conditions confirm the dominant direction ───────
  const condMet = isBullish
    ? fullTrend.bullishConditionsMet
    : isBearish
      ? fullTrend.bearishConditionsMet
      : 0
  const clarity = round1(Math.min(10, (condMet / 5) * 10))

  // ── Agreement (0–10): from the confluence engine ─────────────────────────────
  const agreement = round1(confidence.analysisQuality.confluence.score)

  // ── Contradiction penalty (0–10): weighted by severity ───────────────────────
  const contradictions = confidence.analysisQuality.contradictions
  const strongCount    = contradictions.filter(c => c.severity === 'strong').length
  const moderateCount  = contradictions.filter(c => c.severity === 'moderate').length
  const contradictionPenalty = round1(Math.min(10, strongCount * 3 + moderateCount * 1.5))

  // ── Risk penalty (0–10): validation issues ───────────────────────────────────
  const riskPenalty = round1(Math.min(10, validation.criticalCount * 3 + validation.warningCount * 0.5))

  // ── Signal cleanliness (0–10): deduct for extremes and unavailable data ──────
  let signalCleanliness = 10
  const rsi  = indicatorSummary.rsi
  const macd = indicatorSummary.macd
  const adx  = indicatorSummary.adx

  if (rsi.value !== null) {
    // Overbought in bullish or oversold in bearish = unsustainable
    if (isBullish && rsi.classification === 'overbought') signalCleanliness -= 3
    if (isBearish && rsi.classification === 'oversold')   signalCleanliness -= 3
  } else {
    signalCleanliness -= 1
  }
  if (macd.histogram === null)                                signalCleanliness -= 1
  if (adx.trendStrength === 'unavailable')                    signalCleanliness -= 1
  if (indicatorSummary.bollinger.bandwidth === null)          signalCleanliness -= 1
  signalCleanliness = round1(Math.max(0, signalCleanliness))

  // ── Composite score ──────────────────────────────────────────────────────────
  // Clarity and agreement are the primary drivers; penalties reduce from the top.
  const raw =
    clarity           * 0.30 +
    agreement         * 0.30 +
    signalCleanliness * 0.20 -
    contradictionPenalty * 0.10 -
    riskPenalty          * 0.10

  const score = round1(Math.min(10, Math.max(0, raw)))

  return { score, clarity, agreement, contradictionPenalty, riskPenalty, signalCleanliness }
}
