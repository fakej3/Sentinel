/**
 * Pure verification that an analysis response describes exactly what was
 * requested. Extracted out of useAnalyze so the "no stale analysis renders"
 * contract has an isolated, directly-testable unit — this project has no
 * React hook-testing utilities installed (no @testing-library/react, no
 * jsdom; vitest runs with `environment: 'node'`), so a rule this safety-
 * critical must not depend on rendering a hook to be verifiable.
 */

export interface AnalyzeResponseMismatch {
  requestedSymbol: string
  requestedInterval: string
  receivedSymbol: string
  receivedInterval: string
}

/**
 * Returned when the analysis was computed on candles whose last openTime
 * diverges from the chart's current last openTime by more than one interval.
 *
 * A 1-candle drift is expected in web/HTTP mode due to the inherent race
 * between the chart's WebSocket feed and the server-side Binance REST fetch
 * that runs when the analysis is requested. Drifts larger than one interval
 * indicate a structural mismatch — the analysis describes a different market
 * snapshot than what the chart is displaying.
 *
 * In Tauri mode this warning can never fire: the pipeline feeds through the
 * same CandleStore the chart reads from, so the two candle sets are identical
 * by construction (see pipelineFetch.ts / createStoreFetchFn).
 */
export interface AnalyzeWindowStaleness {
  /** ms timestamp of the last candle the analysis was computed on */
  analysisLastOpenTime: number
  /** ms timestamp of the last candle the chart is currently showing */
  chartLastOpenTime: number
  /** analysisLastOpenTime − chartLastOpenTime (negative = analysis is behind) */
  driftMs: number
}

/**
 * Returns a mismatch descriptor when the response's metadata does not match
 * the request, or null when it matches. Symbol comparison is case-insensitive
 * on the request side (matching the same normalisation the transport layer
 * applies before sending), exact on interval.
 */
export function checkAnalyzeResponseMatches(
  data: { metadata: { symbol: string; interval: string } },
  requestedSymbol: string,
  requestedInterval: string,
): AnalyzeResponseMismatch | null {
  const normalizedRequested = requestedSymbol.trim().toUpperCase()
  if (data.metadata.symbol === normalizedRequested && data.metadata.interval === requestedInterval) {
    return null
  }
  return {
    requestedSymbol: normalizedRequested,
    requestedInterval,
    receivedSymbol: data.metadata.symbol,
    receivedInterval: data.metadata.interval,
  }
}

/**
 * Checks whether the analysis candle window is fresh relative to the chart.
 *
 * Returns a staleness descriptor when:
 *   |analysisLastOpenTime − chartLastOpenTime| > intervalMs
 *
 * Returns null when:
 *   - metadata.window is absent (old saved analysis pre-dating this field)
 *   - the drift is within one interval (normal race window in web mode)
 *
 * @param metadata  The metadata block from a PipelineResult response.
 * @param chartLastOpenTimeMs  openTime (ms) of the last candle currently
 *   visible on the chart. In Tauri mode this will always equal the analysis
 *   window's lastOpenTime — the check is a no-op. In web/HTTP mode it can
 *   differ by up to one interval due to the REST vs WebSocket race.
 * @param intervalMs  Duration of one candle in milliseconds (e.g. 3_600_000
 *   for 1h, 900_000 for 15m). Used as the drift tolerance.
 */
export function checkAnalyzeWindowStaleness(
  metadata: { window?: { lastOpenTime: number } },
  chartLastOpenTimeMs: number,
  intervalMs: number,
): AnalyzeWindowStaleness | null {
  if (!metadata.window) return null   // pre-field saved analysis — cannot verify

  const driftMs = metadata.window.lastOpenTime - chartLastOpenTimeMs
  if (Math.abs(driftMs) <= intervalMs) return null   // within one-candle tolerance

  return {
    analysisLastOpenTime: metadata.window.lastOpenTime,
    chartLastOpenTime:    chartLastOpenTimeMs,
    driftMs,
  }
}
