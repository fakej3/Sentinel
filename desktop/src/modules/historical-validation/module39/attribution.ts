/**
 * Module 39 — Multi-label trade attribution.
 *
 * Classifies every sl_hit record with all applicable loss reasons,
 * and every tp_hit record with all applicable win reasons.
 * "Neither" records receive empty arrays for both.
 *
 * All rules are derived from pipeline data only — no external data needed.
 * Each rule is independent: a trade may satisfy multiple reasons simultaneously.
 */
import type { ValidationRecord } from '../types'
import type { AttributedRecord, LossReason, WinReason } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function stopDistance(entryPrice: number | null, stopPrice: number | null): number {
  if (entryPrice === null || stopPrice === null) return Infinity
  return Math.abs(entryPrice - stopPrice)
}

function targetDistance(entryPrice: number | null, targetPrice: number | null): number {
  if (entryPrice === null || targetPrice === null) return Infinity
  return Math.abs(entryPrice - targetPrice)
}

// ── Loss attribution ──────────────────────────────────────────────────────────

function classifyLoss(record: ValidationRecord): LossReason[] {
  const { snapshot, outcome } = record
  const { pipeline, direction } = snapshot
  const { analysis, confidence, indicators, marketStructure, tradePlan,
          traderReview, contradictionIntelligence, sanityAudit } = pipeline
  const { fullTrend, emaContext, indicatorSummary, srContext, volumeContext } = analysis
  const { rsi, macd, adx } = indicatorSummary
  const { barsToOutcome, mfe, mfePct, mae, entryPrice, stopPrice, targetPrice } = outcome

  const reasons: LossReason[] = []

  // ── Trend ──────────────────────────────────────────────────────────────────

  const trendLabel = fullTrend.trend

  if (trendLabel.includes('weak') || trendLabel === 'ranging') {
    reasons.push('weak_trend')
  }

  // Counter trend: direction and trend label point opposite ways
  if (
    (direction === 'bullish' && (trendLabel.includes('bearish'))) ||
    (direction === 'bearish' && (trendLabel.includes('bullish')))
  ) {
    reasons.push('counter_trend')
  }

  // Range chop: ranging market with no structure events
  if (
    trendLabel === 'ranging' &&
    !marketStructure.bos.detected &&
    !marketStructure.choch.detected &&
    !marketStructure.breakout.confirmed
  ) {
    reasons.push('range_chop')
  }

  // ── EMA ────────────────────────────────────────────────────────────────────

  const emaAlign = emaContext.emaAlignment
  if (
    (direction === 'bullish' && (emaAlign === 'bearish_stack' || emaAlign === 'unavailable')) ||
    (direction === 'bearish' && (emaAlign === 'bullish_stack' || emaAlign === 'unavailable'))
  ) {
    reasons.push('weak_ema')
  }

  // ── Structure ──────────────────────────────────────────────────────────────

  if (marketStructure.strength === 'weak' && marketStructure.confidence < 40) {
    reasons.push('weak_structure')
  }

  if (marketStructure.bos.detected) reasons.push('failed_bos')
  if (marketStructure.choch.detected) reasons.push('failed_choch')

  if (
    marketStructure.breakout.confirmed &&
    barsToOutcome !== null && barsToOutcome <= 8
  ) {
    reasons.push('false_breakout')
  }

  // ── Volume ─────────────────────────────────────────────────────────────────

  if (volumeContext.overallStrength <= 3) reasons.push('weak_volume')
  if (volumeContext.relativeVolume < 0.7) reasons.push('low_rel_volume')

  // ── S/R ────────────────────────────────────────────────────────────────────

  if (direction === 'bullish' && srContext.insideSupport)   reasons.push('support_failure')
  if (direction === 'bearish' && srContext.insideResistance) reasons.push('resistance_failure')

  // ── Entry / exit geometry ──────────────────────────────────────────────────

  const sd = stopDistance(entryPrice, stopPrice)
  const td = targetDistance(entryPrice, targetPrice)

  // Late entry: adverse excursion >> stop distance
  if (isFinite(sd) && mae > sd * 1.8) reasons.push('late_entry')

  // Stop too tight: < 0.5% from entry
  if (
    entryPrice !== null && isFinite(sd) &&
    sd / entryPrice < 0.005
  ) {
    reasons.push('stop_too_tight')
  }

  // Target too far: price didn't get 15% of the way to target
  if (
    isFinite(td) && td > 0 &&
    mfe / td < 0.15
  ) {
    reasons.push('target_too_far')
  }

  if (tradePlan.riskRewardRatio !== null && tradePlan.riskRewardRatio < 1.5) {
    reasons.push('poor_rr')
  }

  // ── Confidence / trust ─────────────────────────────────────────────────────

  if (confidence.score < 4.5) reasons.push('low_confidence')

  const v = traderReview.verdict
  if (v === 'Wait' || v === 'Avoid' || v === 'Reduce Position') {
    reasons.push('low_trust')
  }

  // ── Contradiction / MTF proxy ──────────────────────────────────────────────

  if (
    contradictionIntelligence.overallSeverity === 'major' ||
    sanityAudit.hasIssues
  ) {
    reasons.push('mtf_conflict')
  }

  // ── Momentum ───────────────────────────────────────────────────────────────

  // Momentum failure: key momentum indicators oppose direction
  const rsic  = rsi.classification
  const macdb = macd.bias
  if (
    (direction === 'bullish' && (rsic === 'overbought' || macdb === 'bearish')) ||
    (direction === 'bearish' && (rsic === 'oversold'   || macdb === 'bullish'))
  ) {
    reasons.push('momentum_failure')
  }

  // ADX weak when trend trade — directional drift but no trend strength
  if (
    adx.trendStrength === 'weak' &&
    (trendLabel.includes('bullish') || trendLabel.includes('bearish'))
  ) {
    // Don't add a separate reason, but this feeds into weak_trend already
  }

  // ── Volatility ─────────────────────────────────────────────────────────────

  const atrPct = indicators.atrPercent
  if (atrPct !== null && atrPct > 3.5) reasons.push('high_volatility')
  if (atrPct !== null && atrPct < 0.5)  reasons.push('low_volatility')

  // ── Liquidity sweep ────────────────────────────────────────────────────────

  // Very fast SL hit after achieving meaningful MFE = spike + reversal
  if (
    barsToOutcome !== null && barsToOutcome <= 3 &&
    mfePct > 0.3
  ) {
    reasons.push('liquidity_sweep')
  }

  // ── Unknown ────────────────────────────────────────────────────────────────

  if (reasons.length === 0) reasons.push('unknown')

  return reasons
}

