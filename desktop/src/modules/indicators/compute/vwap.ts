/**
 * Session-anchored VWAP.
 *
 * ── WHY THE PREVIOUS IMPLEMENTATION WAS WRONG ────────────────────────────────
 *
 * The old `computeVwap(highs, lows, closes, volumes)` accumulated typical-price
 * × volume over the ENTIRE array it was handed and divided by total volume.
 * That is not any VWAP a trading desk recognises, because its anchor is
 * `candles[0]` — i.e. wherever the fetch window happened to start.
 *
 *   1. WINDOW ARTIFACT. Two clients looking at the same symbol at the same
 *      instant, one holding 500 candles and one holding 1500, computed
 *      different "VWAP" values for the same bar. Nothing about the market
 *      distinguished them; only the fetch depth did.
 *   2. SLIDING ANCHOR. As each new bar arrives the window start advances, so
 *      the anchor moves. A VWAP whose anchor moves is not a benchmark — the
 *      entire point of VWAP, both as an execution benchmark on an institutional
 *      desk and as a support/resistance reference on a chart, is that every
 *      participant is measuring from the SAME fixed point.
 *   3. FABRICATED VALUES. It returned `0` for an empty array and the last close
 *      when total volume was zero. `0` makes every price "above VWAP" (a
 *      permanent bullish vote); the last-close fallback makes price sit exactly
 *      on VWAP, which downstream if/else chains rendered as "below VWAP".
 *
 * ── WHAT PROFESSIONAL TERMINALS DO ───────────────────────────────────────────
 *
 * TradingView's built-in VWAP is session-anchored and returns `na` — the plot
 * simply disappears — on timeframes of 1D and above. Binance's charts are
 * TradingView-powered and inherit exactly that behaviour. Institutional desks
 * use VWAP as an execution benchmark measured over a fixed, agreed interval
 * (usually the trading day, sometimes an explicit anchor such as an earnings
 * print). Every one of these definitions shares one property the old code did
 * not have: a fixed anchor that is a property of the calendar or of a market
 * event, never of the data window.
 *
 * ── WHY THE UTC DAY ──────────────────────────────────────────────────────────
 *
 * Crypto has no exchange session, so "session" needs a convention. The UTC day
 * is the correct one on this venue rather than an arbitrary pick: Binance rolls
 * its own daily candles and its 24h rolling statistics at 00:00 UTC, funding
 * intervals are UTC-aligned, and every sub-daily interval Binance offers
 * (1m…12h) divides 86,400,000ms exactly, so a UTC day always contains a whole
 * number of bars and every session boundary falls on a bar boundary.
 *
 * ── DETERMINISM AND REPLAY ───────────────────────────────────────────────────
 *
 * The value at bar i depends only on bars in the same UTC day up to and
 * including i. It therefore never repaints, contains no look-ahead, and is
 * prefix-stable: running on candles[0..m] yields exactly the values the full
 * run yields for bars 0..m. Unlike the old implementation it is also
 * *window-stable* — extending history backwards cannot change any value,
 * because the anchor is calendar-derived rather than window-derived.
 */
import type { Candle } from '../../market/types'
import type { Unavailable } from '../../common/availability'
import { unavailable } from '../../common/availability'

const MS_PER_DAY = 86_400_000

/**
 * A discriminated union, so `value` is unreachable at the type level whenever
 * there is no VWAP. A `{ value: number | null; available: boolean }` record
 * would compile at every call site that ignores `available` — which is exactly
 * how the old `vwap: number` sentinel propagated.
 */
export type VwapResult =
  | {
    available: true
    /** Session VWAP at the last candle. */
    value: number
    unavailable: null
    /**
     * UTC-ms open of the session the value is measured from. Exposed so the UI
     * can say *which* session is being averaged rather than showing a bare
     * number whose anchor the reader has to guess.
     */
    anchorTime: number
  }
  | {
    available: false
    value: null
    unavailable: Unavailable
    anchorTime: null
  }

export interface VwapSeries {
  /**
   * Session VWAP at each bar, aligned 1:1 with the input candles.
   *
   * `null` at a bar whose session's opening bars lie outside the window — the
   * accumulation for that session is incomplete, so no honest value exists.
   * In practice this affects only the first (partial) session in the window.
   *
   * INVARIANT: `values[n-1] !== null` if and only if `unavailable === null`.
   */
  values: (number | null)[]
  /** UTC-ms session anchor of the last bar; `null` when unavailable. */
  anchorTime: number | null
  /** Set when the LAST bar has no determinable value. */
  unavailable: Unavailable | null
}

/** UTC midnight at or before `t`. `Math.floor` keeps this correct for t < 0. */
function sessionStartOf(t: number): number {
  return Math.floor(t / MS_PER_DAY) * MS_PER_DAY
}

