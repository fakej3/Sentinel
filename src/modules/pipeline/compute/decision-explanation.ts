import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { DecisionDimension, DecisionDimensionStatus, DecisionExplanation } from '../types'

function dim(
  name: string,
  status: DecisionDimensionStatus,
  detail: string,
): DecisionDimension {
  return { name, status, detail }
}

/**
 * Produces a structured explanation of the trade decision: per-dimension status
 * and the conditions that would shift the view to neutral or the opposite direction.
 */
export function computeDecisionExplanation(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  validation: ValidationResult,
): DecisionExplanation {
  const { fullTrend, emaContext, indicatorSummary, volumeContext, marketStructure: ms, srContext } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  const dimensions: DecisionDimension[] = []

  // ── 1. Trend ─────────────────────────────────────────────────────────────────
  const bullMet = fullTrend.bullishConditionsMet
  const bearMet = fullTrend.bearishConditionsMet
  if (trend === 'strong bullish') {
    dimensions.push(dim('Trend', 'strongly_supports', `Strong bullish — ${bullMet}/5 conditions confirmed`))
  } else if (trend === 'moderate bullish') {
    dimensions.push(dim('Trend', 'supports', `Moderate bullish — ${bullMet}/5 conditions confirmed`))
  } else if (trend === 'weak bullish') {
    dimensions.push(dim('Trend', 'supports', `Weak bullish lean — only ${bullMet}/5 conditions met`))
  } else if (trend === 'ranging') {
    dimensions.push(dim('Trend', 'neutral', `No clear trend — ${bullMet}/5 bullish, ${bearMet}/5 bearish conditions`))
  } else if (trend === 'weak bearish') {
    dimensions.push(dim('Trend', 'opposes', `Weak bearish lean — only ${bearMet}/5 conditions met`))
  } else if (trend === 'moderate bearish') {
    dimensions.push(dim('Trend', 'opposes', `Moderate bearish — ${bearMet}/5 conditions confirmed`))
  } else {
    dimensions.push(dim('Trend', 'strongly_opposes', `Strong bearish — ${bearMet}/5 conditions confirmed`))
  }

  // ── 2. Structure ─────────────────────────────────────────────────────────────
  const hasBullBOS   = ms.bos.detected   && ms.bos.last?.direction   === 'bullish'
  const hasBearBOS   = ms.bos.detected   && ms.bos.last?.direction   === 'bearish'
  const hasBullCHoCH = ms.choch.detected && ms.choch.last?.direction === 'bullish'
  const hasBearCHoCH = ms.choch.detected && ms.choch.last?.direction === 'bearish'
  const rs = ms.recentStructure

  if (isBullish && (hasBullBOS || hasBullCHoCH || rs.higherHighs >= 2)) {
    const reason = hasBullBOS ? 'Bullish BOS confirmed' : hasBullCHoCH ? 'Bullish CHoCH confirmed' : `${rs.higherHighs}HH/${rs.higherLows}HL pattern`
    dimensions.push(dim('Structure', 'supports', reason))
  } else if (isBearish && (hasBearBOS || hasBearCHoCH || rs.lowerHighs >= 2)) {
    const reason = hasBearBOS ? 'Bearish BOS confirmed' : hasBearCHoCH ? 'Bearish CHoCH confirmed' : `${rs.lowerHighs}LH/${rs.lowerLows}LL pattern`
    dimensions.push(dim('Structure', 'supports', reason))
  } else if (ms.consolidation.detected) {
    dimensions.push(dim('Structure', 'neutral', 'Consolidating — no clear structural signal yet'))
  } else {
    dimensions.push(dim('Structure', 'neutral', 'Mixed or insufficient structure data'))
  }

  // ── 3. Momentum ──────────────────────────────────────────────────────────────
  const rsi  = indicatorSummary.rsi
  const macd = indicatorSummary.macd
  let momentumStatus: DecisionDimensionStatus = 'neutral'
  let momentumDetail = 'Momentum signals are mixed'

  if (rsi.value !== null) {
    const r = rsi.value.toFixed(0)
    if (rsi.classification === 'healthy_bullish' && macd.bias === 'bullish') {
      momentumStatus = isBullish ? 'supports' : 'opposes'
      momentumDetail = `RSI ${r} (healthy zone) + MACD bullish — momentum ${isBullish ? 'aligned with' : 'against the'} trend`
    } else if (rsi.classification === 'weak_bearish' && macd.bias === 'bearish') {
      momentumStatus = isBearish ? 'supports' : 'opposes'
      momentumDetail = `RSI ${r} (bearish zone) + MACD bearish — momentum ${isBearish ? 'aligned with' : 'against the'} trend`
    } else if (rsi.classification === 'overbought') {
      momentumStatus = isBullish ? 'opposes' : 'supports'
      momentumDetail = `RSI ${r} — overbought, potential exhaustion ahead`
    } else if (rsi.classification === 'oversold') {
      momentumStatus = isBearish ? 'opposes' : 'supports'
      momentumDetail = `RSI ${r} — oversold, potential bounce zone`
    } else {
      momentumDetail = `RSI ${r} — neutral territory, no strong momentum signal`
    }
  }
  dimensions.push(dim('Momentum', momentumStatus, momentumDetail))

  // ── 4. Volume ────────────────────────────────────────────────────────────────
  const rv = volumeContext.relativeVolume
  let volStatus: DecisionDimensionStatus
  let volDetail: string

  if (volumeContext.confirmsCurrentMove && volumeContext.overallStrength >= 6) {
    volStatus = 'supports'
    volDetail = `${rv.toFixed(1)}× average volume — confirms the move with strong conviction`
  } else if (!volumeContext.confirmsCurrentMove && rv < 0.8) {
    volStatus = 'opposes'
    volDetail = `${rv.toFixed(1)}× average volume — thin trading, weak conviction behind the move`
  } else if (volumeContext.confirmsCurrentMove) {
    volStatus = 'neutral'
    volDetail = `${rv.toFixed(1)}× average volume — confirms direction, moderate strength`
  } else {
    volStatus = 'neutral'
    volDetail = `${rv.toFixed(1)}× average volume — inconclusive volume signal`
  }
  dimensions.push(dim('Volume', volStatus, volDetail))

  // ── 5. Validation ────────────────────────────────────────────────────────────
  if (validation.criticalCount > 0) {
    dimensions.push(dim(
      'Validation',
      'strongly_opposes',
      `${validation.criticalCount} critical issue${validation.criticalCount > 1 ? 's' : ''} — data reliability is compromised`,
    ))
  } else if (validation.warningCount > 0) {
    dimensions.push(dim(
      'Validation',
      'opposes',
      `${validation.warningCount} warning${validation.warningCount > 1 ? 's' : ''} — minor inconsistencies noted`,
    ))
  } else {
    dimensions.push(dim('Validation', 'supports', 'All checks passed — data is internally consistent'))
  }

  // ── 6. Contradictions ────────────────────────────────────────────────────────
  const contradictions = confidence.analysisQuality.contradictions
  const hasStrong   = contradictions.some(c => c.severity === 'strong')
  const hasModerate = contradictions.some(c => c.severity === 'moderate')
  let contrStatus: DecisionDimensionStatus
  let contrDetail: string

  if (hasStrong) {
    contrStatus = 'strongly_opposes'
    contrDetail = 'Strong contradictions — multiple indicator categories oppose the dominant view'
  } else if (hasModerate) {
    contrStatus = 'opposes'
    contrDetail = 'Moderate contradictions — some categories disagree with the dominant view'
  } else if (contradictions.length === 0) {
    contrStatus = 'supports'
    contrDetail = 'No meaningful contradictions — signal categories are broadly aligned'
  } else {
    contrStatus = 'neutral'
    contrDetail = 'Minor contradictions present — generally aligned but with some noise'
  }
  dimensions.push(dim('Contradictions', contrStatus, contrDetail))

  // ── Flip-to-neutral ──────────────────────────────────────────────────────────
  const flipToNeutral: string[] = []
  if (isBullish) {
    if (emaContext.emaAlignment === 'bullish_stack') {
      flipToNeutral.push('EMA bullish stack breaks — EMA20 crosses below EMA50')
    }
    flipToNeutral.push(`Bullish conditions drop to 2/5 or fewer (currently ${bullMet}/5)`)
    if (srContext.nearestResistanceDistance !== null && srContext.nearestResistanceDistance < 6) {
      flipToNeutral.push(`Repeated rejection at nearby resistance (${srContext.nearestResistanceDistance.toFixed(1)}% above) establishes a range`)
    }
    if (volumeContext.relativeVolume > 0.8) {
      flipToNeutral.push('Volume consistently dries up below 0.7× average, removing directional conviction')
    }
  } else if (isBearish) {
    if (emaContext.emaAlignment === 'bearish_stack') {
      flipToNeutral.push('EMA bearish stack breaks — EMA20 crosses above EMA50')
    }
    flipToNeutral.push(`Bearish conditions drop to 2/5 or fewer (currently ${bearMet}/5)`)
    if (srContext.nearestSupportDistance !== null && Math.abs(srContext.nearestSupportDistance) < 6) {
      flipToNeutral.push(`Repeated holding at nearby support (${Math.abs(srContext.nearestSupportDistance).toFixed(1)}% below) stabilises into a range`)
    }
    if (volumeContext.relativeVolume > 0.8) {
      flipToNeutral.push('Volume dries up below 0.7× average, suggesting sellers are losing momentum')
    }
  } else {
    flipToNeutral.push('Already ranging — no additional conditions change required')
  }

  // ── Flip-to-opposite ─────────────────────────────────────────────────────────
  const flipToOpposite: string[] = []
  if (isBullish) {
    flipToOpposite.push('Bearish BOS or CHoCH confirmed — market structure flips bearish')
    if (emaContext.emaAlignment === 'bullish_stack') {
      flipToOpposite.push('Full EMA bearish realignment — all four EMAs invert their stacking order')
    }
    flipToOpposite.push('Price closes and holds below key support with expanding sell volume')
    flipToOpposite.push(`${5 - bearMet} or more additional bearish conditions trigger simultaneously`)
  } else if (isBearish) {
    flipToOpposite.push('Bullish BOS or CHoCH confirmed — market structure flips bullish')
    if (emaContext.emaAlignment === 'bearish_stack') {
      flipToOpposite.push('Full EMA bullish realignment — all four EMAs invert their stacking order')
    }
    flipToOpposite.push('Price closes and holds above key resistance with expanding buy volume')
    flipToOpposite.push(`${5 - bullMet} or more additional bullish conditions trigger simultaneously`)
  } else {
    flipToOpposite.push('Not applicable from a ranging market — pick a direction first')
  }

  return { dimensions, flipToNeutral, flipToOpposite }
}