// ── Win attribution ───────────────────────────────────────────────────────────

function classifyWin(record: ValidationRecord): WinReason[] {
  const { snapshot } = record
  const { pipeline, direction } = snapshot
  const { analysis, confidence, marketStructure, tradePlan,
          traderReview, opportunityAssessment, contradictionIntelligence,
          sanityAudit } = pipeline
  const { fullTrend, emaContext, indicatorSummary, srContext, volumeContext } = analysis
  const { rsi, macd } = indicatorSummary

  const reasons: WinReason[] = []

  // Confidence
  if (confidence.score >= 7) reasons.push('high_confidence')

  // Trust
  const v = traderReview.verdict
  if (
    v === 'Aggressive Buy' || v === 'Conservative Buy' ||
    v === 'Aggressive Sell' || v === 'Conservative Sell'
  ) {
    reasons.push('high_trust')
  }

  // Setup quality
  if (tradePlan.setupQuality === 'excellent') reasons.push('excellent_setup')

  // Aligned signals (no major contradictions)
  if (
    contradictionIntelligence.overallSeverity === 'none' &&
    !sanityAudit.hasIssues
  ) {
    reasons.push('aligned_mtf')
  }

  // Trend
  if (fullTrend.trend.includes('strong')) reasons.push('strong_trend')

  // Volume
  if (
    volumeContext.relativeVolume >= 1.3 &&
    volumeContext.overallStrength >= 6
  ) {
    reasons.push('high_volume')
  }

  if (volumeContext.confirmsCurrentMove) reasons.push('volume_confirms')

  // EMA
  const emaAlign = emaContext.emaAlignment
  if (
    (direction === 'bullish' && emaAlign === 'bullish_stack') ||
    (direction === 'bearish' && emaAlign === 'bearish_stack')
  ) {
    reasons.push('perfect_ema')
  }

  // Market structure
  if (
    marketStructure.strength === 'strong' &&
    marketStructure.bos.detected
  ) {
    reasons.push('strong_structure')
  }
  if (marketStructure.bos.detected)    reasons.push('bos_confirmed')
  if (marketStructure.choch.detected)  reasons.push('choch_detected')
  if (marketStructure.breakout.confirmed) reasons.push('breakout_confirmed')

  // S/R context
  if (direction === 'bullish' && (srContext.insideSupport || srContext.approachingSupport)) {
    reasons.push('support_bounce')
  }
  if (direction === 'bearish' && (srContext.insideResistance || srContext.approachingResistance)) {
    reasons.push('resistance_rejection')
  }

  // Momentum (RSI + MACD aligned with direction)
  const rsic  = rsi.classification
  const macdb = macd.bias
  const rsiBull = rsic === 'healthy_bullish' || rsic === 'oversold'
  const rsiBear = rsic === 'weak_bearish'    || rsic === 'overbought'
  if (
    (direction === 'bullish' && rsiBull && macdb === 'bullish') ||
    (direction === 'bearish' && rsiBear && macdb === 'bearish')
  ) {
    reasons.push('strong_momentum')
  }

  // R:R
  if (tradePlan.riskRewardRatio !== null && tradePlan.riskRewardRatio >= 2.5) {
    reasons.push('good_rr')
  }

  // Opportunity
  if (opportunityAssessment.tradingOpportunity === 'excellent') {
    reasons.push('excellent_opportunity')
  }

  return reasons
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Attach loss/win attribution to every record in the set. */
export function attributeRecords(records: ValidationRecord[]): AttributedRecord[] {
  return records.map(record => {
    const { result } = record.outcome
    return {
      record,
      lossReasons: result === 'sl_hit' ? classifyLoss(record) : [],
      winReasons:  result === 'tp_hit' ? classifyWin(record)  : [],
    }
  })
}