/**
 * Bar duration in ms, derived from the candles themselves.
 *
 * Deliberately NOT taken from a `Timeframe` string. Threading the timeframe
 * down into a pure-mathematics module would bake a provider's interval
 * vocabulary into code that only needs a number, and would leave the module
 * unable to notice when the data disagrees with the label.
 *
 * Primary source is `closeTime - openTime + 1`: Binance reports closeTime as
 * the last inclusive millisecond of the bar (openTime 0 → closeTime 59_999 for
 * 1m), so the `+1` recovers the exact interval. The fallback for providers that
 * report a half-open closeTime, or omit it, is the spacing between the last two
 * opens. Both are O(1) and use only the newest bars, so a stale malformed
 * candle deep in history cannot affect the answer.
 */
function inferBarDuration(candles: Candle[]): number | null {
  const last = candles[candles.length - 1]
  const fromClose = last.closeTime - last.openTime + 1
  if (Number.isFinite(fromClose) && fromClose > 1) return fromClose
  if (candles.length >= 2) {
    const fromOpens = last.openTime - candles[candles.length - 2].openTime
    if (Number.isFinite(fromOpens) && fromOpens > 0) return fromOpens
  }
  // `fromClose === 1` means closeTime === openTime — degenerate but finite, and
  // the only remaining signal. Accepting it keeps single-candle inputs usable.
  return Number.isFinite(fromClose) && fromClose > 0 ? fromClose : null
}

/**
 * Session VWAP at every bar. Single O(n) pass; the accumulator resets at each
 * UTC-day boundary.
 */
export function computeVwapSeries(candles: Candle[]): VwapSeries {
  const n = candles.length
  if (n === 0) {
    return {
      values: [],
      anchorTime: null,
      unavailable: unavailable('insufficient-history', 'No candles supplied.'),
    }
  }

  const barDuration = inferBarDuration(candles)
  if (barDuration === null) {
    return {
      values: new Array(n).fill(null),
      anchorTime: null,
      unavailable: unavailable(
        'malformed-input',
        'Candle timestamps do not describe a positive bar duration.',
      ),
    }
  }

  // Structural degeneracy. At a bar duration of one day or more, a session
  // never contains more than one bar, so the volume-weighted average over the
  // session IS that bar's typical price — the indicator restates its input and
  // adds nothing. This is the same condition on which TradingView returns `na`.
  // Note this is about the BAR, not about how much history we hold: no amount
  // of extra data makes a daily session VWAP informative.
  if (barDuration >= MS_PER_DAY) {
    return {
      values: new Array(n).fill(null),
      anchorTime: null,
      unavailable: unavailable(
        'undefined-at-timeframe',
        `Session VWAP is undefined at a bar duration of ${barDuration}ms: one bar spans a whole UTC session, `
        + 'so the session average is the bar\'s own typical price.',
      ),
    }
  }

  const values: (number | null)[] = new Array(n).fill(null)

  let session = sessionStartOf(candles[0].openTime)
  // A session's accumulation is complete only if we hold its opening bar. Bars
  // are treated as opening a session when they start within one bar duration of
  // the session boundary — exact equality for an aligned provider, and tolerant
  // of a provider whose bars are offset, while still rejecting the case that
  // matters: an entire missing bar (or the window simply beginning mid-session),
  // where the first bar we hold opens a full bar-duration or more into the day.
  let complete = candles[0].openTime - session < barDuration
  let tpv = 0
  let vol = 0

  for (let i = 0; i < n; i++) {
    const c = candles[i]
    const s = sessionStartOf(c.openTime)
    if (s !== session) {
      session = s
      complete = c.openTime - s < barDuration
      tpv = 0
      vol = 0
    }
    tpv += ((c.high + c.low + c.close) / 3) * c.volume
    vol += c.volume
    if (complete && vol > 0) {
      const v = tpv / vol
      if (Number.isFinite(v)) values[i] = v
    }
  }

  if (values[n - 1] === null) {
    // `complete`, `vol` and `tpv` still hold the final session's state, so the
    // reason can be reported precisely rather than as a generic failure.
    const reason: Unavailable = !complete
      ? unavailable(
        'insufficient-history',
        'The current UTC session began before the first available candle, so its volume accumulation is incomplete.',
      )
      : vol > 0
        ? unavailable('malformed-input', 'Session prices or volumes are not finite.')
        : unavailable('no-volume', 'Zero volume traded in the current UTC session.')
    return { values, anchorTime: null, unavailable: reason }
  }

  return {
    values,
    anchorTime: sessionStartOf(candles[n - 1].openTime),
    unavailable: null,
  }
}

/**
 * Session VWAP at the last candle, with the reason attached when there is none.
 */
export function computeVwap(candles: Candle[]): VwapResult {
  const series = computeVwapSeries(candles)
  const value = series.values[series.values.length - 1] ?? null

  // The `??` arm enforces the VwapSeries invariant at runtime instead of
  // asserting it with a cast. If it ever fires the module degrades to a
  // structured unavailable — which is the whole point of this file — rather
  // than emitting a NaN or a bare null into the evidence chain.
  if (series.unavailable !== null || value === null || series.anchorTime === null) {
    return {
      available: false,
      value: null,
      anchorTime: null,
      unavailable: series.unavailable
        ?? unavailable('malformed-input', 'VWAP series produced no value for the last candle.'),
    }
  }

  return { available: true, value, unavailable: null, anchorTime: series.anchorTime }
}
