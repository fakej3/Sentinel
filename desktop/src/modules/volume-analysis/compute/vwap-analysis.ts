import type { Candle } from '../../market/types'
import type { VWAPAnalysisResult, VolumeAnalysisConfig, VwapSide } from '../types'
import { computeVwapSeries } from '../../indicators/compute/vwap'

/**
 * Bars searched for a VWAP cross.
 *
 * PROVENANCE: heuristic, inherited from the original implementation and left
 * unchanged here because this commit is fixing the cross *test*, not retuning
 * its window — changing both at once would make the behavioural diff
 * unattributable. Its role is to bound "recently": large enough that a cross
 * plus a retest is still visible, small enough that a cross five sessions ago
 * does not keep claiming price respects VWAP. It is not fitted against
 * resolved outcomes.
 */
const VWAP_CROSS_LOOKBACK = 5

/**
 * Price relative to the session VWAP, including whether price has recently
 * crossed it.
 *
 * WHY THIS RECOMPUTES THE SERIES RATHER THAN READING `indicators.vwap`:
 *
 * Cross detection is a property of the VWAP *series*, not of its last value.
 * The previous implementation compared the closes of the last five bars against
 * TODAY'S single VWAP number — a comparison with no meaning, since bar i−4 was
 * never trading against bar i's VWAP. It manufactured crosses whenever VWAP had
 * drifted across a flat stretch of price, and missed crosses where price and
 * VWAP moved together. The comment in the old code called this "approximation";
 * it was not an approximation of anything, because the quantity it approximated
 * was never computed.
 *
 * The series is not carried on `IndicatorResult` because that type is a scalar
 * snapshot that is serialised to the UI and the API; adding an n-length array to
 * it would grow every payload for the benefit of one consumer. The cost is one
 * extra O(n) pass in a pipeline that already performs roughly fifteen of them.
 *
 * There is no divergence risk from computing it twice: both call sites invoke
 * the same pure function on the same `candles` array, and a test pins
 * `computeVwap(c).value` to the last entry of `computeVwapSeries(c).values`.
 */
export function computeVWAPAnalysis(
  candles: Candle[],
  cfg: VolumeAnalysisConfig,
): VWAPAnalysisResult {
  const series = computeVwapSeries(candles)

  if (series.unavailable !== null) {
    return {
      available: false,
      unavailable: series.unavailable,
      value: null,
      side: null,
      distancePercent: null,
      respectingVWAP: null,
    }
  }

  const n = candles.length
  const vwap = series.values[n - 1] as number
  const currentClose = candles[n - 1].close

  const side: VwapSide = currentClose > vwap ? 'above' : currentClose < vwap ? 'below' : 'at'
  const distancePercent = ((currentClose - vwap) / vwap) * 100
  const withinProximity = Math.abs(distancePercent) <= cfg.vwapProximityPercent

  // A cross is a change in the SIGN of (close − VWAP), each bar measured
  // against the VWAP that existed at that bar.
  //
  // The sign is tracked across bars rather than compared pairwise, and zeros
  // are skipped rather than assigned a side. Both details matter:
  //
  //   • A pairwise `prevDiff <= 0 && currDiff > 0` test treats a bar sitting
  //     exactly ON VWAP as being below it, so price touching VWAP and moving
  //     away registers as a traversal. It never went from one side to the
  //     other. (The first bar of a session is exactly this case whenever its
  //     close equals its typical price.)
  //   • A strict pairwise test — `prevDiff < 0 && currDiff > 0` — has the
  //     opposite failure: the sequence (−5, 0, +5) crosses VWAP but neither
  //     adjacent pair is strictly opposite, so the cross is missed.
  //
  // Carrying the last non-zero sign gets both right: (−5, 0, +5) is a cross,
  // (0, +5, +10) is not.
  //
  // Bars whose session accumulation is incomplete carry a null VWAP and are
  // skipped, so a cross is never inferred across a session boundary the window
  // does not fully contain.
  let hasCross = false
  let lastSign = 0
  for (let i = Math.max(0, n - VWAP_CROSS_LOOKBACK); i < n; i++) {
    const barVwap = series.values[i]
    if (barVwap === null) continue
    const sign = Math.sign(candles[i].close - barVwap)
    if (sign === 0) continue
    if (lastSign !== 0 && sign !== lastSign) {
      hasCross = true
      break
    }
    lastSign = sign
  }

  return {
    available: true,
    unavailable: null,
    value: vwap,
    side,
    distancePercent,
    respectingVWAP: withinProximity || hasCross,
  }
}
