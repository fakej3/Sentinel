import type { Candle } from '../../market/types'
import type { IndicatorResult } from '../../indicators/types'
import type { RelativeVolumeResult, VolumeClassification, VolumeAnalysisConfig } from '../types'

function classify(ratio: number, cfg: VolumeAnalysisConfig): VolumeClassification {
  if (ratio >= cfg.relativeVolumeVeryHigh) return 'very_high'
  if (ratio >= cfg.relativeVolumeHigh) return 'high'
  if (ratio >= cfg.relativeVolumeLow) return 'normal'
  if (ratio >= cfg.relativeVolumeVeryLow) return 'low'
  return 'very_low'
}

/**
 * Compute relative volume for the current (last) candle.
 *
 * Uses Module 2's pre-computed volumeMA when available (non-null).
 * Falls back to computing from raw prior candles when volumeMA is null.
 *
 * The current candle is always excluded from the average (prior bars only).
 */
export function computeRelativeVolume(
  candles: Candle[],
  indicators: IndicatorResult,
  cfg: VolumeAnalysisConfig,
): RelativeVolumeResult {
  const current = candles[candles.length - 1].volume

  // Prefer pre-computed volumeMA from Module 2 when available
  if (indicators.volumeMA !== null) {
    const { ma: average, relativeVolume: ratio } = indicators.volumeMA
    return { current, average, ratio, classification: classify(ratio, cfg) }
  }

  // Fallback: compute from raw candles (fewer than period + 1 available)
  const priorCandles = candles.slice(0, -1)
  if (priorCandles.length === 0) {
    return { current, average: 0, ratio: 0, classification: classify(0, cfg) }
  }

  const period = Math.min(cfg.relativeVolumePeriod, priorCandles.length)
  const slice = priorCandles.slice(-period)
  const average = slice.reduce((s, c) => s + c.volume, 0) / period
  const ratio = average === 0 ? 0 : current / average

  return { current, average, ratio, classification: classify(ratio, cfg) }
}
