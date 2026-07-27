/**
 * What counts as a well-formed series. One definition, one home.
 *
 * A misordered or malformed series does not produce an error downstream — it
 * produces plausible numbers. Every window would be built from candles in the
 * wrong order, `inferBarMs` would measure the wrong spacing, VWAP session
 * anchoring would key off the wrong bars, and the run would report a few
 * hundred perfectly ordinary-looking observations. A measurement harness
 * cannot tolerate an input class whose failure mode is "looks fine".
 *
 * The rule was originally enforced only in `parseSeriesFile`, so any series
 * reaching `runSeries` by another route — an in-memory source, a direct call —
 * bypassed it. It is now checked at the point of use.
 */
import type { Candle } from '../modules/market/types'
import type { Series } from './types'

const PRICE_FIELDS = ['open', 'high', 'low', 'close'] as const

/**
 * Throws unless `series` is well-formed. Cheap: one linear pass.
 *
 * An EMPTY series is well-formed. "Nothing to measure" is a legitimate state —
 * `runSeries` returns no observations for it — and conflating it with
 * "corrupt" would make an ordinary short symbol indistinguishable from a
 * broken file.
 */
export function assertWellFormedSeries(series: Series): void {
  const where = `${series.symbol}/${series.timeframe}`
  const cs: readonly Candle[] = series.candles

  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]
    for (const f of PRICE_FIELDS) {
      if (!Number.isFinite(c[f])) throw new Error(`${where}: candle ${i}: ${f} is not a finite number (${c[f]})`)
      if (c[f] <= 0) throw new Error(`${where}: candle ${i}: ${f} must be > 0, got ${c[f]}`)
    }
    if (c.high < c.low) throw new Error(`${where}: candle ${i}: high ${c.high} < low ${c.low}`)
    if (!Number.isFinite(c.volume) || c.volume < 0) {
      throw new Error(`${where}: candle ${i}: volume must be >= 0 and finite, got ${c.volume}`)
    }
    if (!Number.isFinite(c.openTime)) throw new Error(`${where}: candle ${i}: openTime is not a finite number`)
    if (i > 0 && c.openTime <= cs[i - 1].openTime) {
      throw new Error(`${where}: candles are not strictly increasing in openTime at index ${i}`)
    }
  }
}

/**
 * What is NOT checked, and why.
 *
 * - `high >= max(open, close)` and `low <= min(open, close)`. Real exchange
 *   data violates these on rare bars (auction prints, feed corrections), and
 *   rejecting a whole symbol for one such bar would bias the corpus toward
 *   clean venues. The indicators tolerate it.
 * - Uniform bar spacing. Gaps are real: exchanges halt, and Sentinel's VWAP
 *   already detects mid-session gaps explicitly. Requiring uniformity would
 *   reject genuine data.
 * - `takerBuyVolume + takerSellVolume === volume`. Not all sources populate
 *   the taker split; volume analysis handles its absence.
 */
