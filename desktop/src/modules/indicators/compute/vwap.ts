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

/**
 * UTC midnight at or before `t`. `Math.floor` keeps this correct for t < 0.
 *
 * Exported because the VWAP series is only piecewise-continuous — it resets at
 * every session boundary — so any consumer reasoning about the SHAPE of the
 * series (rather than a single value) has to know where the pieces end. See the
 * cross-detection note in volume-analysis/compute/vwap-analysis.ts.
 */
export function sessionStartOf(t: number): number {
  return Math.floor(t / MS_PER_DAY) * MS_PER_DAY
}

/**
 * Multiple of the bar duration at which a spacing between consecutive opens is
 * classified as a data gap rather than as normal succession.
 *
 * DERIVED, not tuned. Bars are discrete: for well-formed uniform data the ratio
 * Δopen / barDuration is exactly 1, and a single missing bar makes it exactly 2.
 * There is no third possibility. 1.5 is the midpoint of the only two reachable
 * values, i.e. the decision boundary maximally far from both — the standard
 * discriminator between adjacent integers under timestamp jitter. Any threshold
 * in the open interval (1, 2) is equally correct on exact data; the midpoint is
 * the one that tolerates the most jitter in either direction.
 */
const GAP_RATIO = 1.5

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

  // Fallback: the MINIMUM positive spacing over the last few opens, not the
  // spacing of the final pair. A gap only ever makes a spacing larger, so the
  // minimum is the gap-immune estimator — and it has to be, because using the
  // final pair alone would infer 2x the true duration whenever the window
  // happens to end just after a missing bar, which would make the result
  // depend on where the window ends rather than on the data. Bounded to a few
  // bars so this stays O(1).
  const SPACING_SAMPLES = 5
  let fromOpens = Infinity
  for (let i = candles.length - 1; i > 0 && i > candles.length - 1 - SPACING_SAMPLES; i--) {
    const d = candles[i].openTime - candles[i - 1].openTime
    if (Number.isFinite(d) && d > 0 && d < fromOpens) fromOpens = d
  }
  if (fromOpens !== Infinity) return fromOpens
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

  // A session's accumulation is COMPLETE when every bar from its anchor up to
  // and including the current one is present in the window. Two ways to lose it —
  //
  //   1. the session's OPENING bar is outside the window (the window began
  //      mid-session). Detected by the bar's offset from the session boundary:
  //      an opening bar starts within one bar duration of it. The tolerance
  //      rather than exact equality keeps this correct for a provider whose
  //      bars are not aligned to midnight, while still rejecting an entire
  //      missing bar.
  //   2. a bar is missing from the MIDDLE of the session. The earlier version of
  //      this function only performed check (1), so a session holding its 00:00
  //      bar and then nothing until 10:00 was reported as a complete session
  //      VWAP built from two bars out of eleven. Volume-weighted means are not
  //      robust to missing weight: the answer is not noisy, it is wrong, and it
  //      was being published as available.
  //
  // Once a session is incomplete it stays incomplete for the rest of that
  // session — the missing volume can never be recovered — and resets at the
  // next session boundary.
  /** Why the current session's accumulation is incomplete; null when it is not. */
  type Incompleteness = 'window-start' | 'gap'
  let incomplete: Incompleteness | null = null

  // −Infinity is a session start no real (or NaN) timestamp can produce, so the
  // first iteration always takes the session-transition branch. That keeps the
  // "does this bar open its session?" test written exactly once instead of
  // duplicated before the loop, and makes the gap branch unreachable at i = 0
  // without needing an index guard to say so.
  let session = -Infinity
  let prevOpen = 0
  let tpv = 0
  let vol = 0

  for (let i = 0; i < n; i++) {
    const c = candles[i]
    const s = sessionStartOf(c.openTime)
    if (s !== session) {
      session = s
      incomplete = c.openTime - s >= barDuration ? 'window-start' : null
      tpv = 0
      vol = 0
    } else if (incomplete === null && c.openTime - prevOpen >= GAP_RATIO * barDuration) {
      incomplete = 'gap'
    }
    prevOpen = c.openTime
    tpv += ((c.high + c.low + c.close) / 3) * c.volume
    vol += c.volume
    if (incomplete === null && vol > 0) {
      const v = tpv / vol
      if (Number.isFinite(v)) values[i] = v
    }
  }

  if (values[n - 1] === null) {
    // `incomplete`, `vol` and `tpv` still hold the final session's state, so the
    // reason can be reported precisely rather than as a generic failure.
    let reason: Unavailable
    if (incomplete === 'window-start') {
      reason = unavailable(
        'insufficient-history',
        'The current UTC session began before the first available candle, so its volume accumulation is incomplete.',
      )
    } else if (incomplete === 'gap') {
      reason = unavailable(
        'insufficient-history',
        'Candles are missing from the middle of the current UTC session, so its volume accumulation is incomplete.',
      )
    } else if (vol > 0) {
      reason = unavailable('malformed-input', 'Session prices or volumes are not finite.')
    } else {
      reason = unavailable('no-volume', 'Zero volume traded in the current UTC session.')
    }
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
