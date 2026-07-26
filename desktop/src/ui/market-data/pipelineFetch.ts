/**
 * Store-backed FetchFn for the analysis pipeline.
 *
 * On desktop the pipeline runs inside the webview (TauriTransport), so its
 * market-data fetch can be routed through the CandleStore. Result: the
 * analysis is computed over EXACTLY the candles the chart is displaying —
 * one buffer, no second fetch, no chart/analysis divergence.
 *
 * The 24h ticker is not candle data and is fetched directly (cheap, single
 * request); candles — the data that must never diverge — come from the store.
 */
import type { FetchFn } from '../../modules/pipeline/types'
import type { MarketData } from '../../modules/market/types'
import { fetchTicker24hAuto } from '../../modules/binance/endpoints'
import { DEFAULT_CANDLE_LIMIT } from '../../modules/binance/constants'
import type { CandleStore } from './CandleStore'

export function createStoreFetchFn(store: CandleStore): FetchFn {
  return async (symbol, timeframe, options): Promise<MarketData> => {
    const upper = symbol.toUpperCase()
    const limit = options.candleLimit ?? DEFAULT_CANDLE_LIMIT

    const [{ candles, market }, { ticker }] = await Promise.all([
      store.fetchSnapshot(upper, timeframe, limit),
      fetchTicker24hAuto(upper),
    ])

    return {
      symbol: upper,
      timeframe,
      fetchedAt: Date.now(),
      candles,
      ticker,
      market,
      fundingRate: null,
      openInterest: null,
    }
  }
}
