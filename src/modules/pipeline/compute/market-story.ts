import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { MarketContext } from '../types'
import type { MarketStory } from '../types'

/**
 * Builds a deterministic natural-language market narrative.
 * Every sentence maps to existing analysis fields — no AI, no randomness.
 */
export function computeMarketStory(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  marketContext: MarketContext,
): MarketStory {
  const sentences: string[] = []

  const { fullTrend, emaContext, indicatorSummary, srContext, volumeContext } = analysis
  const trend = fullTrend.trend

  // ── Trend narrative ───────────────────────────────────────────────────────────
  const trendSentence = buildTrendSentence(trend, emaContext.emaAlignment, confidence.score)
  sentences.push(trendSentence)

  // ── Market phase colour ───────────────────────────────────────────────────────
  const phaseSentence = buildPhaseSentence(marketContext.phase, marketContext.volatility)
  sentences.push(phaseSentence)

  // ── Momentum ──────────────────────────────────────────────────────────────────
  const momentumSentence = buildMomentumSentence(indicatorSummary.rsi, indicatorSummary.macd, indicatorSummary.adx)
  sentences.push(momentumSentence)

  // ── Volume context ────────────────────────────────────────────────────────────
  const volumeSentence = buildVolumeSentence(volumeContext)
  if (volumeSentence) sentences.push(volumeSentence)

  // ── S/R proximity ─────────────────────────────────────────────────────────────
  const srSentence = buildSRSentence(srContext)
  if (srSentence) sentences.push(srSentence)

  // ── Confluence / contradiction note ───────────────────────────────────────────
  const qualitySentence = buildQualitySentence(confidence)
  if (qualitySentence) sentences.push(qualitySentence)

  return { text: sentences.join(' '), sentences }
}

function buildTrendSentence(
  trend: string,
  emaAlignment: string,
  score: number,
): string {
  const strengthAdverb = score >= 7.5 ? 'clearly' : score >= 5 ? 'moderately' : 'weakly'

  if (trend.includes('strong bullish')) {
    const emaNote = emaAlignment === 'bullish_stack'
      ? 'with a fully bullish EMA stack confirming broad momentum'
      : 'with strong multi-factor confirmation'
    return `Price is ${strengthAdverb} trending upward ${emaNote}.`
  }
  if (trend.includes('moderate bullish') || trend.includes('bullish')) {
    const alignNote = emaAlignment === 'bullish_stack'
      ? 'with EMA alignment supporting the move'
      : 'with partial EMA support'
    return `The market is ${strengthAdverb} bullish ${alignNote}.`
  }
  if (trend.includes('strong bearish')) {
    return `Price is ${strengthAdverb} trending downward with a fully bearish EMA stack confirming selling pressure.`
  }
  if (trend.includes('moderate bearish') || trend.includes('bearish')) {
    const alignNote = emaAlignment === 'bearish_stack'
      ? 'with EMA alignment confirming the move'
      : 'with partial EMA pressure'
    return `The market is ${strengthAdverb} bearish ${alignNote}.`
  }
  // Ranging / neutral
  if (emaAlignment === 'compressed' || emaAlignment === 'tangled') {
    return 'Price is moving sideways with compressed EMAs, indicating a period of consolidation.'
  }
  return 'The market is in a neutral, ranging state with no clear directional momentum.'
}

function buildPhaseSentence(phase: string, volatility: string): string {
  const volNote = volatility === 'high' ? ' in a high-volatility environment'
    : volatility === 'low' ? ' in a low-volatility environment'
    : ''

  switch (phase) {
    case 'breakout':           return `A breakout is underway${volNote}, which often leads to accelerated directional moves.`
    case 'reversal_attempt':   return `The market is attempting a reversal${volNote} — confirmation is still needed before committing.`
    case 'consolidation':      return `Price is consolidating${volNote}, building energy for the next directional move.`
    case 'pullback':           return `The current move is a pullback${volNote} within the broader trend.`
    case 'trending_bullish':   return `The market is in an established uptrend${volNote}.`
    case 'trending_bearish':   return `The market is in an established downtrend${volNote}.`
    case 'distribution':       return `Distribution patterns are evident${volNote} — buyers may be losing control.`
    case 'accumulation':       return `Accumulation patterns are visible${volNote} — a base may be forming.`
    default:                   return `The market is ranging${volNote} without a clear phase bias.`
  }
}

