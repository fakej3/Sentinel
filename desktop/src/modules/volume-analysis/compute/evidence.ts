import type {
  RelativeVolumeResult,
  VolumeTrendResult,
  BuySellPressureResult,
  VolumeConfirmationResult,
  ClimaxResult,
  AccumulationDistributionResult,
  OBVAnalysisResult,
  VWAPAnalysisResult,
} from '../types'

export function buildEvidence(
  relVol: RelativeVolumeResult,
  trend: VolumeTrendResult,
  pressure: BuySellPressureResult,
  confirmation: VolumeConfirmationResult,
  climax: ClimaxResult,
  accDist: AccumulationDistributionResult,
  obv: OBVAnalysisResult,
  vwap: VWAPAnalysisResult,
  overallStrength: number,
): string[] {
  const lines: string[] = []

  // Relative volume
  lines.push(
    `Relative volume: ${relVol.ratio.toFixed(2)}× average (${relVol.classification}); current=${relVol.current.toFixed(2)}, avg=${relVol.average.toFixed(2)}`,
  )

  // Volume trend
  lines.push(...trend.evidence)

  // Buy/sell pressure
  lines.push(
    `Buy/sell pressure: buy=${pressure.buyVolume.toFixed(2)}, sell=${pressure.sellVolume.toFixed(2)}, delta=${pressure.delta.toFixed(2)} (${pressure.deltaPercent.toFixed(1)}%) → ${pressure.dominantSide}`,
  )

  // Volume confirmation
  lines.push(confirmation.reason)
  if (confirmation.supportsTrend) lines.push('Volume confirms the current trend direction')
  if (confirmation.supportsBreakout) lines.push('Volume confirms the breakout')
  if (confirmation.supportsBOS) lines.push('Volume confirmed the most recent BOS')
  if (confirmation.supportsCHOCH) lines.push('Volume confirmed the most recent CHOCH')

  // Climax / exhaustion
  if (climax.buyingClimax) lines.push('Buying climax detected: high volume + bullish body + multi-bar high close')
  if (climax.sellingClimax) lines.push('Selling climax detected: high volume + bearish body + multi-bar low close')
  if (climax.exhaustion) lines.push('Volume exhaustion detected: high volume with small body (equilibrium)')

  // Accumulation / distribution
  lines.push(`Accumulation/distribution: ${accDist.state} (score ${accDist.score})`)

  // OBV
  lines.push(
    `OBV trend: ${obv.direction}; confirming price=${obv.confirmingPrice}, diverging=${obv.diverging}`,
  )

  // VWAP
  const side = vwap.above ? 'above' : vwap.below ? 'below' : 'at'
  lines.push(
    `Price is ${side} VWAP by ${vwap.distancePercent.toFixed(2)}%; respecting VWAP=${vwap.respectingVWAP}`,
  )

  // Overall strength
  lines.push(`Overall volume strength: ${overallStrength.toFixed(1)}/10`)

  return lines
}
