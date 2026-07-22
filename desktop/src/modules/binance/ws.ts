import type { Candle, Timeframe } from '../market/types'

const WS_SPOT_BASE       = 'wss://stream.binance.com:9443/ws'
const WS_FUTURES_BASE    = 'wss://fstream.binance.com/ws'
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS     = 30_000

export interface LiveCandle extends Candle {
  readonly isClosed: boolean
}

export type LiveCandleHandler = (candle: LiveCandle) => void

/**
 * Subscribe to Binance kline WebSocket stream for a given symbol + interval.
 * Returns an unsubscribe function; calling it closes the socket and prevents reconnect.
 *
 * Reconnects automatically with exponential backoff (1s → 2s → 4s … → 30s cap).
 */
export function subscribeLiveCandles(
  symbol: string,
  interval: Timeframe,
  onCandle: LiveCandleHandler,
  market: 'spot' | 'futures' = 'spot',
): () => void {
  const wsBase = market === 'futures' ? WS_FUTURES_BASE : WS_SPOT_BASE
  const stream = `${symbol.toLowerCase()}@kline_${interval}`
  const url    = `${wsBase}/${stream}`

  let ws: WebSocket | null = null
  let retryDelay           = INITIAL_BACKOFF_MS
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed            = false

  function connect() {
    if (destroyed) return

    ws = new WebSocket(url)

    ws.onopen = () => {
      retryDelay = INITIAL_BACKOFF_MS  // reset backoff on successful open
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg?.e !== 'kline') return
        const k   = msg.k
        const vol = parseFloat(k.v)
        const tbv = parseFloat(k.V)
        onCandle({
          openTime:        k.t  as number,
          closeTime:       k.T  as number,
          open:            parseFloat(k.o),
          high:            parseFloat(k.h),
          low:             parseFloat(k.l),
          close:           parseFloat(k.c),
          volume:          vol,
          quoteVolume:     parseFloat(k.q),
          trades:          k.n  as number,
          takerBuyVolume:  tbv,
          takerSellVolume: vol - tbv,
          isClosed:        k.x  as boolean,
        })
      } catch {
        // discard malformed frames
      }
    }

    ws.onerror = () => {
      // onerror always precedes onclose; reconnect is handled there
    }

    ws.onclose = () => {
      ws = null
      if (destroyed) return
      retryTimer = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, MAX_BACKOFF_MS)
        connect()
      }, retryDelay)
    }
  }

  connect()

  return function unsubscribe() {
    destroyed = true
    if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null }
    if (ws) {
      ws.onclose = null  // suppress reconnect on intentional close
      ws.close()
      ws = null
    }
  }
}
