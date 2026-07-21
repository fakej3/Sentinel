import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BinanceWebSocketProvider } from '../BinanceWebSocketProvider'
import type { Candle } from '../../market/types'

// ── Minimal WebSocket mock ─────────────────────────────────────────────────────

type WsHandler = (event: { data?: string }) => void

class MockWebSocket {
  static instances: MockWebSocket[] = []

  url: string
  onopen:    (() => void)              | null = null
  onmessage: WsHandler                 | null = null
  onerror:   (() => void)              | null = null
  onclose:   (() => void)              | null = null
  readyState = WebSocket.CONNECTING

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  open()  { this.readyState = WebSocket.OPEN;   this.onopen?.() }
  error() { this.onerror?.() }
  close() { this.readyState = WebSocket.CLOSED; this.onclose?.() }

  send(msg: string) { this.onmessage?.({ data: msg }) }

  triggerMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

function klineMsg(openTime: number, close = '105.00', isClosed = false) {
  return {
    e: 'kline',
    k: {
      t: openTime,
      T: openTime + 3_599_999,
      o: '100.00',
      h: '110.00',
      l: '90.00',
      c: close,
      v: '1000',
      q: '100000',
      n: 500,
      V: '600',
      x: isClosed,
    },
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.instances = []
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BinanceWebSocketProvider', () => {
  it('has id "binance-ws"', () => {
    const provider = new BinanceWebSocketProvider()
    expect(provider.id).toBe('binance-ws')
  })

  it('opens a WebSocket to the correct Binance stream URL', () => {
    const provider = new BinanceWebSocketProvider()
    provider.subscribeCandle('BTCUSDT', '1h', vi.fn())
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('wss://stream.binance.com:9443/ws/btcusdt@kline_1h')
  })

  it('lowercases the symbol in the stream URL', () => {
    const provider = new BinanceWebSocketProvider()
    provider.subscribeCandle('ETHUSDT', '4h', vi.fn())
    expect(MockWebSocket.instances[0].url).toContain('ethusdt@kline_4h')
  })

  it('calls onCandle with parsed candle data', () => {
    const provider = new BinanceWebSocketProvider()
    const onCandle = vi.fn()
    provider.subscribeCandle('BTCUSDT', '1h', onCandle)
    const ws = MockWebSocket.instances[0]
    ws.open()
    ws.triggerMessage(klineMsg(1_000_000, '105.00', false))

    expect(onCandle).toHaveBeenCalledOnce()
    const [candle, isClosed] = onCandle.mock.calls[0] as [Candle, boolean]
    expect(candle.openTime).toBe(1_000_000)
    expect(candle.close).toBe(105)
    expect(isClosed).toBe(false)
  })

  it('fires onCandle multiple times for the same openTime (live ticks)', () => {
    const provider = new BinanceWebSocketProvider()
    const onCandle = vi.fn()
    provider.subscribeCandle('BTCUSDT', '1h', onCandle)
    const ws = MockWebSocket.instances[0]
    ws.open()
    ws.triggerMessage(klineMsg(1_000_000, '104.00'))
    ws.triggerMessage(klineMsg(1_000_000, '106.00'))
    expect(onCandle).toHaveBeenCalledTimes(2)
  })

  it('skips messages older than the last seen openTime', () => {
    const provider = new BinanceWebSocketProvider()
    const onCandle = vi.fn()
    provider.subscribeCandle('BTCUSDT', '1h', onCandle)
    const ws = MockWebSocket.instances[0]
    ws.open()
    ws.triggerMessage(klineMsg(2_000_000))
    ws.triggerMessage(klineMsg(1_000_000)) // older — should be skipped
    expect(onCandle).toHaveBeenCalledTimes(1)
  })

  it('ignores non-kline messages', () => {
    const provider = new BinanceWebSocketProvider()
    const onCandle = vi.fn()
    provider.subscribeCandle('BTCUSDT', '1h', onCandle)
    MockWebSocket.instances[0].triggerMessage({ e: 'trade', price: '100' })
    expect(onCandle).not.toHaveBeenCalled()
  })

  it('ignores malformed JSON messages', () => {
    const provider = new BinanceWebSocketProvider()
    const onCandle = vi.fn()
    provider.subscribeCandle('BTCUSDT', '1h', onCandle)
    MockWebSocket.instances[0].onmessage?.({ data: 'not-json' })
    expect(onCandle).not.toHaveBeenCalled()
  })

  it('reconnects with backoff after the WebSocket closes', async () => {
    const provider = new BinanceWebSocketProvider()
    provider.subscribeCandle('BTCUSDT', '1h', vi.fn())
    const ws1 = MockWebSocket.instances[0]
    ws1.open()
    ws1.close() // triggers reconnect after 1000ms

    await vi.advanceTimersByTimeAsync(1_000)
    expect(MockWebSocket.instances).toHaveLength(2)
    expect(MockWebSocket.instances[1].url).toBe(ws1.url)
  })

  it('stops reconnecting after unsubscribe', async () => {
    const provider = new BinanceWebSocketProvider()
    const unsub = provider.subscribeCandle('BTCUSDT', '1h', vi.fn())
    const ws1 = MockWebSocket.instances[0]
    ws1.open()
    unsub()
    ws1.close() // would trigger reconnect, but subscription is stopped

    await vi.advanceTimersByTimeAsync(2_000)
    expect(MockWebSocket.instances).toHaveLength(1) // no new WS
  })

  it('resets reconnect attempt counter after a successful open', async () => {
    const provider = new BinanceWebSocketProvider()
    provider.subscribeCandle('BTCUSDT', '1h', vi.fn())
    const ws1 = MockWebSocket.instances[0]
    ws1.open()
    ws1.close()

    await vi.advanceTimersByTimeAsync(1_000)
    const ws2 = MockWebSocket.instances[1]
    ws2.open() // successful reconnect resets counter
    ws2.close()

    await vi.advanceTimersByTimeAsync(1_000) // delay should be 1000ms again (reset)
    expect(MockWebSocket.instances).toHaveLength(3)
  })

  it('fetchCandles returns an empty array', async () => {
    const provider = new BinanceWebSocketProvider()
    const result = await provider.fetchCandles('BTCUSDT', '1h', 100)
    expect(result).toEqual([])
  })

  it('fetchSymbols returns an empty array', async () => {
    const provider = new BinanceWebSocketProvider()
    const result = await provider.fetchSymbols()
    expect(result).toEqual([])
  })

  it('supportsTimeframe returns true for valid timeframes', () => {
    const provider = new BinanceWebSocketProvider()
    expect(provider.supportsTimeframe('1h')).toBe(true)
    expect(provider.supportsTimeframe('1d')).toBe(true)
  })

  it('dispose closes all active subscriptions', () => {
    const provider = new BinanceWebSocketProvider()
    provider.subscribeCandle('BTCUSDT', '1h', vi.fn())
    provider.subscribeCandle('ETHUSDT', '4h', vi.fn())
    expect(MockWebSocket.instances).toHaveLength(2)
    provider.dispose()
    for (const ws of MockWebSocket.instances) {
      expect(ws.readyState).toBe(WebSocket.CLOSED)
    }
  })

  it('isClosed flag is passed through correctly', () => {
    const provider = new BinanceWebSocketProvider()
    const onCandle = vi.fn()
    provider.subscribeCandle('BTCUSDT', '1h', onCandle)
    MockWebSocket.instances[0].open()
    MockWebSocket.instances[0].triggerMessage(klineMsg(1_000_000, '105.00', true))
    expect(onCandle.mock.calls[0][1]).toBe(true)
  })
})