function buildMomentumSentence(
  rsi: { value: number | null; classification: string },
  macd: { histogram: number | null; bias: string },
  adx: { adx: number | null; trendStrength: string },
): string {
  const rsiVal = rsi.value
  const rsiDesc = rsiVal === null ? 'RSI unavailable'
    : rsiVal > 70  ? `RSI is overbought at ${rsiVal.toFixed(0)}`
    : rsiVal < 30  ? `RSI is oversold at ${rsiVal.toFixed(0)}`
    : rsiVal >= 55 ? `RSI in bullish zone at ${rsiVal.toFixed(0)}`
    : rsiVal <= 45 ? `RSI in bearish zone at ${rsiVal.toFixed(0)}`
    : `RSI is neutral at ${rsiVal.toFixed(0)}`

  const macdDesc = macd.bias === 'bullish' ? 'MACD is bullish'
    : macd.bias === 'bearish' ? 'MACD is bearish'
    : 'MACD is flat'

  const adxVal = adx.adx
  const adxStr = adxVal !== null ? ` (ADX ${adxVal.toFixed(0)})` : ''
  const adxDesc = adx.trendStrength === 'strong' || adx.trendStrength === 'very_strong'
    ? `with strong trend momentum${adxStr}`
    : adx.trendStrength === 'weak'
      ? `with weak trend momentum${adxStr}`
      : adx.trendStrength === 'unavailable'
        ? 'with momentum data unavailable'
        : `with moderate trend momentum${adxStr}`

  return `${rsiDesc}, ${macdDesc} ${adxDesc}.`
}

function buildVolumeSentence(volumeContext: MarketAnalysisResult['volumeContext']): string | null {
  const { relativeVolume, volumeClassification, climaxSignal, accDistState } = volumeContext

  if (climaxSignal === 'buying_climax') {
    return 'A buying climax is present — exhaustion buying may signal a near-term top.'
  }
  if (climaxSignal === 'selling_climax') {
    return 'A selling climax is present — exhaustion selling may signal a near-term bottom.'
  }

  const volDesc = volumeClassification === 'very_high' || volumeClassification === 'high'
    ? `Volume is elevated (${relativeVolume.toFixed(1)}× average)`
    : volumeClassification === 'very_low' || volumeClassification === 'low'
      ? `Volume is light (${relativeVolume.toFixed(1)}× average)`
      : null

  if (!volDesc) return null

  const accDesc = accDistState === 'accumulating' ? ', with accumulation signs visible'
    : accDistState === 'distributing' ? ', with distribution patterns active'
    : ''

  return `${volDesc}${accDesc}.`
}

function buildSRSentence(srContext: MarketAnalysisResult['srContext']): string | null {
  if (srContext.insideSupport) {
    return 'Price is currently inside a support zone, which may provide a floor.'
  }
  if (srContext.insideResistance) {
    return 'Price is currently inside a resistance zone, which may cap near-term upside.'
  }
  if (srContext.approachingResistance && srContext.nearestResistanceDistance !== null) {
    const dist = Math.abs(srContext.nearestResistanceDistance)
    return `Resistance is approaching — price is ${dist.toFixed(1)}% from the nearest resistance level.`
  }
  if (srContext.approachingSupport && srContext.nearestSupportDistance !== null) {
    const dist = Math.abs(srContext.nearestSupportDistance)
    return `Support is nearby — price is ${dist.toFixed(1)}% from the nearest support level.`
  }
  return null
}

function buildQualitySentence(confidence: ConfidenceResult): string | null {
  const { analysisQuality } = confidence
  const hasStrong = analysisQuality.contradictions.some(c => c.severity === 'strong')
  const hasMod = analysisQuality.contradictions.some(c => c.severity === 'moderate')

  if (hasStrong) {
    return 'Strong contradictions exist between signal categories — exercise caution and wait for alignment.'
  }
  if (hasMod) {
    return 'Moderate contradictions are present — the picture is not fully clear in all dimensions.'
  }
  if (analysisQuality.confluence.agreementRatio >= 0.75) {
    return 'Most signal categories are in agreement, improving confidence in the current read.'
  }
  return null
}
