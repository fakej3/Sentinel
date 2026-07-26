import { describe, it, expect, vi } from 'vitest'
import { CandleStore, INITIAL_CANDLES, MAX_BUFFER } from '../CandleStore'
import { InMemoryCandleCache } from '../cache/CandleCache'
import type { CandleProvider, CandleUpdate, FetchRangeOptions, LiveHandlers, MarketKind } from '../types'
import type { Candle, Timeframe } from '../../../modules/market/types'
import type { LiveCandle, LiveStreamStatus } from '../../../modules/binance/ws'

const MINUTE = 60_000
const CHUNK  = 1000

function candle(openTime: number, close = 100): Candle {
  return {
    openTime,
    closeTime: openTime + MINUTE - 1,
    open: close, high: close + 1, low: close - 1, close,
    volume: 10, quoteVolume: 1000, trades: 5,
    takerBuyVolume: 5, takerSellVolume: 5,
  }
}

/** Generate contiguous candles in [start, end) stepped by 1 minute. */
function candlesBetween(start: number, end: number): Candle[] {
  const out: Candle[] = []
  for (let t = start; t < end; t += MINUTE) out.push(candle(t))
  return out
}

class MockProvider implements CandleProvider {
  readonly maxCandlesPerRequest = CHUNK
  fetchCalls: FetchRangeOptions[] = []
  liveHandlers: LiveHandlers[] = []
  unsubscribeCount = 0
  failNext: Error | null = null
  /** Oldest timestamp the exchange "has". */
  historyStart = 0
  now = 100_000 * MINUTE

  async fetchCandles(
    _symbol: string, _interval: Timeframe, options: FetchRangeOptions, _market?: MarketKind,
  ): Promise<{ candles: Candle[]; market: MarketKind }> {
    this.fetchCalls.push(options)
    if (this.failNext) {
      const err = this.failNext
      this.failNext = null
      throw err
    }
    const limit = Math.min(options.limit, this.maxCandlesPerRequest)
    let start: number
    let end: number
    if (options.startTime !== undefined) {
      start = Math.max(options.startTime, this.historyStart)
      end   = Math.min(start + limit * MINUTE, this.now)
    } else {
      end   = options.endTime !== undefined ? options.endTime + 1 : this.now
      start = Math.max(end - limit * MINUTE, this.historyStart)
    }
    return { candles: candlesBetween(start, end), market: 'spot' }
  }

  subscribeLive(
    _symbol: string, _interval: Timeframe, _market: MarketKind, handlers: LiveHandlers,
  ): () => void {
    this.liveHandlers.push(handlers)
    return () => { this.unsubscribeCount++ }
  }

  emitTick(live: LiveCandle): void {
    for (const h of this.liveHandlers) h.onCandle(live)
  }

  emitStatus(status: LiveStreamStatus): void {
    for (const h of this.liveHandlers) h.onStatus?.(status)
  }
}

function setup(persistence: InMemoryCandleCache | null = null) {
  const provider = new MockProvider()
  const store = new CandleStore(provider, persistence)
  return { provider, store }
}

async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 0))
  await new Promise(r => setTimeout(r, 0))
}

