import type { MarketAnalysisResult } from '../../analysis/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { TradePlan } from '../types'

/**
 * Derives an actionable trade plan from the S/R context, trend, and confidence.
 *
 * Entry zone: for bullish trends, near nearest support; for bearish, near nearest resistance.
 * Invalidation: the level at which the directional thesis is broken.
 * Target: the nearest opposing S/R level.
 */
export function computeTradePlan(
  analysis: MarketAnalysisResult,
  supportResistance: SupportResistanceResult,
  confidence: ConfidenceResult,
): TradePlan {
  const { fullTrend, srContext, price } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance

  // ── Entry zone ────────────────────────────────────────────────────────────
  let entryZone: TradePlan['entryZone'] = null
  if (isBullish && nearestSupport) {
    entryZone = { lower: nearestSupport.lower, upper: nearestSupport.upper }
  } else if (isBearish && nearestResistance) {
    entryZone = { lower: nearestResistance.lower, upper: nearestResistance.upper }
  }

  // ── Invalidation level ────────────────────────────────────────────────────
  // Bullish: a close below support breaks the thesis.
  // Bearish: a close above resistance breaks the thesis.
  let invalidationLevel: number | null = null
  if (isBullish && nearestSupport) {
    invalidationLevel = Math.round(nearestSupport.lower * 0.995 * 100) / 100
  } else if (isBearish && nearestResistance) {
    invalidationLevel = Math.round(nearestResistance.upper * 1.005 * 100) / 100
  }

  // ── Target level ──────────────────────────────────────────────────────────
  let targetLevel: number | null = null
  if (isBullish && nearestResistance) {
    targetLevel = nearestResistance.center
  } else if (isBearish && nearestSupport) {
    targetLevel = nearestSupport.center
  }

  // ── Risk / reward ratio ───────────────────────────────────────────────────
  let riskRewardRatio: number | null = null
  if (invalidationLevel !== null && targetLevel !== null) {
    const risk   = Math.abs(price.current - invalidationLevel)
    const reward = Math.abs(targetLevel - price.current)
    if (risk > 0) riskRewardRatio = Math.round((reward / risk) * 100) / 100
  }

  // ── Patience message ──────────────────────────────────────────────────────
  let patienceMessage: string
  if (!isBullish && !isBearish) {
    patienceMessage = 'Market is ranging — wait for a clear directional break before committing'
  } else if (trend.includes('strong') && confidence.score >= 7) {
    patienceMessage = 'Strong confirmed trend — entries on pullbacks to key EMAs or the entry zone are appropriate'
  } else if (trend.includes('strong')) {
    patienceMessage = 'Strong trend structure but confidence is mixed — wait for a higher-quality pullback setup'
  } else if (trend.includes('moderate')) {
    patienceMessage = srContext.approachingSupport || srContext.approachingResistance
      ? 'Approaching a key level — watch for reaction here before entering'
      : 'Moderate trend — wait for price to reach the entry zone before committing'
  } else {
    patienceMessage = 'Weak trend signal — be patient; let the trend strengthen before entering'
  }

  return { entryZone, invalidationLevel, targetLevel, riskRewardRatio, patienceMessage }
}
