/**
 * Market-data subsystem contracts.
 *
 * Layering (top consumes bottom):
 *
 *   consumers (chart, overlays, replay, analysis fetch)
 *        ↓ subscribe / fetchSnapshot / loadOlder
 *   CandleStore            — owns ALL candle data and merge policy
 *        ↓ CandleProvider
 *   providers/BinanceProvider — exchange I/O only, owns no data
 *        ↓
 *   Binance REST + WS
 *
 *   CandleStore ⇄ CandlePersistence (IndexedDB) — warm-start cache
 *
 * Nothing above the store fetches candles or keeps a private buffer.
 * Nothing below the store decides how candles merge.
 */
import type { Candle, Timeframe } from '../../modules/market/types'
import type { LiveCandle, LiveStreamStatus } from '../../modules/binance/ws'

export type { LiveCandle, LiveStreamStatus }

export type MarketKind = 'spot' | 'futures'

// ── Provider ──────────────────────────────────────────────────────────────────

export interface FetchRangeOptions {
  /** Max candles for this request (provider clamps to its own per-request cap). */
  limit: number
  /** Fetch candles at or before this timestamp (ms, exclusive upper window bound). */
  endTime?: number
  /** Fetch candles at or after this timestamp (ms). Used for gap recovery. */
  startTime?: number
}

export interface LiveHandlers {
  onCandle: (candle: LiveCandle) => void
  /** Connection transitions — lets the store repair gaps after reconnects. */
  onStatus?: (status: LiveStreamStatus) => void
}

/**
 * Exchange abstraction. Implementations perform I/O only — they own no data
 * and make no merge decisions. Adding an exchange means adding one provider.
 */
export interface CandleProvider {
  /** Candles sorted ascending by openTime. */
  fetchCandles(
    symbol: string,
    interval: Timeframe,
    options: FetchRangeOptions,
    market?: MarketKind,
  ): Promise<{ candles: Candle[]; market: MarketKind }>

  /** Subscribe to the live candle stream. Returns an unsubscribe function. */
  subscribeLive(
    symbol: string,
    interval: Timeframe,
    market: MarketKind,
    handlers: LiveHandlers,
  ): () => void

  /** Provider's maximum candles per REST request (pagination chunk size). */
  readonly maxCandlesPerRequest: number
}

// ── Store update events ───────────────────────────────────────────────────────

export type CandleUpdateType =
  /** Full buffer (re)established: initial load, cache hydration, gap repair. */
  | 'snapshot'
  /** Older history prepended (pagination) — viewport should be preserved. */
  | 'backfill'
  /** Single live candle merged (may be unclosed). */
  | 'tick'

export interface CandleUpdate {
  type: CandleUpdateType
  /** Full sorted buffer. New array reference on every structural change. */
  candles: Candle[]
  /** The live candle for 'tick' updates. */
  tick?: LiveCandle
  /** True when the tick closed a candle (consumers may recompute derived series). */
  tickClosed?: boolean
  /** True when this snapshot came from the persistent cache and a REST refresh is in flight. */
  fromCache?: boolean
  market: MarketKind
}

export type CandleListener = (update: CandleUpdate) => void

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Persistent candle cache (IndexedDB in the browser). Failures must never
 * break the store — implementations resolve null / swallow write errors.
 */
export interface CandlePersistence {
  load(key: string): Promise<Candle[] | null>
  save(key: string, candles: Candle[]): Promise<void>
  clear(): Promise<void>
}
