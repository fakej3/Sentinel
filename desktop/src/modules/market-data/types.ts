import type { Candle, Timeframe } from '../market/types'

export interface IMarketDataProvider {
  readonly id: string

  /**
   * Fetch historical candles. For REST providers, `limit` is the candle count
   * (may paginate internally if limit > 1000). For WS-only providers, returns [].
   */
  fetchCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]>

  /**
   * Subscribe to live candle updates. `isClosed` is true when Binance marks the
   * kline as complete (the bar has closed). Returns an unsubscribe function.
   * For REST-only providers, returns a no-op unsubscribe immediately.
   */
  subscribeCandle(
    symbol: string,
    timeframe: Timeframe,
    onCandle: (candle: Candle, isClosed: boolean) => void,
  ): () => void

  /**
   * Return a list of supported trading symbols. May make a network call.
   * For WS-only providers, returns [].
   */
  fetchSymbols(): Promise<string[]>

  supportsTimeframe(tf: Timeframe): boolean

  /** Release persistent resources (open sockets, timers). */
  dispose(): void
}
