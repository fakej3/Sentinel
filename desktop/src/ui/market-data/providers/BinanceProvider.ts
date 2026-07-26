/**
 * BinanceProvider — Binance implementation of CandleProvider.
 *
 * Pure I/O adapter: wraps the REST endpoints and the kline WebSocket.
 * Owns no data, keeps no state, makes no merge decisions.
 */
import type { Candle, Timeframe } from '../../../modules/market/types'
import type { CandleProvider, FetchRangeOptions, LiveHandlers, MarketKind } from '../types'
import { fetchCandlesAuto } from '../../../modules/binance/endpoints'
import { subscribeLiveCandles } from '../../../modules/binance/ws'
import { MAX_CANDLE_LIMIT } from '../../../modules/binance/constants'

export class BinanceProvider implements CandleProvider {
  readonly maxCandlesPerRequest = MAX_CANDLE_LIMIT  // 1000

  fetchCandles(
    symbol: string,
    interval: Timeframe,
    options: FetchRangeOptions,
    market?: MarketKind,
  ): Promise<{ candles: Candle[]; market: MarketKind }> {
    return fetchCandlesAuto(symbol, interval, options.limit, market, options.endTime, options.startTime)
  }

  subscribeLive(
    symbol: string,
    interval: Timeframe,
    market: MarketKind,
    handlers: LiveHandlers,
  ): () => void {
    return subscribeLiveCandles(symbol, interval, handlers.onCandle, market, handlers.onStatus)
  }
}
