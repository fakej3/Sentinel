import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { TradeDecision } from '../types'
import { computeDecisionExplanation } from './decision-explanation'
import { computeDecisionQuality } from './decision-quality'

/**
 * Derive a human-readable trade decision from trend, confidence, and validation.
 *
 * Decision matrix:
 *   strong bullish  + high confidence  → Strong Buy
 *   moderate bullish + good confidence → Buy
 *   weak bullish / low confidence      → Cautious Buy
 *   ranging                            → Watch / Neutral
 *   weak bearish / low confidence      → Cautious Sell
 *   moderate bearish + good confidence → Sell
 *   strong bearish  + high confidence  → Strong Sell
 *
 * Validation issues cap the upside label (can't be Strong Buy with critical issues).
 */
export function computeDecision(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  validation: ValidationResult,
): TradeDecision {
  const trend = analysis.fullTrend.trend
  const score = confidence.score
  const hasCritical = validation.criticalCount > 0
  const hasWarnings = validation.warningCount > 0

  let label: TradeDecision['label']
  const reasons: string[] = []

  // ── Determine raw label ────────────────────────────────────────────────────
  if (trend === 'strong bullish') {
    label = (score >= 6.5 && !hasCritical) ? 'Strong Buy' : 'Buy'
  } else if (trend === 'moderate bullish') {
    label = (score >= 5.0 && !hasCritical) ? 'Buy' : 'Cautious Buy'
  } else if (trend === 'weak bullish') {
    label = 'Cautious Buy'
  } else if (trend === 'ranging') {
    label = score >= 4.0 ? 'Watch' : 'Neutral'
  } else if (trend === 'weak bearish') {
    label = 'Cautious Sell'
  } else if (trend === 'moderate bearish') {
    label = (score >= 5.0 && !hasCritical) ? 'Sell' : 'Cautious Sell'
  } else {
    // strong bearish
    label = (score >= 6.5 && !hasCritical) ? 'Strong Sell' : 'Sell'
  }

  // ── Validation downgrade ───────────────────────────────────────────────────
  if (hasCritical) {
    if (label === 'Strong Buy') label = 'Buy'
    if (label === 'Strong Sell') label = 'Sell'
  }

  // ── Build concise reason bullets (3–5) ────────────────────────────────────
  const { fullTrend, emaContext, volumeContext, indicatorSummary, srContext } = analysis

  // Reason 1: trend direction
  const bull = fullTrend.bullishConditionsMet
  const bear = fullTrend.bearishConditionsMet
  if (trend.includes('bullish')) {
    reasons.push(`${bull}/5 bullish conditions met — trend structure favors upside`)
  } else if (trend.includes('bearish')) {
    reasons.push(`${bear}/5 bearish conditions met — trend structure favors downside`)
  } else {
    reasons.push(`Market is ranging — ${bull} bullish and ${bear} bearish conditions active`)
  }

  // Reason 2: EMA stack
  if (emaContext.emaAlignment === 'bullish_stack') {
    reasons.push('Moving averages stacked bullishly — long-term trend is up')
  } else if (emaContext.emaAlignment === 'bearish_stack') {
    reasons.push('Moving averages stacked bearishly — long-term trend is down')
  }

  // Reason 3: Momentum
  const rsi = indicatorSummary.rsi.value
  if (rsi !== null) {
    if (indicatorSummary.rsi.classification === 'overbought') {
      reasons.push(`RSI ${rsi.toFixed(0)} is overbought — momentum may be peaking`)
    } else if (indicatorSummary.rsi.classification === 'oversold') {
      reasons.push(`RSI ${rsi.toFixed(0)} is oversold — potential reversal setup`)
    } else if (indicatorSummary.rsi.classification === 'healthy_bullish') {
      reasons.push(`RSI ${rsi.toFixed(0)} in healthy bullish zone — momentum supports buyers`)
    } else if (indicatorSummary.rsi.classification === 'weak_bearish') {
      reasons.push(`RSI ${rsi.toFixed(0)} in bearish zone — momentum favors sellers`)
    }
  }

  // Reason 4: Volume context
  if (volumeContext.confirmsCurrentMove) {
    reasons.push(`Volume confirms the move (${volumeContext.relativeVolume.toFixed(1)}× average)`)
  } else if (!volumeContext.confirmsCurrentMove && volumeContext.relativeVolume < 0.8) {
    reasons.push(`Low volume (${volumeContext.relativeVolume.toFixed(1)}× average) — conviction is weak`)
  }

  // Reason 5: S/R context or validation warning
  if (hasCritical) {
    reasons.push(`${validation.criticalCount} critical validation issue${validation.criticalCount > 1 ? 's' : ''} — treat with caution`)
  } else if (srContext.insideResistance && trend.includes('bullish')) {
    reasons.push('Price is at active resistance — breakout needed to confirm further upside')
  } else if (srContext.insideSupport && trend.includes('bearish')) {
    reasons.push('Price is at active support — breakdown needed to confirm further downside')
  } else if (srContext.nearestResistanceDistance !== null && srContext.nearestResistanceDistance < 2 && trend.includes('bullish')) {
    reasons.push(`Resistance ${srContext.nearestResistanceDistance.toFixed(1)}% away — limited immediate upside`)
  } else if (srContext.nearestSupportDistance !== null && Math.abs(srContext.nearestSupportDistance) < 2 && trend.includes('bearish')) {
    reasons.push(`Support ${Math.abs(srContext.nearestSupportDistance).toFixed(1)}% away — limited immediate downside`)
  } else if (hasWarnings) {
    reasons.push(`${validation.warningCount} warning${validation.warningCount > 1 ? 's' : ''} flagged — monitor closely`)
  }

  // ── Risk level ─────────────────────────────────────────────────────────────
  let riskLevel: TradeDecision['riskLevel']
  if (hasCritical || score < 3) {
    riskLevel = 'High'
  } else if (hasWarnings || score < 5.5) {
    riskLevel = 'Medium'
  } else {
    riskLevel = 'Low'
  }

  return {
    label,
    reasons: reasons.slice(0, 5),
    riskLevel,
    confidence: score,
    explanation: computeDecisionExplanation(analysis, confidence, validation),
    quality:     computeDecisionQuality(analysis, confidence, validation),
  }
}
