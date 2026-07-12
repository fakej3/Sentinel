import type { MarketAnalysisResult } from '../../analysis/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { TradePlan, MarketContext, OpportunityAssessment, QualityLevel } from '../types'

/**
 * Separates overall market quality from the current trading opportunity quality.
 * marketQuality = how good the market conditions are (trend, ADX, confluence).
 * tradingOpportunity = how good the setup is right now (from tradePlan.setupQuality).
 */
export function computeOpportunityAssessment(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  tradePlan: TradePlan,
  marketContext: MarketContext,
): OpportunityAssessment {
  const marketQuality = deriveMarketQuality(analysis, confidence, marketContext)
  const marketQualityDetail = describeMarketQuality(marketQuality, analysis, confidence)

  const tradingOpportunity = deriveOpportunityLevel(tradePlan)
  const tradingOpportunityDetail = describeOpportunity(tradingOpportunity, tradePlan)

  const combinedMessage = buildCombinedMessage(marketQuality, tradingOpportunity, marketContext)

  return {
    marketQuality,
    marketQualityDetail,
    tradingOpportunity,
    tradingOpportunityDetail,
    combinedMessage,
  }
}

function deriveMarketQuality(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  marketContext: MarketContext,
): QualityLevel {
  const { score, analysisQuality } = confidence
  const adxStrong = analysis.indicatorSummary.adx.trendStrength === 'strong'
    || analysis.indicatorSummary.adx.trendStrength === 'very_strong'
  const confluenceHigh = analysisQuality.confluence.agreementRatio >= 0.65
  const hasContradictions = analysisQuality.contradictions.some(c => c.severity === 'strong')

  if (score >= 7.5 && adxStrong && confluenceHigh && !hasContradictions) return 'excellent'
  if (score >= 5.5 && (adxStrong || confluenceHigh) && !hasContradictions) return 'good'
  if (score >= 4.0 && !hasContradictions) return 'fair'
  return 'poor'
}

function describeMarketQuality(
  level: QualityLevel,
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
): string {
  const scoreStr = confidence.score.toFixed(1)
  const adxRaw = analysis.indicatorSummary.adx.adx
  const adxStr = adxRaw !== null ? `, ADX ${adxRaw.toFixed(0)}` : ''
  switch (level) {
    case 'excellent':
      return `Excellent market conditions: score ${scoreStr}/10${adxStr}, strong multi-category agreement.`
    case 'good':
      return `Good market conditions: score ${scoreStr}/10 with reasonable directional clarity.`
    case 'fair':
      return `Fair market conditions: score ${scoreStr}/10 — some uncertainty present.`
    case 'poor':
      return `Poor market conditions: score ${scoreStr}/10 — contradictions and low conviction weaken the picture.`
  }
}

function deriveOpportunityLevel(tradePlan: TradePlan): QualityLevel | 'none' {
  switch (tradePlan.setupQuality) {
    case 'excellent': return 'excellent'
    case 'good':      return 'good'
    case 'average':   return 'fair'
    case 'poor':      return 'poor'
    case 'avoid':
    case 'no_setup':  return 'none'
  }
}

function describeOpportunity(level: QualityLevel | 'none', tradePlan: TradePlan): string {
  if (level === 'none') {
    return tradePlan.setupQuality === 'no_setup'
      ? 'No trade setup available — insufficient price level data.'
      : 'Setup geometry is unfavorable — risk/reward does not justify entry.'
  }
  const rrStr = tradePlan.riskRewardRatio !== null ? ` RR: ${tradePlan.riskRewardRatio.toFixed(2)}:1.` : ''
  // Surface the downgrade reason when setup was degraded from a higher tier
  const isDowngraded = tradePlan.setupQualityReason.includes('downgraded') || tradePlan.setupQualityReason.includes('degraded')
  const downgradeNote = isDowngraded ? ` ${tradePlan.setupQualityReason.split('—')[1]?.trim() ?? ''}`.trimEnd() : ''
  // Module 41 maturity annotation
  const maturityNote = tradePlan.maturityScore < 45
    ? ` Maturity: ${tradePlan.maturityScore}/100 (${tradePlan.maturityLabel}).`
    : ''
  switch (level) {
    case 'excellent': return `Excellent setup:${rrStr} Entry, stop, and target are clearly defined.${maturityNote}`
    case 'good':      return isDowngraded
      ? `Good setup (downgraded):${rrStr}${downgradeNote ? ` ${downgradeNote}.` : ' Conditions reduced setup reliability.'}${maturityNote}`
      : `Good setup:${rrStr} Levels are defined and conditions are favorable.${maturityNote}`
    case 'fair':      return isDowngraded
      ? `Marginal setup (downgraded):${rrStr}${downgradeNote ? ` ${downgradeNote}.` : ' Conditions reduce setup reliability.'}${maturityNote}`
      : `Marginal setup:${rrStr} Conditions are acceptable but not ideal.${maturityNote}`
    case 'poor':      return `Poor setup:${rrStr} Proceed with caution — setup quality is low.${maturityNote}`
  }
}

function buildCombinedMessage(
  marketQuality: QualityLevel,
  opportunity: QualityLevel | 'none',
  marketContext: MarketContext,
): string {
  if (opportunity === 'none') {
    const mq = marketQuality === 'excellent' || marketQuality === 'good'
      ? 'Market conditions are favorable'
      : 'Market conditions are uncertain'
    return `${mq}, but no actionable trade setup is available at current levels.`
  }

  const mRank = qualityRank(marketQuality)
  const oRank = opportunityRank(opportunity)

  if (mRank >= 3 && oRank >= 3) {
    return 'Both market conditions and the trade setup are strong — this is a high-quality opportunity.'
  }
  if (mRank >= 3 && oRank < 3) {
    return 'Market conditions are favorable but the current setup is not ideal — consider waiting for a cleaner entry.'
  }
  if (mRank < 3 && oRank >= 3) {
    return 'A trade setup is available, but overall market conditions are mixed — size down and manage risk carefully.'
  }
  if (marketContext.isTrending) {
    return 'Both market quality and setup quality are moderate — this is a marginal opportunity at best.'
  }
  return 'Conditions are unclear — waiting for a better market structure is advisable.'
}

function qualityRank(q: QualityLevel): number {
  switch (q) {
    case 'excellent': return 4
    case 'good':      return 3
    case 'fair':      return 2
    case 'poor':      return 1
  }
}

function opportunityRank(q: QualityLevel | 'none'): number {
  switch (q) {
    case 'excellent': return 4
    case 'good':      return 3
    case 'fair':      return 2
    case 'poor':      return 1
    case 'none':      return 0
  }
}
