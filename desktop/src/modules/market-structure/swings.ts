import type { Candle } from '../binance'
import type { SwingPoint, MarketStructureConfig } from './types'
import { atrSeries } from '../indicators/utils'

/**
 * Volatility-thresholded swing detection (ATR zigzag).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS REPLACES FIXED-LOOKBACK PIVOTS
 * ──────────────────────────────────────────────────────────────────────────
 *
 * The previous detector used a fixed bar-count pivot: candle i was a swing
 * high if high[i] exceeded every high within ±L bars (L=2, i.e. Bill
 * Williams fractals). That model has two structural defects, neither of
 * which can be fixed by tuning L:
 *
 *   1. NO AMPLITUDE DIMENSION. The rule is purely ordinal — it asks "was
 *      this the highest of 5 bars?" and never "did price actually move?".
 *      A 0.05% wiggle and a 5% impulse both qualify. Every downstream
 *      module (labels, trend, BOS, S/R zones, Fibonacci anchors) therefore
 *      inherits a swing set in which noise and structure are
 *      indistinguishable.
 *
 *   2. NOT SCALE-INVARIANT. "2 bars" means something different on 1m than
 *      on 1D, and something different in a quiet regime than in a volatile
 *      one. A single constant cannot be correct across timeframes, so the
 *      same config necessarily over-detects somewhere and under-detects
 *      elsewhere — a direct cause of cross-timeframe disagreement.
 *
 * The replacement thresholds on AMPLITUDE measured in the market's own unit
 * of noise (ATR), not on bar count:
 *
 *   Track a running extreme in the current direction. Confirm it as a swing
 *   only once price retraces `swingReversalAtr × ATR` away from it; the
 *   retracement bar becomes the new extreme in the opposite direction.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * PROVEN PROPERTIES
 * ──────────────────────────────────────────────────────────────────────────
 *
 * • MINIMUM LEG AMPLITUDE (by construction, not by filtering).
 *   When a high H is confirmed, the confirming bar's low satisfies
 *   L ≤ H − k·ATR, and that bar becomes the new low candidate. The next
 *   confirmed low is ≤ L. Hence every leg spans ≥ k·ATR. There is no
 *   separate "significance filter" to tune — significance is structural.
 *
 * • STRICT ALTERNATION (by construction). Direction flips on every
 *   confirmation, so output is H,L,H,L,… No dominance/collapse pass is
 *   needed; the previous filterDominantSwings step is now provably
 *   redundant and has been removed rather than left as a no-op.
 *
 * • NO LOOK-AHEAD. The state at bar i is a function of candles[0..i] only.
 *   ATR at bar i likewise uses only candles[0..i] (see atrSeries).
 *
 * • NO REPAINTING. A swing is emitted only at its confirmation bar and is
 *   never revised afterwards. The still-forming extreme is deliberately NOT
 *   emitted: it can still move, and emitting it would repaint. This is why
 *   the newest visible extreme is not yet a swing — the same convention as
 *   a provisional final zigzag leg in professional charting software.
 *
 * • REPLAY / PREFIX STABILITY. Because every emission depends only on bars
 *   at or before its confirmation bar, running the detector on candles[0..m]
 *   returns exactly the swings of the full run whose confirmedIndex ≤ m.
 *   Replay stepping and a live reload therefore agree bar-for-bar.
 *
 * • SCALE INVARIANCE. The threshold is denominated in ATR, which rescales
 *   with timeframe and volatility regime, so one config behaves consistently
 *   on 15m and 1D and in both quiet and violent markets.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY k = 2 (swingReversalAtr)
 * ──────────────────────────────────────────────────────────────────────────
 *
 * ATR is the expected true range of a single bar, i.e. the amplitude of
 * ordinary one-bar noise.
 *
 *   k = 1 → a reversal equal to one typical bar confirms a swing. A single
 *           ordinary bar is then sufficient to create structure, which is
 *           not a filter at all.
 *   k = 2 → the reversal must exceed two typical bars. Reaching it requires
 *           either one >2σ bar or two consecutive adverse bars, so it
 *           separates "direction changed" from "one bar was noisy" — the
 *           smallest multiple that does so.
 *   k ≥ 3 → every leg must span ≥3 ATR. In quiet regimes genuine structural
 *           swings fall below that bar and are silently dropped, violating
 *           the "must not miss major swings" requirement.
 *
 * k = 2 is therefore the minimum value that removes single-bar noise while
 * retaining every leg a trader would actually draw. It is configurable, and
 * it is the only magic number in this module.
 */
