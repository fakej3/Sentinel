import { analyzeMarket } from '../pipeline/index'
import type { PipelineResult, PipelineConfig } from '../pipeline/types'
import type { Ticker24h } from '../market/types'
import type { BenchmarkDataset } from './types'

function buildTicker(dataset: BenchmarkDataset): Ticker24h {
  const { candles, symbol } = dataset
  const last = candles[candles.length - 1]
  const first = candles[0]
  const lastPrice = last?.close ?? 0
  const firstPrice = first?.close ?? 0
  return {
    symbol,
    priceChange: lastPrice - firstPrice,
    priceChangePercent:
      firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0,
    weightedAvgPrice: lastPrice,
    lastPrice,
    bidPrice: lastPrice,
    askPrice: lastPrice,
    openPrice: firstPrice,
    highPrice: candles.reduce((m, c) => Math.max(m, c.high), -Infinity),
    lowPrice: candles.reduce((m, c) => Math.min(m, c.low), Infinity),
    volume: candles.reduce((s, c) => s + c.volume, 0),
    quoteVolume: candles.reduce((s, c) => s + c.quoteVolume, 0),
    openTime: first?.openTime ?? 0,
    closeTime: last?.closeTime ?? 0,
    tradeCount: candles.reduce((s, c) => s + c.trades, 0),
  }
}

export async function replayDataset(
  dataset: BenchmarkDataset,
  pipelineConfig?: Partial<PipelineConfig>,
): Promise<PipelineResult> {
  const ticker = buildTicker(dataset)
  const fetchedAt = (dataset.metadata?.fetchedAt as number | undefined) ?? 0

  return analyzeMarket({
    symbol: dataset.symbol,
    interval: dataset.interval,
    config: pipelineConfig,
    fetchImpl: async (symbol, timeframe) => ({
      symbol: symbol.toUpperCase(),
      timeframe,
      fetchedAt,
      candles: dataset.candles,
      ticker,
      fundingRate: null,
      openInterest: null,
    }),
  })
}
