import type { Candle } from '../../market/types'
import type { OBVAnalysisResult, VolumeAnalysisConfig } from '../types'
import { localOBVSeries, linearRegression } from './utils'

export function computeOBVAnalysis(
  candles: Candle[],
  cfg: VolumeAnalysisConfig,
): OBVAnalysisResult {
  const window = candles.slice(-cfg.volumeTrendWindow)

  if (window.length < 2) {
    return { direction: 'neutral', confirmingPrice: false, diverging: false }
  }

  const obvSeries = localOBVSeries(window)
  const { slope: obvSlope } = linearRegression(obvSeries)

  const closes = window.map((c) => c.close)
  const { slope: priceSlope } = linearRegression(closes)

  let direction: OBVAnalysisResult['direction']
  if (obvSlope > 0) direction = 'bullish'
  else if (obvSlope < 0) direction = 'bearish'
  else direction = 'neutral'

  const obvUp = obvSlope > 0
  const obvDown = obvSlope < 0
  const priceUp = priceSlope > 0
  const priceDown = priceSlope < 0

  const confirmingPrice = (obvUp && priceUp) || (obvDown && priceDown)
  const diverging = (obvUp && priceDown) || (obvDown && priceUp)

  return { direction, confirmingPrice, diverging }
}
