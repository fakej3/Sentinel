import type { Candle } from '../../binance/types'
import type { BuySellPressureResult, VolumeAnalysisConfig } from '../types'

/**
 * Computes buy/sell pressure from Binance taker trade data.
 * takerBuyVolume and takerSellVolume are sourced directly from Binance kline data
 * (fields 9 and derived from total volume respectively).
 * These represent aggressive market orders (taker side), not passive limit orders.
 */
export function computeBuySellPressure(
  candles: Candle[],
  cfg: VolumeAnalysisConfig,
): BuySellPressureResult {
  const window = candles.slice(-cfg.pressureWindow)

  let buyVolume = 0
  let sellVolume = 0

  for (const c of window) {
    buyVolume += c.takerBuyVolume
    sellVolume += c.takerSellVolume
  }

  const totalVolume = buyVolume + sellVolume
  const delta = buyVolume - sellVolume
  const deltaPercent = totalVolume === 0 ? 0 : (delta / totalVolume) * 100

  let dominantSide: BuySellPressureResult['dominantSide']
  if (Math.abs(deltaPercent) < cfg.pressureBalanceThreshold) {
    dominantSide = 'balanced'
  } else if (deltaPercent > 0) {
    dominantSide = 'buyers'
  } else {
    dominantSide = 'sellers'
  }

  return { buyVolume, sellVolume, delta, deltaPercent, dominantSide }
}
