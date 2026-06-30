import type { VolumeAnalysisResult } from '../../volume-analysis/types'
import type { ClimaxSignalType, VolumeContextResult } from '../types'

export function buildVolumeContext(volumeAnalysis: VolumeAnalysisResult): VolumeContextResult {
  const { relativeVolume, climax, accumulationDistribution, vwapAnalysis, obvAnalysis, volumeConfirmation, overallStrength } = volumeAnalysis

  let climaxSignal: ClimaxSignalType = 'none'
  if (climax.buyingClimax) climaxSignal = 'buying_climax'
  else if (climax.sellingClimax) climaxSignal = 'selling_climax'
  else if (climax.exhaustion) climaxSignal = 'exhaustion'

  return {
    relativeVolume: relativeVolume.ratio,
    volumeClassification: relativeVolume.classification,
    confirmsCurrentMove: volumeConfirmation.confirmed,
    climaxSignal,
    accDistState: accumulationDistribution.state,
    priceAboveVWAP: vwapAnalysis.above,
    vwapDistancePercent: vwapAnalysis.distancePercent,
    respectingVWAP: vwapAnalysis.respectingVWAP,
    obvDirection: obvAnalysis.direction,
    obvConfirmingPrice: obvAnalysis.confirmingPrice,
    overallStrength,
  }
}
