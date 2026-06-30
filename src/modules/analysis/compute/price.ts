import type { MarketData } from '../../binance/types'
import type { IndicatorResult } from '../../indicators/types'
import type { PriceSummary } from '../types'

export function extractPriceSummary(
  marketData: MarketData,
  indicators: IndicatorResult,
): PriceSummary {
  const { ticker } = marketData
  return {
    current: ticker.lastPrice,
    change24hPercent: ticker.priceChangePercent,
    high24h: ticker.highPrice,
    low24h: ticker.lowPrice,
    atrPercent: indicators.atrPercent,
  }
}
