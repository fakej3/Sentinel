/**
 * Structured unavailability — the shared vocabulary every Sentinel subsystem
 * uses to say "I have no output" without fabricating one.
 *
 * WHY THIS EXISTS
 *
 * Every analytical subsystem has inputs for which its output is undefined:
 * not-yet-warmed-up indicators, structures the market has not produced, ratios
 * with a zero denominator, computations that degenerate at certain bar
 * durations. Historically each subsystem invented its own way to signal this —
 * a sentinel `0`, a `null` that a consumer promptly coerced, a boolean pair
 * where `false/false` was indistinguishable from "no data". Those encodings
 * leak: a `0` VWAP makes every price "above VWAP", and an `above === false`
 * flag becomes "price is below VWAP" in an if/else that never considered a
 * third case. The output is not merely missing — it is *wrong and directional*.
 *
 * The rule this module enforces is: an unavailable result is a first-class
 * value carrying a machine-readable `code` and a human-readable `detail`. It is
 * never a magic number, and it is never a bare `false`.
 *
 * WHY THE CODE SET IS CLOSED
 *
 * A closed union means (a) a consumer can `switch` on the code and the compiler
 * will tell it when a new case appears, and (b) a new failure mode cannot be
 * introduced without being named here and reviewed against the existing ones.
 * A free-form string would let two subsystems describe the same condition in
 * two different ways, which is how "unavailable" silently becomes untestable.
 */

/**
 * The complete set of reasons a Sentinel subsystem may withhold output.
 *
 * These are deliberately about the *mathematics of the computation*, not about
 * transport or infrastructure. Network failures, exchange errors and cache
 * misses are not unavailability — they are errors, and they are represented by
 * thrown `PipelineError`s. This union describes results that are correctly and
 * permanently undefined for the data supplied.
 */
export type UnavailableCode =
  /**
   * The computation is well-defined but needs more bars than were supplied.
   * Warmup periods (EMA200 on 40 candles) and window-start truncation (a
   * session VWAP whose session began before the first candle) both land here.
   * Distinguishing property: supplying more history would produce a value.
   */
  | 'insufficient-history'
  /**
   * Enough bars exist, but the market has not produced the structural feature
   * the computation is defined on — no confirmed swing pair for a Fibonacci
   * range, no break of structure to anchor a stop against.
   * Distinguishing property: more history would NOT necessarily help; the
   * market has to do something first.
   */
  | 'insufficient-structure'
  /**
   * The computation degenerates at this bar duration. Session VWAP on a daily
   * candle is the canonical case: the session and the bar are the same
   * interval, so the "average" restates the bar's own typical price and
   * carries no information. Withholding is the only honest output.
   */
  | 'undefined-at-timeframe'
  /**
   * A volume-weighted computation received zero total weight over its window.
   * The quotient is 0/0, not 0.
   */
  | 'no-volume'
  /**
   * Preconditions hold and a number could be produced, but the current regime
   * makes it meaningless to act on — e.g. retracement levels inside a range
   * with no impulse to retrace.
   */
  | 'not-applicable'
  /**
   * The supplied data violates an invariant the computation depends on:
   * non-finite prices, non-monotonic or absent timestamps, negative volume.
   * This is a data-quality signal, not a warmup signal — it should be rare and
   * is worth surfacing rather than silently smoothing over.
   */
  | 'malformed-input'

export interface Unavailable {
  code: UnavailableCode
  /**
   * Human-readable specifics. Must be diagnosable on its own: state the actual
   * numbers involved ("bar duration 86400000ms >= 1 day"), not a restatement of
   * the code. This string is rendered directly in the UI, so it is written for
   * a trader, not for a stack trace.
   */
  detail: string
}

export function unavailable(code: UnavailableCode, detail: string): Unavailable {
  return { code, detail }
}
