/**
 * SymbolRegistry — single source of truth for every tradable Binance symbol.
 *
 * Loads /api/v3/exchangeInfo (spot) and /fapi/v1/exchangeInfo (futures perpetual)
 * in parallel and merges them into one in-memory map.  Every API call in this
 * module consults the registry first so we never guess which market to use.
 *
 * The registry is a lazy singleton:
 *  - prime() starts a background fetch (call once at app startup)
 *  - getPreferredMarket() triggers loading on first call if not already started
 *  - Returns 'unknown' until the fetch resolves; callers fall back gracefully
 */

import { SPOT_BASE_URL, FUTURES_BASE_URL, REQUEST_TIMEOUT_MS } from './constants'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SymbolMarket = 'spot' | 'futures' | 'both'

export interface RegistryEntry {
  symbol: string
  base:   string
  quote:  string
  /** 'spot' = Binance Spot only; 'futures' = FAPI perpetual only; 'both' = listed on both */
  market: SymbolMarket
  /**
   * The market to use for ALL data fetches for this symbol.
   * 'both' symbols route to 'futures' so candles, ticker, funding, and OI
   * always come from a single source — no mixed-market data.
   */
  preferredMarket: 'spot' | 'futures'
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface RawSymbolInfo {
  symbol:        string
  baseAsset:     string
  quoteAsset:    string
  status:        string
  contractType?: string
}

async function loadExchangeInfo(url: string): Promise<RawSymbolInfo[]> {
  if (typeof fetch === 'undefined') return []
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) {
      if (import.meta.env.DEV) console.warn('[Registry] exchangeInfo HTTP', res.status, url)
      return []
    }
    const data = (await res.json()) as { symbols?: RawSymbolInfo[] }
    return data.symbols ?? []
  } catch (err) {
    clearTimeout(timer)
    if (import.meta.env.DEV) console.warn('[Registry] exchangeInfo fetch failed:', url, err)
    return []
  }
}

// ── SymbolRegistry singleton ──────────────────────────────────────────────────

const CACHE_TTL_MS      = 5 * 60 * 1_000  // 5 minutes
const RETRY_DELAYS_MS   = [5_000, 15_000, 60_000] as const  // backoff: 5s, 15s, 60s

class SymbolRegistrySingleton {
  private bySymbol:   Map<string, RegistryEntry> = new Map()
  private allEntries: RegistryEntry[] = []
  private loadedAt  = 0
  private loading:    Promise<void> | null = null
  private nextRetryAt = 0
  private retryCount  = 0

  private async build(): Promise<void> {
    const [spotRaw, futRaw] = await Promise.all([
      loadExchangeInfo(`${SPOT_BASE_URL}/api/v3/exchangeInfo`),
      loadExchangeInfo(`${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`),
    ])

    const map = new Map<string, RegistryEntry>()

    for (const s of spotRaw) {
      if (s.status === 'TRADING' && s.quoteAsset === 'USDT') {
        map.set(s.symbol, {
          symbol: s.symbol, base: s.baseAsset, quote: 'USDT',
          market: 'spot', preferredMarket: 'spot',
        })
      }
    }

    for (const s of futRaw) {
      if (s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL') {
        const existing = map.get(s.symbol)
        if (existing) {
          // Listed on both markets: prefer futures so all data (candles, ticker,
          // funding rate, open interest) comes from a single consistent source.
          map.set(s.symbol, { ...existing, market: 'both', preferredMarket: 'futures' })
        } else {
          map.set(s.symbol, {
            symbol: s.symbol, base: s.baseAsset, quote: 'USDT',
            market: 'futures', preferredMarket: 'futures',
          })
        }
      }
    }

    if (map.size > 0) {
      this.bySymbol   = map
      this.allEntries = Array.from(map.values())
      this.loadedAt   = Date.now()
      this.retryCount = 0
      this.nextRetryAt = 0
      if (import.meta.env.DEV) {
        console.debug(`[Registry] loaded ${map.size} symbols (spot: ${spotRaw.length}, futures: ${futRaw.length})`)
      }
    } else {
      // Both endpoints returned nothing — keep previous cache if available.
      // Schedule next retry with exponential backoff.
      const delay = RETRY_DELAYS_MS[Math.min(this.retryCount, RETRY_DELAYS_MS.length - 1)]
      this.nextRetryAt = Date.now() + delay
      this.retryCount++
      if (import.meta.env.DEV) {
        console.warn(`[Registry] exchangeInfo returned 0 symbols (attempt ${this.retryCount}); retrying in ${delay}ms`)
      }
    }
  }

  private ensureLoading(): void {
    if (this.loading) return
    if (this.loadedAt > 0 && Date.now() - this.loadedAt < CACHE_TTL_MS) return
    if (this.nextRetryAt > 0 && Date.now() < this.nextRetryAt) return
    this.loading = this.build()
      .catch(err => {
        if (import.meta.env.DEV) console.error('[Registry] build() threw unexpectedly:', err)
      })
      .finally(() => { this.loading = null })
  }

  /** Start loading the registry in the background. Call once at app startup. */
  prime(): void {
    this.ensureLoading()
  }

  /**
   * Returns the preferred market for routing all data fetches for this symbol.
   *
   * - 'spot'    — route to api.binance.com; no funding rate or OI
   * - 'futures' — route to fapi.binance.com; funding rate and OI available
   * - 'unknown' — registry not yet loaded; callers should use spot→futures retry
   */
  getPreferredMarket(symbol: string): 'spot' | 'futures' | 'unknown' {
    this.ensureLoading()
    const entry = this.bySymbol.get(symbol)
    if (!entry) return 'unknown'
    return entry.preferredMarket
  }

  /**
   * Returns the canonical market listing for a symbol.
   * Prefer getPreferredMarket() for routing decisions.
   */
  getMarket(symbol: string): SymbolMarket | 'unknown' {
    this.ensureLoading()
    return this.bySymbol.get(symbol)?.market ?? 'unknown'
  }

  /** All known entries (empty until the first load completes). */
  getAll(): RegistryEntry[] {
    this.ensureLoading()
    return this.allEntries
  }

  /** True once the first load has succeeded. */
  isReady(): boolean {
    return this.loadedAt > 0
  }

  /** Diagnostic snapshot for DEV tooling. */
  getStatus(): { loaded: boolean; size: number; loadedAt: number; loading: boolean; retryCount: number } {
    return {
      loaded:     this.loadedAt > 0,
      size:       this.bySymbol.size,
      loadedAt:   this.loadedAt,
      loading:    this.loading !== null,
      retryCount: this.retryCount,
    }
  }
}

export const symbolRegistry = new SymbolRegistrySingleton()