describe('CandleStore — load and live merge', () => {
  it('delivers an initial snapshot and opens the live socket on first subscribe', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    expect(updates).toHaveLength(1)
    expect(updates[0].type).toBe('snapshot')
    expect(updates[0].candles).toHaveLength(INITIAL_CANDLES)
    expect(provider.liveHandlers).toHaveLength(1)
  })

  it('replays a warm snapshot synchronously on re-subscribe', async () => {
    const { store } = setup()
    const unsub = store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    unsub()

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    expect(updates).toHaveLength(1)   // synchronous
    expect(updates[0].type).toBe('snapshot')
  })

  it('merges ticks: replaces the in-progress candle, appends a new one', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const snapshot = updates[0].candles
    const last = snapshot[snapshot.length - 1]

    provider.emitTick({ ...candle(last.openTime, 105), isClosed: false })
    let latest = updates[updates.length - 1]
    expect(latest.type).toBe('tick')
    expect(latest.candles).toHaveLength(snapshot.length)
    expect(latest.candles[latest.candles.length - 1].close).toBe(105)

    provider.emitTick({ ...candle(last.openTime + MINUTE, 106), isClosed: false })
    latest = updates[updates.length - 1]
    expect(latest.candles).toHaveLength(snapshot.length + 1)
  })

  it('rejects out-of-order and malformed frames', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()
    const count = updates.length
    const first = updates[0].candles[0]
    const last  = updates[0].candles[updates[0].candles.length - 1]

    // Out-of-order (older than last candle)
    provider.emitTick({ ...candle(first.openTime, 999), isClosed: true })
    // Malformed: NaN close
    provider.emitTick({ ...candle(last.openTime + MINUTE, NaN), isClosed: false })
    // Malformed: high < low
    const bad = { ...candle(last.openTime + MINUTE, 100), high: 90, low: 110, isClosed: false }
    provider.emitTick(bad)

    expect(updates).toHaveLength(count)  // none accepted
  })

  it('closes the socket on last unsubscribe but keeps data in memory', async () => {
    const { provider, store } = setup()
    const unsub = store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    unsub()
    expect(provider.unsubscribeCount).toBe(1)
    expect(store.getCandles('BTCUSDT', '1m')).not.toBeNull()
  })

  it('shares one series between multiple subscribers', async () => {
    const { provider, store } = setup()
    const a: CandleUpdate[] = []
    const b: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => a.push(u))
    await flush()
    store.subscribe('BTCUSDT', '1m', u => b.push(u))

    expect(provider.fetchCalls).toHaveLength(1)
    expect(provider.liveHandlers).toHaveLength(1)
    expect(a[0].candles).toBe(b[0].candles)
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
    expect(updates.length).toBeGreaterThan(0)
    expect(updates[updates.length - 1].type).toBe('snapshot')
  })
})

