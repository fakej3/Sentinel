/**
 * The walk-forward runner.
 *
 * The whole harness reduces to one loop, and the loop's correctness reduces to
 * one line. At decision bar `i` the engine is given
 *
 *     candles.slice(i - lookbackBars + 1, i + 1)
 *
 * and the outcome is read from
 *
 *     candles[i + 1 .. i + h]
 *
 * Those two ranges are disjoint by construction. Every other guarantee in this
 * file exists to keep them that way:
 *
 *   - the window is a slice, so `analyseWindow` cannot index past its end;
 *   - the ATR used to scale outcomes is taken from the window's own snapshot,
 *     never recomputed over the future;
 *   - nothing is aggregated across bars, so no running state can carry a
 *     future value backwards.
 *
 * The test `no-lookahead.test.ts` enforces this empirically: it randomises
 * every candle after `i` and asserts the observation at `i` is byte-identical.
 * That is a stronger statement than prefix stability, because it would also
 * catch a leak through a shared mutable buffer.
 */
import type { Candle } from '../modules/market/types'
import { analyseWindow } from './snapshot'
import { extractCategorical, extractFeatures } from './features'
import { computeOutcomes } from './outcomes'
import { assertWellFormedSeries } from './validate'
import { DEFAULT_RUN_CONFIG } from './types'
import type { CandleSource, Observation, RunConfig, RunResult, Series } from './types'

/** Reasons a bar produced no observation. Counted, never silently dropped. */
export type SkipReason =
  | 'no-atr'
  | 'no-price'
  | 'no-outcome-at-any-horizon'

function resolve(config: Partial<RunConfig>): RunConfig {
  const merged = { ...DEFAULT_RUN_CONFIG, ...config }
  if (!Number.isInteger(merged.lookbackBars) || merged.lookbackBars < 2) {
    throw new Error(`lookbackBars must be an integer >= 2, got ${merged.lookbackBars}`)
  }
  if (!Number.isInteger(merged.stride) || merged.stride < 1) {
    throw new Error(`stride must be an integer >= 1, got ${merged.stride}`)
  }
  if (merged.horizons.length === 0) throw new Error('horizons must not be empty')
  for (const h of merged.horizons) {
    if (!Number.isInteger(h) || h < 1) throw new Error(`horizon must be a positive integer, got ${h}`)
  }
  return merged
}

/**
 * The last bar index worth evaluating.
 *
 * Bars whose every horizon runs past the end of the data produce an
 * observation with all-null outcomes. Those are not free: pooled into the
 * corpus they would look like observations while contributing nothing, and
 * anything that counts rows before checking outcomes would over-report its
 * sample size. They are excluded here and counted as skips.
 */
function lastEvaluableBar(n: number, horizons: readonly number[]): number {
  const shortest = Math.min(...horizons)
  // computeOutcome requires i + h < n.
  return n - shortest - 1
}

export function runSeries(series: Series, config: Partial<RunConfig> = {}): RunResult {
  const cfg = resolve(config)
  // Before anything else: a malformed series does not fail downstream, it
  // produces plausible numbers. See `validate.ts`.
  assertWellFormedSeries(series)
  const candles: readonly Candle[] = series.candles
  const observations: Observation[] = []
  const skipped: Record<string, number> = {}
  const skip = (r: SkipReason): void => { skipped[r] = (skipped[r] ?? 0) + 1 }

  const first = cfg.lookbackBars - 1
  const last = lastEvaluableBar(candles.length, cfg.horizons)

  for (let i = first; i <= last; i += cfg.stride) {
    // ── PAST ────────────────────────────────────────────────────────────────
    const window = candles.slice(i - cfg.lookbackBars + 1, i + 1)
    const snapshot = analyseWindow(series.symbol, series.timeframe, window)

    const price = candles[i].close
    if (!Number.isFinite(price) || price <= 0) { skip('no-price'); continue }

    // ATR as known at bar i. Outcomes are expressed in these units, so taking
    // it from anywhere else would be the leak this file exists to prevent.
    const atr = snapshot.indicators.atr
    if (atr === null || !Number.isFinite(atr) || atr <= 0) { skip('no-atr'); continue }

    // ── FUTURE — the only expression in the harness that reads past bar i ────
    const outcomes = computeOutcomes(candles, i, cfg.horizons, atr)
    if (cfg.horizons.every(h => outcomes[h] === null)) { skip('no-outcome-at-any-horizon'); continue }

    observations.push({
      symbol: series.symbol,
      timeframe: series.timeframe,
      barIndex: i,
      asOf: candles[i].openTime,
      features: extractFeatures(snapshot, price),
      categorical: extractCategorical(snapshot),
      outcomes,
    })

    if (cfg.progressEvery > 0 && observations.length % cfg.progressEvery === 0) {
      console.log(`[harness] ${series.symbol} ${series.timeframe}: ${observations.length} observations (bar ${i}/${last})`)
    }
  }

  return { symbol: series.symbol, timeframe: series.timeframe, observations, skipped, config: cfg }
}

/**
 * Runs every series a source offers.
 *
 * Series are processed independently and in the order the source lists them,
 * so a run is reproducible from (source, config) alone. Nothing is shared
 * between series — pooling across symbols is a decision for the metrics layer,
 * which has to account for cross-sectional correlation and cannot do so if the
 * runner has already merged the rows.
 */
export async function runSource(
  source: CandleSource,
  config: Partial<RunConfig> = {},
): Promise<readonly RunResult[]> {
  const series = await source.list()
  return series.map(s => runSeries(s, config))
}

/** Total observations across runs — the honest sample size before dedup. */
export function totalObservations(runs: readonly RunResult[]): number {
  return runs.reduce((n, r) => n + r.observations.length, 0)
}
