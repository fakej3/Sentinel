import type { Candle } from '../../market/types'
import type { IndicatorResult } from '../../indicators/types'
import type { VWAPAnalysisResult, VolumeAnalysisConfig } from '../types'

const VWAP_CROSS_LOOKBACK = 5

export function computeVWAPAnalysis(
  candles: Candle[],
  indicators: IndicatorResult,
  cfg: VolumeAnalysisConfig,
): VWAPAnalysisResult {
  const vwap = indicators.vwap
  const currentClose = candles[candles.length - 1].close

  const above = currentClose > vwap
  const below = currentClose < vwap
  const distancePercent = vwap === 0 ? 0 : ((currentClose - vwap) / vwap) * 100

  const withinProximity = Math.abs(distancePercent) <= cfg.vwapProximityPercent

  // Detect a VWAP cross in the most recent VWAP_CROSS_LOOKBACK candles.
  // Approximation: uses the current VWAP value against past closes.
  const recent = candles.slice(-VWAP_CROSS_LOOKBACK)
  let hasCross = false
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].close
    const curr = recent[i].close
    if ((prev <= vwap && curr > vwap) || (prev >= vwap && curr < vwap)) {
      hasCross = true
      break
    }
  }

  const respectingVWAP = withinProximity || hasCross

  return { above, below, distancePercent, respectingVWAP }
}
