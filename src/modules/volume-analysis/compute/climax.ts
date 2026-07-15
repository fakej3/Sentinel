import type { Candle } from '../../market/types'
import type { ClimaxResult, VolumeAnalysisConfig } from '../types'

const CLIMAX_LOOKBACK = 10

export function computeClimax(
  candles: Candle[],
  relativeVolumeRatio: number,
  cfg: VolumeAnalysisConfig,
): ClimaxResult {
  const current = candles[candles.length - 1]

  const range = current.high - current.low
  const body = Math.abs(current.close - current.open)
  const bodyRatio = range === 0 ? 0 : body / range

  const isHighVolume = relativeVolumeRatio >= cfg.climaxThreshold
  const isLargeBody = bodyRatio >= cfg.climaxBodyRatio
  const isSmallBody = bodyRatio <= cfg.exhaustionBodyRatio

  const window = candles.slice(-CLIMAX_LOOKBACK)
  const highestHigh = Math.max(...window.map((c) => c.high))
  const lowestLow = Math.min(...window.map((c) => c.low))

  const isBullishCandle = current.close > current.open
  const isBearishCandle = current.close < current.open
  const isNearHigh = current.high >= highestHigh * 0.999
  const isNearLow = current.low <= lowestLow * 1.001

  const buyingClimax = isHighVolume && isLargeBody && isBullishCandle && isNearHigh
  const sellingClimax = isHighVolume && isLargeBody && isBearishCandle && isNearLow
  const exhaustion = isHighVolume && isSmallBody

  return { buyingClimax, sellingClimax, exhaustion }
}
