import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { TradeDecision, TradePlan } from '../types'
import { computeDecisionExplanation } from './decision-explanation'
import { computeDecisionQuality } from './decision-quality'
import { isEntryExecutable } from './entry-timing'

/**
 * Derive a human-readable trade decision from trend, confidence, validation,
 * and (when available) the actual trade plan.
 *
 * Directional bias and executable entry are deliberately separated:
 * a bullish market can still be a WAIT if the computed entry zone is below
 * current price. Sentinel must not tell the user to buy now when its own plan
 * says to wait for a pullback.
 */
export function computeDecision(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  validation: ValidationResult,
  tradePlan?: TradePlan,
): TradeDecision {
  const trend = analysis.fullTrend.trend
  const score = confidence.score
  const hasCritical = validation.criticalCount > 0
  const hasWarnings = validation.warningCount > 0

  let label: TradeDecision['label']
  const reasons: string[] = []

  // ── Determine raw directional label ───────────────────────────────────────
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
    label = (score >= 6.5 && !hasCritical) ? 'Strong Sell' : 'Sell'
  }

  // ── Entry timing gate ──────────────────────────────────────────────────────
  // The old decision was computed before TradePlan and therefore only answered
  // "which direction does the market favour?" while the UI presented it as a
  // trade signal. That produced false actionable Buy/Sell labels: a bullish
  // market with an entry zone below current price was still labelled Buy.
  //
  // TradePlan is the canonical authority for executable entry. If its setup is
  // non-actionable or current price is outside the directional entry zone, the
  // signal becomes WAIT (represented by the existing `Watch` label). This does
  // not retune trend/confidence; it only prevents directional bias from being
  // presented as an executable entry.
  let waitingForEntry = false
  if (tradePlan) {
    waitingForEntry = !isEntryExecutable(analysis.price.current, tradePlan)

    if (waitingForEntry) {
      label = 'Watch'
      if (tradePlan.direction === 'long' && tradePlan.entryZone !== null) {
        if (analysis.price.current > tradePlan.entryZone.upper) {
          reasons.push(`Bullish bias remains intact, but price is above the long entry zone — wait for a pullback to ${tradePlan.entryZone.lower.toFixed(2)}–${tradePlan.entryZone.upper.toFixed(2)}`)
        } else if (analysis.price.current < tradePlan.entryZone.lower) {
          reasons.push(`Bullish setup is not at its entry zone yet — wait for price to reach ${tradePlan.entryZone.lower.toFixed(2)}–${tradePlan.entryZone.upper.toFixed(2)}`)
        }
      } else if (tradePlan.direction === 'short' && tradePlan.entryZone !== null) {
        if (analysis.price.current < tradePlan.entryZone.lower) {
          reasons.push(`Bearish bias remains intact, but price is below the short entry zone — wait for a rebound to ${tradePlan.entryZone.lower.toFixed(2)}–${tradePlan.entryZone.upper.toFixed(2)}`)
        } else if (analysis.price.current > tradePlan.entryZone.upper) {
          reasons.push(`Bearish setup is not at its entry zone yet — wait for price to reach ${tradePlan.entryZone.lower.toFixed(2)}–${tradePlan.entryZone.upper.toFixed(2)}`)
        }
      }
      if (!tradePlan.actionable) {
        reasons.push(`Trade plan is non-actionable (${tradePlan.setupQuality}) — no entry should be taken at current levels`)
      }
    }
  }

  // ── Build concise reason bullets (3–5) ────────────────────────────────────
  const { fullTrend, emaContext, volumeContext, indicatorSummary, srContext } = analysis

  const bull = fullTrend.bullishConditionsMet
  const bear = fullTrend.bearishConditionsMet
  if (trend.includes('bullish')) {
    reasons.push(`${bull}/5 bullish conditions met — trend structure favors upside`)
  } else if (trend.includes('bearish')) {
    reasons.push(`${bear}/5 bearish conditions met — trend structure favors downside`)
  } else {
    reasons.push(`Market is ranging — ${bull} bullish and ${bear} bearish conditions active`)
  }

  if (emaContext.emaAlignment === 'bullish_stack') {
    reasons.push('Moving averages stacked bullishly — long-term trend is up')
  } else if (emaContext.emaAlignment === 'bearish_stack') {
    reasons.push('Moving averages stacked bearishly — long-term trend is down')
  }

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

  if (volumeContext.confirmsCurrentMove) {
    reasons.push(`Volume confirms the move (${volumeContext.relativeVolume.toFixed(1)}× average)`)
  } else if (!volumeContext.confirmsCurrentMove && volumeContext.relativeVolume < 0.7) {
    reasons.push(`Low volume (${volumeContext.relativeVolume.toFixed(1)}× average) — conviction is weak`)
  }

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

  if (waitingForEntry) {
    const timingReasons = reasons.filter(r => r.includes('entry zone') || r.includes('Trade plan is non-actionable'))
    const otherReasons = reasons.filter(r => !timingReasons.includes(r))
    reasons.splice(0, reasons.length, ...timingReasons, ...otherReasons)
  }

  let riskLevel: TradeDecision['riskLevel']
  if (hasCritical || score < 3) {
    riskLevel = 'High'
  } else if (hasWarnings || score < 5.5 || waitingForEntry) {
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
