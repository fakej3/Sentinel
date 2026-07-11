import type { MarketStructureResult } from '../../market-structure/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type {
  BuySellPressureResult,
  OBVAnalysisResult,
  VWAPAnalysisResult,
  AccumulationDistributionResult,
} from '../types'

/**
 * Rule-based accumulation/distribution scoring.
 * Score range: −10 (pure distribution) to +10 (pure accumulation).
 * state: score > 3 → accumulation; score < −3 → distribution; else neutral
 */
export function computeAccumulationDistribution(
  marketStructure: MarketStructureResult,
  supportResistance: SupportResistanceResult,
  pressure: BuySellPressureResult,
  obv: OBVAnalysisResult,
  vwap: VWAPAnalysisResult,
): AccumulationDistributionResult {
  let score = 0

  // Buy/sell pressure
  if (pressure.dominantSide === 'buyers') score += 1
  else if (pressure.dominantSide === 'sellers') score -= 1

  // OBV trend alignment — use direction directly to avoid the ambiguity in confirmingPrice
  if (obv.direction === 'bullish' && marketStructure.trend === 'bullish')      score += 2
  else if (obv.direction === 'bearish' && marketStructure.trend === 'bearish') score -= 2
  else if (obv.direction === 'bullish' && marketStructure.trend === 'bearish') score += 1  // bullish divergence
  else if (obv.direction === 'bearish' && marketStructure.trend === 'bullish') score -= 1  // bearish divergence

  // Price vs VWAP
  if (vwap.above) score += 1
  else if (vwap.below) score -= 1

  // Market structure events
  const lastBOS = marketStructure.bos.last
  if (lastBOS !== null) {
    if (lastBOS.direction === 'bullish') score += 1
    else score -= 1
  }

  const lastCHOCH = marketStructure.choch.last
  if (lastCHOCH !== null) {
    if (lastCHOCH.direction === 'bullish') score += 2
    else score -= 2
  }

  // S/R proximity
  if (supportResistance.currentZone !== null) {
    if (supportResistance.currentZone.type === 'support') score += 1
    else score -= 1
  }

  const clamped = Math.min(10, Math.max(-10, score))

  let state: AccumulationDistributionResult['state']
  if (clamped > 3) state = 'accumulation'
  else if (clamped < -3) state = 'distribution'
  else state = 'neutral'

  return { state, score: clamped }
}
