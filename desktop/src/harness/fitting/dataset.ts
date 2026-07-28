/**
 * Cross-sectional daily equity dataset.
 *
 * Loads the S&P 500 five-year daily bar file — the same 619,040-bar corpus
 * Phase 8 measured on — so Milestone 3's numbers are directly comparable to the
 * external-validation findings rather than to a fresh synthetic world.
 *
 * ── WHY THE DATE INDEX IS A FIRST-CLASS OBJECT ────────────────────────────────
 *
 * Five hundred S&P constituents on the same day are not five hundred
 * independent observations. They share a market factor whose daily return
 * typically explains a large share of the cross-sectional variance, so the
 * effective sample size on any given day is closer to one than to five hundred.
 *
 * Everything downstream depends on getting this right:
 *
 *   - Walk-forward splits must cut on DATES, not on rows. A split that put
 *     AAPL's 2015 bars in train and MSFT's 2015 bars in test would be training
 *     on the test period's market factor.
 *   - Bootstrap resampling must resample DATES, not rows. Resampling rows
 *     treats correlated observations as independent and shrinks every
 *     confidence interval by roughly sqrt(symbols per day) — about 22x here.
 *
 * Phase 4 established this after an earlier study reported intervals that were
 * far too narrow. The date index exists so the unit of independence is a thing
 * the code holds, not a thing a caller has to remember.
 *
 * ── WHAT THIS DATA CANNOT SUPPORT ─────────────────────────────────────────────
 *
 * There is no taker buy/sell split in the file — the columns do not exist.
 * `takerBuyVolume` and `takerSellVolume` are therefore 0, which is the honest
 * encoding of "absent" rather than `volume / 2`, which would fabricate a
 * neutral reading that the volume module would then interpret. Any engine
 * channel that depends on order-flow direction is unavailable on this corpus,
 * and a comparison involving one must say so.
 */
import { readFile } from 'node:fs/promises'
import type { Candle, Timeframe } from '../../modules/market/types'
import type { Series } from '../types'
import { assertWellFormedSeries } from '../validate'

const DAY_MS = 86_400_000

export interface StockDataset {
  /** One series per symbol, each strictly increasing in openTime. */
  readonly series: readonly Series[]
  /**
   * Every distinct bar date across all symbols, ascending. This is the axis
   * walk-forward splits cut on and the unit bootstrap resampling draws.
   */
  readonly dates: readonly number[]
  /** Rows the parser rejected, by reason. Reported, never silently dropped. */
  readonly rejected: Readonly<Record<string, number>>
  readonly rowsParsed: number
}

/** Parses `YYYY-MM-DD` to a UTC midnight timestamp. Returns null if malformed. */
export function parseIsoDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (m === null) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const t = Date.UTC(y, mo - 1, d)
  // Round-trip guards against dates like 2015-02-30, which Date.UTC rolls over
  // silently into March rather than rejecting.
  const back = new Date(t)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null
  return t
}

/**
 * Parses the `date,open,high,low,close,volume,Name` daily bar format.
 *
 * Rows with a missing or non-positive price are REJECTED rather than repaired.
 * The file contains a small number of them; interpolating would invent bars
 * that never traded, and carrying them forward would create a zero-return day
 * that is indistinguishable from a real one. Each rejection is counted.
 */
export function parseStockCsv(text: string, timeframe: Timeframe = '1d'): StockDataset {
  const lines = text.split('\n')
  const rejected: Record<string, number> = {}
  const reject = (r: string): void => { rejected[r] = (rejected[r] ?? 0) + 1 }

  const header = (lines[0] ?? '').trim().split(',').map(h => h.trim().toLowerCase())
  const need = ['date', 'open', 'high', 'low', 'close', 'volume', 'name']
  const col: Record<string, number> = {}
  for (const k of need) {
    const idx = header.indexOf(k)
    if (idx < 0) throw new Error(`parseStockCsv: missing required column "${k}"; header was [${header.join(', ')}]`)
    col[k] = idx
  }

  const bySymbol = new Map<string, Candle[]>()
  const dateSet = new Set<number>()
  let rowsParsed = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().length === 0) continue
    rowsParsed++
    const f = line.split(',')
    if (f.length < need.length) { reject('short-row'); continue }

    const symbol = f[col['name']].trim()
    if (symbol.length === 0) { reject('missing-symbol'); continue }

    const openTime = parseIsoDate(f[col['date']])
    if (openTime === null) { reject('bad-date'); continue }

    const open = Number(f[col['open']])
    const high = Number(f[col['high']])
    const low = Number(f[col['low']])
    const close = Number(f[col['close']])
    const volume = Number(f[col['volume']])
    if (![open, high, low, close].every(v => Number.isFinite(v) && v > 0)) { reject('bad-price'); continue }
    if (!Number.isFinite(volume) || volume < 0) { reject('bad-volume'); continue }
    if (high < low) { reject('high-below-low'); continue }

    const list = bySymbol.get(symbol) ?? []
    if (list.length === 0) bySymbol.set(symbol, list)
    list.push({
      openTime,
      closeTime: openTime + DAY_MS - 1,
      open, high, low, close,
      volume,
      quoteVolume: close * volume,
      trades: 0,
      // Absent in this file. 0 encodes "unknown"; volume / 2 would fabricate a
      // neutral order-flow reading that downstream modules would then act on.
      takerBuyVolume: 0,
      takerSellVolume: 0,
    })
    dateSet.add(openTime)
  }

  const series: Series[] = []
  for (const [symbol, candles] of [...bySymbol.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    candles.sort((a, b) => a.openTime - b.openTime)
    // A duplicated date for one symbol would break strict monotonicity and, more
    // importantly, would double-weight that day. Drop the later copy and count it.
    const deduped: Candle[] = []
    for (const c of candles) {
      if (deduped.length > 0 && c.openTime === deduped[deduped.length - 1].openTime) {
        reject('duplicate-date')
        continue
      }
      deduped.push(c)
    }
    const s: Series = { symbol, timeframe, candles: deduped }
    assertWellFormedSeries(s)
    series.push(s)
  }

  return {
    series,
    dates: [...dateSet].sort((a, b) => a - b),
    rejected,
    rowsParsed,
  }
}

export async function loadStockCsv(file: string, timeframe: Timeframe = '1d'): Promise<StockDataset> {
  return parseStockCsv(await readFile(file, 'utf8'), timeframe)
}

/**
 * Maps each date to its position on the shared axis.
 *
 * Symbols do not all trade on every date (listings, suspensions, the corpus's
 * own gaps), so a symbol's bar index is NOT its date index. Splits cut on date
 * index; observations carry their date and are assigned to a fold by lookup.
 */
export function dateIndex(dates: readonly number[]): ReadonlyMap<number, number> {
  const m = new Map<number, number>()
  for (let i = 0; i < dates.length; i++) m.set(dates[i], i)
  return m
}
