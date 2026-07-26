import { describe, it, expect, vi } from 'vitest'
import { CandleStore, INITIAL_CANDLES, BACKFILL_CHUNK, MAX_BUFFER } from '../CandleStore'
import type { CandleProvider, CandleUpdate, MarketKind } from '../CandleStore'
import type { Candle, Timeframe } from '../../../modules/market/types'
import type { LiveCandle } from '../../../modules/binance/ws'

const MINUTE = 60_000

function candle(openTime: number, close = 100): Candle {
  return {
    openTime,
    closeTime: openTime + MINUTE - 1,
    open: close, high: close + 1, low: close - 1, close,
    volume: 10, quoteVolume: 1000, trades: 5,
    takerBuyVolume: 5, takerSellVolume: 5,
  }
}

/** Generate `count` contiguous candles ending at (exclusive) `endTime`. */
function candleRange(endTime: number, count: number): Candle[] {
  const out: Candle[] = []
  for (let i = count; i >= 1; i--) out.push(candle(endTime - i * MINUTE))
  return out
}

class MockProvider implements CandleProvider {
  fetchCalls: Array<{ limit: number; endTime?: number }> = []
  liveHandlers: Array<(c: LiveCandle) => void> = []
  unsubscribeCount = 0
  /** When set, fetchCandles rejects with this error once, then clears it. */
  failNext: Error | null = null
  /** Total history the exchange "has" — fetches are clamped to this window. */
  historyStart = 0
  now = 10_000 * MINUTE

  async fetchCandles(
    _symbol: string, _interval: Timeframe, limit: number,
    _market?: MarketKind, endTime?: number,
  ): Promise<{ candles: Candle[]; market: MarketKind }> {
    this.fetchCalls.push({ limit, ...(endTime !== undefined && { endTime }) })
    if (this.failNext) {
      const err = this.failNext
      this.failNext = null
      throw err
    }
    const end = endTime !== undefined ? endTime + 1 : this.now
    const idealStart = end - limit * MINUTE
    const start = Math.max(idealStart, this.historyStart)
    const count = Math.max(0, Math.floor((end - start) / MINUTE))
    return { candles: candleRange(end, count), market: 'spot' }
  }

  subscribeLive(
    _symbol: string, _interval: Timeframe, _market: MarketKind,
    onCandle: (c: LiveCandle) => void,
  ): () => void {
    this.liveHandlers.push(onCandle)
    return () => { this.unsubscribeCount++ }
  }

  emitTick(live: LiveCandle): void {
    for (const h of this.liveHandlers) h(live)
  }
}

function setup() {
  const provider = new MockProvider()
  const store = new CandleStore(provider)
  return { provider, store }
}

async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 0))
}

describe('CandleStore', () => {
  it('delivers an initial snapshot and opens the live socket on first subscribe', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    expect(updates).toHaveLength(1)
    expect(updates[0].type).toBe('snapshot')
    expect(updates[0].candles).toHaveLength(INITIAL_CANDLES)
    expect(provider.fetchCalls[0].limit).toBe(INITIAL_CANDLES)
    expect(provider.liveHandlers).toHaveLength(1)
  })

  it('replays a cached snapshot synchronously on re-subscribe', async () => {
    const { store } = setup()
    const unsub = store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    unsub()

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    // synchronous — no flush needed
    expect(updates).toHaveLength(1)
    expect(updates[0].type).toBe('snapshot')
  })

  it('merges ticks: replaces the in-progress candle, appends a new one', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const snapshot = updates[0].candles
    const last = snapshot[snapshot.length - 1]

    // Same openTime → replace
    provider.emitTick({ ...candle(last.openTime, 105), isClosed: false })
    let latest = updates[updates.length - 1]
    expect(latest.type).toBe('tick')
    expect(latest.candles).toHaveLength(snapshot.length)
    expect(latest.candles[latest.candles.length - 1].close).toBe(105)

    // Newer openTime → append
    provider.emitTick({ ...candle(last.openTime + MINUTE, 106), isClosed: false })
    latest = updates[updates.length - 1]
    expect(latest.candles).toHaveLength(snapshot.length + 1)
  })

  it('ignores out-of-order ticks for older candles', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()
    const countAfterSnapshot = updates.length
    const first = updates[0].candles[0]

    provider.emitTick({ ...candle(first.openTime, 999), isClosed: true })
    expect(updates).toHaveLength(countAfterSnapshot) // no notification
  })

  it('backfills older history, prepends, and reports exhaustion', async () => {
    const { provider, store } = setup()
    // Exchange has snapshot + half a chunk of older history
    provider.historyStart = provider.now - (INITIAL_CANDLES + BACKFILL_CHUNK / 2) * MINUTE
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const added = await store.loadOlder('BTCUSDT', '1m')
    expect(added).toBe(BACKFILL_CHUNK / 2)
    const backfill = updates[updates.length - 1]
    expect(backfill.type).toBe('backfill')
    expect(backfill.candles).toHaveLength(INITIAL_CANDLES + BACKFILL_CHUNK / 2)
    // Sorted ascending, no duplicates
    for (let i = 1; i < backfill.candles.length; i++) {
      expect(backfill.candles[i].openTime).toBeGreaterThan(backfill.candles[i - 1].openTime)
    }

    // Short chunk marked history exhausted — further loads are no-ops
    const again = await store.loadOlder('BTCUSDT', '1m')
    expect(again).toBe(0)
  })

  it('caps the buffer at MAX_BUFFER during backfill', async () => {
    const { store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()

    let total = INITIAL_CANDLES
    while (total < MAX_BUFFER) {
      const added = await store.loadOlder('BTCUSDT', '1m')
      if (added === 0) break
      total += added
    }
    const candles = store.getCandles('BTCUSDT', '1m')!
    expect(candles.length).toBeLessThanOrEqual(MAX_BUFFER)

    // Buffer full → no more backfills
    expect(await store.loadOlder('BTCUSDT', '1m')).toBe(0)
  })

  it('closes the socket on last unsubscribe but keeps data cached', async () => {
    const { provider, store } = setup()
    const unsub = store.subscribe('BTCUSDT', '1m', () => {})
    await flush()

    unsub()
    expect(provider.unsubscribeCount).toBe(1)
    expect(store.getCandles('BTCUSDT', '1m')).not.toBeNull()
  })

  it('reports initial-load errors via onError and recovers on retry', async () => {
    const { provider, store } = setup()
    provider.failNext = new Error('network down')
    const onError = vi.fn()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u), onError)
    await flush()

    expect(onError).toHaveBeenCalledOnce()
    expect(updates).toHaveLength(0)

    await store.retry('BTCUSDT', '1m')
    expect(updates).toHaveLength(1)
    expect(updates[0].type).toBe('snapshot')
  })

  it('shares one series between multiple subscribers', async () => {
    const { provider, store } = setup()
    const a: CandleUpdate[] = []
    const b: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => a.push(u))
    await flush()
    store.subscribe('BTCUSDT', '1m', u => b.push(u))

    // One fetch, one socket, both received snapshots
    expect(provider.fetchCalls).toHaveLength(1)
    expect(provider.liveHandlers).toHaveLength(1)
    expect(a[0].candles).toBe(b[0].candles) // same buffer reference
  })
})
