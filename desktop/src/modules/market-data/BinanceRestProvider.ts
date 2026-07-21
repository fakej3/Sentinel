import { spotRequest, BinanceApiError } from '../binance/client'
import { normaliseCandles, type RawCandle } from '../binance/normalise'
import { VALID_TIMEFRAMES, MAX_CANDLE_LIMIT } from '../binance/constants'
import type { Candle, Timeframe } from '../market/types'
import type { IMarketDataProvider } from './types'

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const

interface RawExchangeInfo {
  symbols: Array<{ symbol: string; status: string }>
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      // 4xx errors are client mistakes — retrying won't help
      if (err instanceof BinanceApiError && err.statusCode !== undefined &&
          err.statusCode >= 400 && err.statusCode < 500) {
        throw err
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise<void>(r => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      }
    }
  }
  throw lastErr
}

export class BinanceRestProvider implements IMarketDataProvider {
  readonly id = 'binance-rest'

  async fetchCandles(symbol: string, timeframe: Timeframe, limit = 200): Promise<Candle[]> {
    const upper = symbol.toUpperCase()

    if (!VALID_TIMEFRAMES.has(timeframe)) {
      throw new BinanceApiError(`Invalid timeframe: "${timeframe}"`)
    }

    if (limit <= MAX_CANDLE_LIMIT) {
      return withRetry(() =>
        spotRequest<RawCandle[]>('/api/v3/klines', { symbol: upper, interval: timeframe, limit })
          .then(normaliseCandles),
      )
    }

    // Paginate backwards for requests exceeding the 1000-candle per-request limit
    const pages: Candle[][] = []
    let remaining = limit
    let endTime: number | undefined

    while (remaining > 0) {
      const pageLimit = Math.min(remaining, MAX_CANDLE_LIMIT)
      const params: Record<string, string | number> = {
        symbol: upper,
        interval: timeframe,
        limit: pageLimit,
      }
      if (endTime !== undefined) params.endTime = endTime

      const page = await withRetry(() =>
        spotRequest<RawCandle[]>('/api/v3/klines', params).then(normaliseCandles),
      )

      if (page.length === 0) break
      pages.unshift(page)
      remaining -= page.length
      endTime = page[0].openTime - 1
      if (page.length < pageLimit) break
    }

    // Flatten and deduplicate (pages are already in ascending order after unshift)
    const all = pages.flat()
    const seen = new Set<number>()
    return all.filter(c => {
      const ok = !seen.has(c.openTime)
      seen.add(c.openTime)
      return ok
    })
  }

  // REST provider does not support live streaming
  subscribeCandle(
    _symbol: string,
    _timeframe: Timeframe,
    _onCandle: (candle: Candle, isClosed: boolean) => void,
  ): () => void {
    return () => {}
  }

  async fetchSymbols(): Promise<string[]> {
    const info = await withRetry(() =>
      spotRequest<RawExchangeInfo>('/api/v3/exchangeInfo', {}),
    )
    return info.symbols.filter(s => s.status === 'TRADING').map(s => s.symbol)
  }

  supportsTimeframe(tf: Timeframe): boolean {
    return VALID_TIMEFRAMES.has(tf)
  }

  dispose(): void {}
}
