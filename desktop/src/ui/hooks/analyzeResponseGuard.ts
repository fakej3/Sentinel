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
