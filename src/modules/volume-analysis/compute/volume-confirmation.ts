import type { Candle } from '../../binance/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { RelativeVolumeResult, VolumeConfirmationResult, VolumeAnalysisConfig } from '../types'

function historicalRelativeVolume(
  candles: Candle[],
  index: number,
  period: number,
): number {
  if (index <= 0) return 0
  const priorStart = Math.max(0, index - period)
  const priorCandles = candles.slice(priorStart, index)
  if (priorCandles.length === 0) return 0
  const avg = priorCandles.reduce((s, c) => s + c.volume, 0) / priorCandles.length
  return avg === 0 ? 0 : candles[index].volume / avg
}

export function computeVolumeConfirmation(
  candles: Candle[],
  relativeVolume: RelativeVolumeResult,
  marketStructure: MarketStructureResult,
  cfg: VolumeAnalysisConfig,
): VolumeConfirmationResult {
  const { ratio } = relativeVolume
  const confirmed = ratio >= cfg.confirmationThreshold

  const reason = confirmed
    ? `Volume is ${ratio.toFixed(2)}× the prior average (threshold: ${cfg.confirmationThreshold}×)`
    : `Volume is ${ratio.toFixed(2)}× the prior average — below confirmation threshold of ${cfg.confirmationThreshold}×`

  const current = candles[candles.length - 1]
  const candleDir = current.close > current.open ? 'bullish'
    : current.close < current.open ? 'bearish' : 'neutral'
  // Counter-trend candle direction voids confirmation; neutral (doji) candles are allowed
  const supportsTrend = confirmed
    && !(marketStructure.trend.includes('bullish') && candleDir === 'bearish')
    && !(marketStructure.trend.includes('bearish') && candleDir === 'bullish')
    && marketStructure.trend !== 'ranging'

  const supportsBreakout = confirmed && marketStructure.breakout.confirmed

  const lastBOS = marketStructure.bos.last
  let supportsBOS = false
  if (lastBOS !== null && lastBOS.index < candles.length) {
    const bosRatio = historicalRelativeVolume(
      candles,
      lastBOS.index,
      cfg.relativeVolumePeriod,
    )
    supportsBOS = bosRatio >= cfg.confirmationThreshold
  }

  const lastCHOCH = marketStructure.choch.last
  let supportsCHOCH = false
  if (lastCHOCH !== null && lastCHOCH.index < candles.length) {
    const chochRatio = historicalRelativeVolume(
      candles,
      lastCHOCH.index,
      cfg.relativeVolumePeriod,
    )
    supportsCHOCH = chochRatio >= cfg.confirmationThreshold
  }

  return { confirmed, reason, supportsTrend, supportsBreakout, supportsBOS, supportsCHOCH }
}
