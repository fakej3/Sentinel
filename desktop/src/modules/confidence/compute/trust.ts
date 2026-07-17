import type { MarketAnalysisResult } from '../../analysis/types'
import type { ValidationResult } from '../../validation/types'
import type { TrustFactor, TrustResult } from '../types'

/**
 * Trust Layer 2.0 — assesses analysis quality rather than data availability.
 *
 * The seven factors measure whether the different aspects of the analysis agree
 * and reinforce each other, not merely whether indicator values exist.
 * A high-trust analysis is one where trend, structure, volume, and momentum all
 * point the same way with no major contradictions.
 */
export function computeTrust(
  analysis: MarketAnalysisResult,
  validation: ValidationResult,
): TrustResult {
  const { fullTrend, emaContext, volumeContext, indicatorSummary, marketStructure } = analysis
  const trend = fullTrend.trend

  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')
  const isRanging = !isBullish && !isBearish

  // ── Factor 1: Trend has a clear directional bias ──────────────────────────
  const trendClear = !isRanging
  const factor1: TrustFactor = {
    label: 'Trend has clear direction',
    passed: trendClear,
    note: !trendClear ? 'Market is ranging — no reliable directional bias detected' : undefined,
  }

  // ── Factor 2: Market structure confirms the trend ─────────────────────────
  const rs = marketStructure.recentStructure
  const structureConfirms =
    marketStructure.bos.detected ||
    marketStructure.choch.detected ||
    (isBullish && (rs.higherHighs + rs.higherLows > 0)) ||
    (isBearish && (rs.lowerHighs + rs.lowerLows > 0)) ||
    isRanging  // ranging markets are self-confirming for structure purposes
  const factor2: TrustFactor = {
    label: 'Structure confirms trend',
    passed: structureConfirms,
    note: !structureConfirms
      ? 'No BOS, CHoCH, or consistent swing structure confirms the current trend'
      : undefined,
  }

  // ── Factor 3: Volume agrees with the current price move ───────────────────
  const volumeAgrees = volumeContext.confirmsCurrentMove || volumeContext.overallStrength >= 6
  const factor3: TrustFactor = {
    label: 'Volume confirms the move',
    passed: volumeAgrees,
    note: !volumeAgrees ? 'Volume is not confirming the current price direction' : undefined,
  }

  // ── Factor 4: EMAs are consistently aligned ───────────────────────────────
  const emaAligned =
    emaContext.emaAlignment === 'bullish_stack' ||
    emaContext.emaAlignment === 'bearish_stack'
  const factor4: TrustFactor = {
    label: 'EMA alignment is consistent',
    passed: emaAligned,
    note: !emaAligned ? 'Moving averages are in mixed or unavailable alignment' : undefined,
  }

  // ── Factor 5: Momentum not at an unsustainable extreme ────────────────────
  // Overbought RSI in bullish trend or oversold RSI in bearish trend signals
  // potential exhaustion and reduces trust in continuation.
  const rsiClass = indicatorSummary.rsi.classification
  const rsiAtExtremeOpposite =
    (isBullish && rsiClass === 'overbought') ||
    (isBearish && rsiClass === 'oversold')
  const factor5: TrustFactor = {
    label: 'Momentum not at unsustainable extreme',
    passed: !rsiAtExtremeOpposite,
    note: rsiAtExtremeOpposite
      ? `RSI is ${rsiClass} — trend may be overextended`
      : undefined,
  }

  // ── Factor 6: No critical validation issues ───────────────────────────────
  const noCriticals = validation.criticalCount === 0
  const factor6: TrustFactor = {
    label: 'No critical validation issues',
    passed: noCriticals,
    note: !noCriticals
      ? `${validation.criticalCount} critical issue(s) detected — structural data integrity compromised`
      : undefined,
  }

  // ── Factor 7: Sufficient conditions met for dominant direction ────────────
  const bull = fullTrend.bullishConditionsMet
  const bear = fullTrend.bearishConditionsMet
  const sufficientConditions =
    (isBullish && bull >= 3) ||
    (isBearish && bear >= 3) ||
    isRanging
  const factor7: TrustFactor = {
    label: 'Sufficient conditions met',
    passed: sufficientConditions,
    note: !sufficientConditions
      ? `Only ${isBullish ? bull : bear}/5 conditions met — ${isBullish ? 'bullish' : 'bearish'} thesis is weak`
      : undefined,
  }

  const factors = [factor1, factor2, factor3, factor4, factor5, factor6, factor7]

  const passedCount = factors.filter(f => f.passed).length
  const score = Math.round((passedCount / factors.length) * 100)
  const level: 'high' | 'medium' | 'low' = score >= 80 ? 'high' : score >= 57 ? 'medium' : 'low'
  const reductions = factors
    .filter(f => !f.passed && f.note !== undefined)
    .map(f => f.note!)

  return { score, level, factors, reductions }
}