export function detectSwings(
  candles: Candle[],
  config: MarketStructureConfig,
): SwingPoint[] {
  const period = config.swingAtrPeriod
  const k      = config.swingReversalAtr

  if (candles.length < period + 2) return []

  const highs  = candles.map(c => c.high)
  const lows   = candles.map(c => c.low)
  const closes = candles.map(c => c.close)

  const atrs = atrSeries(highs, lows, closes, period)
  if (atrs.length === 0) return []

  // atrs[0] is the ATR at candle index `period`; detection starts there
  // because no earlier bar has a knowable volatility unit to threshold on.
  const start = period
  const atrAt = (i: number): number => atrs[i - start]

  const swings: SwingPoint[] = []
  const emit = (index: number, confirmedIndex: number, type: 'high' | 'low'): void => {
    swings.push({
      index,
      confirmedIndex,
      timestamp: candles[index].openTime,
      price: type === 'high' ? highs[index] : lows[index],
      type,
      label: null,
    })
  }

  // Direction of the leg currently being tracked:
  //   'up'   → tracking a rising extreme (a candidate swing HIGH)
  //   'down' → tracking a falling extreme (a candidate swing LOW)
  //   null   → not yet established; track both until one side reverses
  let dir: 'up' | 'down' | null = null
  let hiIdx = start
  let loIdx = start

  for (let i = start; i < candles.length; i++) {
    const threshold = k * atrAt(i)

    // A zero/NaN ATR (perfectly flat or degenerate data) yields a zero
    // threshold, which would confirm a swing on any movement at all. Treat
    // it as "no tradeable volatility" and simply track extremes instead.
    const usable = Number.isFinite(threshold) && threshold > 0

    if (dir === null) {
      if (highs[i] > highs[hiIdx]) hiIdx = i
      if (lows[i]  < lows[loIdx])  loIdx = i
      if (!usable) continue

      // Establish direction WITHOUT emitting.
      //
      // The extreme standing at the start of the window is bounded only on
      // its right: we watched price move away from it, but never watched
      // price move INTO it. It is therefore not an observed local extremum,
      // it is an artifact of where the data window happens to begin — and it
      // is window-dependent, so backfilling older history would silently
      // relocate it and change the swing set on a region already analysed.
      // Suppressing it costs nothing (any genuine reversal is still captured
      // once direction is known) and buys exact stability under backfill and
      // reload.
      //
      // Tie-break: with no prior structure neither side has precedence, so
      // the drop-from-high test is evaluated first. The order is fixed and
      // documented purely to keep the output deterministic.
      if (highs[hiIdx] - lows[i] >= threshold) {
        dir = 'down'
        loIdx = i
      } else if (highs[i] - lows[loIdx] >= threshold) {
        dir = 'up'
        hiIdx = i
      }
      continue
    }

    if (dir === 'up') {
      if (highs[i] > highs[hiIdx]) {
        hiIdx = i                      // leg extends; candidate moves, nothing emitted
      } else if (usable && highs[hiIdx] - lows[i] >= threshold) {
        emit(hiIdx, i, 'high')         // reversal confirmed
        dir = 'down'
        loIdx = i
      }
    } else {
      if (lows[i] < lows[loIdx]) {
        loIdx = i
      } else if (usable && highs[i] - lows[loIdx] >= threshold) {
        emit(loIdx, i, 'low')
        dir = 'up'
        hiIdx = i
      }
    }
  }

  return swings
}
