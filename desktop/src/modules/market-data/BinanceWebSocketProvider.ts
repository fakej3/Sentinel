import { VALID_TIMEFRAMES } from '../binance/constants'
import type { Candle, Timeframe } from '../market/types'
import type { IMarketDataProvider } from './types'

const WS_BASE_URL = 'wss://stream.binance.com:9443/ws'
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const

// Shape of the Binance kline WebSocket message
interface RawKlineMessage {
  e: string                  // Event type ("kline")
  k: {
    t: number                // Kline open time (ms)
    T: number                // Kline close time (ms)
    o: string                // Open price
    h: string                // High price
    l: string                // Low price
    c: string                // Close price
    v: string                // Base asset volume
    q: string                // Quote asset volume
    n: number                // Number of trades
    V: string                // Taker buy base asset volume
    x: boolean               // Is this kline closed?
  }
}

function parseKline(msg: RawKlineMessage): { candle: Candle; isClosed: boolean } {
  const k = msg.k
  const baseVolume = parseFloat(k.v)
  const takerBuy   = parseFloat(k.V)
  return {
    candle: {
      openTime:        k.t,
      closeTime:       k.T,
      open:            parseFloat(k.o),
      high:            parseFloat(k.h),
      low:             parseFloat(k.l),
      close:           parseFloat(k.c),
      volume:          baseVolume,
      quoteVolume:     parseFloat(k.q),
      trades:          k.n,
      takerBuyVolume:  takerBuy,
      takerSellVolume: baseVolume - takerBuy,
    },
    isClosed: k.x,
  }
}

interface Subscription {
  symbol:            string
  timeframe:         Timeframe
  onCandle:          (candle: Candle, isClosed: boolean) => void
  lastOpenTime:      number
  reconnectAttempt:  number
  ws:                WebSocket | null
  stopped:           boolean
}

export class BinanceWebSocketProvider implements IMarketDataProvider {
  readonly id = 'binance-ws'
  private readonly subs = new Set<Subscription>()

  // WS provider has no historical data — callers should pair with BinanceRestProvider
  fetchCandles(_symbol: string, _timeframe: Timeframe, _limit?: number): Promise<Candle[]> {
    return Promise.resolve([])
  }

  subscribeCandle(
    symbol: string,
    timeframe: Timeframe,
    onCandle: (candle: Candle, isClosed: boolean) => void,
  ): () => void {
    const sub: Subscription = {
      symbol:           symbol.toLowerCase(),
      timeframe,
      onCandle,
      lastOpenTime:     -1,
      reconnectAttempt: 0,
      ws:               null,
      stopped:          false,
    }
    this.subs.add(sub)
    this.connect(sub)
    return () => this.unsubscribe(sub)
  }

  private connect(sub: Subscription): void {
    if (sub.stopped) return

    const stream = `${sub.symbol}@kline_${sub.timeframe}`
    const ws = new WebSocket(`${WS_BASE_URL}/${stream}`)
    sub.ws = ws

    ws.onopen = () => {
      sub.reconnectAttempt = 0
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as RawKlineMessage
        if (msg.e !== 'kline') return
        const { candle, isClosed } = parseKline(msg)
        // Skip messages older than the last seen candle (stale after reconnect)
        if (candle.openTime < sub.lastOpenTime) return
        sub.lastOpenTime = candle.openTime
        sub.onCandle(candle, isClosed)
      } catch {
        // Malformed message — silently discard
      }
    }

    ws.onerror = () => {
      // onerror is always followed by onclose; handle reconnect there
    }

    ws.onclose = () => {
      if (sub.stopped) return
      if (sub.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) return
      const delay = RECONNECT_DELAYS_MS[sub.reconnectAttempt] ?? RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1]
      sub.reconnectAttempt++
      setTimeout(() => this.connect(sub), delay)
    }
  }

  private unsubscribe(sub: Subscription): void {
    sub.stopped = true
    sub.ws?.close()
    sub.ws = null
    this.subs.delete(sub)
  }

  fetchSymbols(): Promise<string[]> {
    return Promise.resolve([])
  }

  supportsTimeframe(tf: Timeframe): boolean {
    return VALID_TIMEFRAMES.has(tf)
  }

  dispose(): void {
    for (const sub of this.subs) this.unsubscribe(sub)
    this.subs.clear()
  }
}