describe('CandleStore — pagination', () => {
  it('backfills older history, prepends sorted, and reports exhaustion', async () => {
    const { provider, store } = setup()
    provider.historyStart = provider.now - (INITIAL_CANDLES + CHUNK / 2) * MINUTE
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const added = await store.loadOlder('BTCUSDT', '1m')
    expect(added).toBe(CHUNK / 2)
    const backfill = updates[updates.length - 1]
    expect(backfill.type).toBe('backfill')
    for (let i = 1; i < backfill.candles.length; i++) {
      expect(backfill.candles[i].openTime).toBeGreaterThan(backfill.candles[i - 1].openTime)
    }
    // Short chunk → exhausted → further loads no-op
    expect(await store.loadOlder('BTCUSDT', '1m')).toBe(0)
  })

  it('paginates far beyond the initial window (deep history)', async () => {
    const { store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()

    for (let i = 0; i < 9; i++) await store.loadOlder('BTCUSDT', '1m')
    expect(store.getCandles('BTCUSDT', '1m')!.length).toBe(INITIAL_CANDLES + 9 * CHUNK)
  })

  it('enforces the MAX_BUFFER cap', async () => {
    const { store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()

    let added = -1
    while (added !== 0 && store.getCandles('BTCUSDT', '1m')!.length < MAX_BUFFER) {
      added = await store.loadOlder('BTCUSDT', '1m')
    }
    expect(store.getCandles('BTCUSDT', '1m')!.length).toBeLessThanOrEqual(MAX_BUFFER)
    expect(await store.loadOlder('BTCUSDT', '1m')).toBe(0)
  })
})

describe('CandleStore — gap recovery', () => {
  it('repairs candles missed during a WebSocket outage', async () => {
    const { provider, store } = setup()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()
    const beforeLast = updates[0].candles[updates[0].candles.length - 1]

    // Socket drops; exchange time advances 10 candles while we're offline
    provider.emitStatus('disconnected')
    provider.now += 10 * MINUTE
    provider.emitStatus('connected')
    await flush()

    const latest = updates[updates.length - 1]
    expect(latest.type).toBe('snapshot')
    const lastNow = latest.candles[latest.candles.length - 1]
    expect(lastNow.openTime).toBe(beforeLast.openTime + 10 * MINUTE)
    // Repair fetch used startTime from the last known candle
    expect(provider.fetchCalls.some(c => c.startTime === beforeLast.openTime)).toBe(true)
  })

  it('does not repair when the connection never dropped', async () => {
    const { provider, store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    const fetchesAfterLoad = provider.fetchCalls.length

    provider.emitStatus('connected')  // initial open, no preceding drop
    await flush()
    expect(provider.fetchCalls.length).toBe(fetchesAfterLoad)
  })
})

describe('CandleStore — persistent cache', () => {
  it('hydrates from persistence first, then reconciles with REST', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    // Persisted history overlapping the fresh window: fresh covers [now-1000m, now);
    // cached covers [now-1500m, now-500m) → 500 older candles survive the merge.
    const cachedStart = provider.now - 1500 * MINUTE
    await cache.save('BTCUSDT:1m', candlesBetween(cachedStart, provider.now - 500 * MINUTE))

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    expect(updates[0].type).toBe('snapshot')
    expect(updates[0].fromCache).toBe(true)
    const final = updates[updates.length - 1]
    expect(final.fromCache).toBeUndefined()
    // Deep history preserved across the merge: cached-older + fresh window
    expect(final.candles).toHaveLength(1500)
    expect(final.candles[0].openTime).toBe(cachedStart)
  })

  it('drops cached history when the gap to the fresh window is too large', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    // Cache ends far before the fresh window starts → unusable, must be dropped
    const staleEnd = provider.now - (INITIAL_CANDLES + 5000) * MINUTE
    await cache.save('BTCUSDT:1m', candlesBetween(staleEnd - 100 * MINUTE, staleEnd))

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    await flush()

    const final = updates[updates.length - 1]
    expect(final.candles).toHaveLength(INITIAL_CANDLES)  // stale cache discarded
  })

  it('serves cached data when REST fails after hydration (no onError)', async () => {
    const cache = new InMemoryCandleCache()
    const { provider, store } = setup(cache)
    await cache.save('BTCUSDT:1m', candlesBetween(provider.now - 200 * MINUTE, provider.now))
    provider.failNext = new Error('offline')

    const onError = vi.fn()
    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u), onError)
    await flush()

    expect(onError).not.toHaveBeenCalled()
    expect(updates[0].fromCache).toBe(true)
    expect(store.getCandles('BTCUSDT', '1m')).toHaveLength(200)
  })
})

describe('CandleStore — fetchSnapshot / prefetch', () => {
  it('fetchSnapshot returns exactly count candles without opening a socket', async () => {
    const { provider, store } = setup()
    const { candles, market } = await store.fetchSnapshot('BTCUSDT', '1m', 500)
    expect(candles).toHaveLength(500)
    expect(market).toBe('spot')
    expect(provider.liveHandlers).toHaveLength(0)  // no live subscription
  })

  it('fetchSnapshot serves from memory when a live series already has the data', async () => {
    const { provider, store } = setup()
    store.subscribe('BTCUSDT', '1m', () => {})
    await flush()
    const fetchesAfterLoad = provider.fetchCalls.length

    const { candles } = await store.fetchSnapshot('BTCUSDT', '1m', 500)
    expect(candles).toHaveLength(500)
    expect(provider.fetchCalls.length).toBe(fetchesAfterLoad)  // zero extra requests
  })

  it('fetchSnapshot paginates when count exceeds the initial window', async () => {
    const { store } = setup()
    const { candles } = await store.fetchSnapshot('BTCUSDT', '1m', 2500)
    expect(candles).toHaveLength(2500)
  })

  it('prefetch warms the series so the next subscribe is synchronous', async () => {
    const { store } = setup()
    store.prefetch('BTCUSDT', '1m')
    await flush()

    const updates: CandleUpdate[] = []
    store.subscribe('BTCUSDT', '1m', u => updates.push(u))
    expect(updates).toHaveLength(1)  // served synchronously from memory
  })
})
