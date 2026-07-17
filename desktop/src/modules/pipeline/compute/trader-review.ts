import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { TradeDecision, TradePlan, MarketContext, TraderReview, TraderVerdict } from '../types'

/**
 * Deterministic "professional trader" opinion layer.
 * Produces a verdict and reasoning bullets from existing analysis outputs.
 * Does NOT replace TradeDecision — it is an additional perspective only.
 */
export function computeTraderReview(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  decision: TradeDecision,
  tradePlan: TradePlan,
  marketContext: MarketContext,
): TraderReview {
  const { score } = confidence
  const { label } = decision
  const { actionable, setupQuality, riskRewardRatio } = tradePlan
  const { indicatorSummary, fullTrend, volumeContext } = analysis
  const trend = fullTrend.trend

  const majorContradictions = confidence.analysisQuality.contradictions.filter(c => c.severity === 'strong')
  const hasMajorContradiction = majorContradictions.length > 0
  const rsiv = indicatorSummary.rsi.value
  const overbought = rsiv !== null && rsiv >= 70
  const oversold = rsiv !== null && rsiv <= 30
  const weakADX = indicatorSummary.adx.trendStrength === 'weak'
  const volumeConfirms = volumeContext.confirmsCurrentMove
  const rrGood = riskRewardRatio !== null && riskRewardRatio >= 2.0
  const rrAcceptable = riskRewardRatio !== null && riskRewardRatio >= 1.5

  const verdict = deriveVerdict(
    trend, label, score, actionable, setupQuality,
    hasMajorContradiction, overbought, oversold, weakADX, volumeConfirms, rrGood, marketContext,
  )

  const reasoning = buildReasoning(
    verdict, trend, score, actionable, setupQuality,
    hasMajorContradiction, overbought, oversold, weakADX, volumeConfirms, rrGood, rrAcceptable,
    marketContext,
  )

  return { verdict, reasoning }
}

function deriveVerdict(
  trend: string,
  label: string,
  score: number,
  actionable: boolean,
  setupQuality: TradePlan['setupQuality'],
  hasMajorContradiction: boolean,
  overbought: boolean,
  oversold: boolean,
  weakADX: boolean,
  volumeConfirms: boolean,
  rrGood: boolean,
  marketContext: MarketContext,
): TraderVerdict {
  // Not actionable → Avoid
  if (!actionable || setupQuality === 'no_setup' || setupQuality === 'avoid') {
    return 'Avoid'
  }

  // Major contradictions → Wait regardless of trend
  if (hasMajorContradiction) {
    return 'Wait'
  }

  // Ranging market with low score → Wait
  if (!marketContext.isTrending && score < 5) {
    return 'Wait'
  }

  const isBullish = trend.includes('bullish') || label.includes('Buy')
  const isBearish = trend.includes('bearish') || label.includes('Sell')

  if (isBullish) {
    // Strong signal + good RR + volume + not overbought → Aggressive Buy
    if (score >= 7.5 && rrGood && volumeConfirms && !overbought) return 'Aggressive Buy'
    // Good signal + acceptable RR + not overbought → Conservative Buy
    if (score >= 5.5 && !overbought) return 'Conservative Buy'
    // Overbought or weak → Wait
    if (overbought || weakADX) return 'Wait'
    return 'Conservative Buy'
  }

  if (isBearish) {
    // Strong signal + good RR + volume + not oversold → Aggressive Sell
    if (score >= 7.5 && rrGood && volumeConfirms && !oversold) return 'Aggressive Sell'
    // Good signal + acceptable RR + not oversold → Conservative Sell
    if (score >= 5.5 && !oversold) return 'Conservative Sell'
    // Oversold or weak → Reduce Position (defensive, not chasing)
    if (oversold || weakADX) return 'Reduce Position'
    return 'Conservative Sell'
  }

  // Neutral / ranging
  return 'Wait'
}

function buildReasoning(
  verdict: TraderVerdict,
  _trend: string,
  score: number,
  actionable: boolean,
  setupQuality: TradePlan['setupQuality'],
  hasMajorContradiction: boolean,
  overbought: boolean,
  oversold: boolean,
  weakADX: boolean,
  volumeConfirms: boolean,
  rrGood: boolean,
  rrAcceptable: boolean,
  marketContext: MarketContext,
): string[] {
  const reasons: string[] = []

  switch (verdict) {
    case 'Aggressive Buy':
      reasons.push(`Strong bullish trend (score ${score.toFixed(1)}/10) with multi-category alignment.`)
      if (rrGood) reasons.push('Risk/reward ratio is favorable (≥2:1).')
      if (volumeConfirms) reasons.push('Volume confirms the directional move.')
      reasons.push('No major signal contradictions — conditions are clean for entry.')
      break

    case 'Conservative Buy':
      reasons.push(`Bullish bias is present (score ${score.toFixed(1)}/10) but not all conditions are ideal.`)
      if (overbought) reasons.push('RSI is elevated — consider waiting for a pullback entry.')
      else if (!rrGood && rrAcceptable) reasons.push('Risk/reward is acceptable but not optimal — size appropriately.')
      if (!volumeConfirms) reasons.push('Volume has not confirmed the move yet — exercise caution.')
      reasons.push('Enter with reduced size and defined stop-loss.')
      break

    case 'Wait':
      if (hasMajorContradiction) reasons.push('Major contradictions between signal categories require resolution before acting.')
      if (!marketContext.isTrending) reasons.push('Market is ranging — wait for a directional breakout before committing.')
      if (score < 5) reasons.push(`Confidence is low (${score.toFixed(1)}/10) — insufficient conviction for a position.`)
      if (weakADX) reasons.push('Trend momentum (ADX) is weak — avoid chasing unclear moves.')
      if (reasons.length === 0) reasons.push('Current conditions do not favor a clear entry.')
      break

    case 'Reduce Position':
      reasons.push('Bearish signals are growing but oversold conditions or weak momentum suggest not chasing.')
      if (oversold) reasons.push('RSI is oversold — aggressive short entries carry high reversal risk here.')
      if (weakADX) reasons.push('Weak ADX indicates the bearish move lacks momentum conviction.')
      reasons.push('Reduce long exposure gradually rather than adding shorts in this environment.')
      break

    case 'Aggressive Sell':
      reasons.push(`Strong bearish trend (score ${score.toFixed(1)}/10) with multi-category confirmation.`)
      if (rrGood) reasons.push('Risk/reward ratio is favorable (≥2:1) for the short side.')
      if (volumeConfirms) reasons.push('Volume confirms the selling pressure.')
      reasons.push('No major signal contradictions — conditions are clear for short entries.')
      break

    case 'Conservative Sell':
      reasons.push(`Bearish bias is present (score ${score.toFixed(1)}/10) but not all conditions align.`)
      if (oversold) reasons.push('RSI is oversold — late entries on the short side are risky.')
      else if (!rrGood && rrAcceptable) reasons.push('Risk/reward is acceptable but not optimal — size conservatively.')
      if (!volumeConfirms) reasons.push('Volume has not confirmed the move — be selective with entry.')
      reasons.push('Enter with reduced size and tight stop management.')
      break

    case 'Avoid':
      if (!actionable) reasons.push('No valid trade setup is available at current price levels.')
      if (setupQuality === 'avoid') reasons.push('Setup geometry is unfavorable — risk/reward does not justify entry.')
      if (setupQuality === 'no_setup') reasons.push('Insufficient support/resistance data to define a trade plan.')
      if (reasons.length === 0) reasons.push('Current market structure does not offer a high-quality opportunity.')
      break
  }

  return reasons.slice(0, 4)
}
