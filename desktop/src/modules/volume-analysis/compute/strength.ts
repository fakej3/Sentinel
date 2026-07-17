import type {
  RelativeVolumeResult,
  VolumeTrendResult,
  BuySellPressureResult,
  OBVAnalysisResult,
  AccumulationDistributionResult,
} from '../types'

/**
 * Computes a 0–10 composite volume strength score from sub-module outputs.
 *
 * Component breakdown (max 10 total):
 *   Relative volume classification : 0–3
 *   Volume trend confidence         : 0–2  (r2-based, scaled from 0–10)
 *   Buy/sell pressure imbalance     : 0–2
 *   OBV confirming price            : 0–1
 *   Accumulation/distribution score : 0–2  (acc/dist score mapped from −10..+10 → 0..2)
 */
export function computeOverallStrength(
  relVol: RelativeVolumeResult,
  trend: VolumeTrendResult,
  pressure: BuySellPressureResult,
  obv: OBVAnalysisResult,
  accDist: AccumulationDistributionResult,
): number {
  let score = 0

  // Relative volume: very_low=0, low=0.5, normal=1, high=2, very_high=3
  switch (relVol.classification) {
    case 'very_high': score += 3; break
    case 'high':      score += 2; break
    case 'normal':    score += 1; break
    case 'low':       score += 0.5; break
    case 'very_low':  score += 0; break
  }

  // Volume trend confidence: 0–10 → 0–2
  score += (trend.confidence / 10) * 2

  // Buy/sell pressure dominance
  if (pressure.dominantSide !== 'balanced') {
    const absPercent = Math.abs(pressure.deltaPercent)
    score += Math.min(2, absPercent / 50 * 2)
  }

  // OBV confirmation
  if (obv.confirmingPrice) score += 1

  // Accumulation/distribution: map −10..+10 → 0..2
  score += ((accDist.score + 10) / 20) * 2

  return Math.min(10, Math.max(0, Math.round(score * 10) / 10))
}
