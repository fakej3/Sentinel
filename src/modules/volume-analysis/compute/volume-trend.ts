import type { Candle } from '../../market/types'
import type { VolumeTrendResult, VolumeAnalysisConfig } from '../types'
import { linearRegression } from './utils'

export function computeVolumeTrend(candles: Candle[], cfg: VolumeAnalysisConfig): VolumeTrendResult {
  const window = candles.slice(-cfg.volumeTrendWindow)
  const volumes = window.map((c) => c.volume)

  if (volumes.length < 2) {
    return { direction: 'flat', confidence: 0, evidence: ['Insufficient candles for volume trend analysis'] }
  }

  const { slope, r2 } = linearRegression(volumes)
  const meanVolume = volumes.reduce((s, v) => s + v, 0) / volumes.length
  const normalizedSlope = meanVolume === 0 ? 0 : slope / meanVolume
  const confidence = Math.min(10, Math.max(0, r2 * 10))

  let direction: VolumeTrendResult['direction']
  if (normalizedSlope > cfg.volumeSlopeThreshold) {
    direction = 'increasing'
  } else if (normalizedSlope < -cfg.volumeSlopeThreshold) {
    direction = 'decreasing'
  } else {
    direction = 'flat'
  }

  const evidence: string[] = [
    `Volume trend window: ${volumes.length} candles`,
    `Mean volume: ${meanVolume.toFixed(2)}`,
    `Regression slope: ${slope.toFixed(4)} (normalized: ${(normalizedSlope * 100).toFixed(2)}% per candle)`,
    `R²: ${r2.toFixed(3)} → confidence ${confidence.toFixed(1)}/10`,
    `Direction: ${direction} (threshold ±${(cfg.volumeSlopeThreshold * 100).toFixed(1)}%)`,
  ]

  return { direction, confidence, evidence }
}
