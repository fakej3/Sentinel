/**
 * One decision, computed from one window of candles and nothing else.
 *
 * This is the harness's contact surface with the V5 engine. It takes a window
 * of candles that ENDS at the decision bar and returns what the engine would
 * have said at that moment. It has no access to the parent series, so it
 * cannot see the future even by accident — the leak, if there is one, has to
 * be in the caller, which is why `engine.ts` keeps the future in exactly one
 * expression.
 *
 * The window is passed by value: callers must hand in a slice, never the full
 * array with an index.
 */
import type { Candle, MarketData, Ticker24h, Timeframe } from '../modules/market/types'
import { computeIndicators } from '../modules/indicators/index'
import { computeMarketStructure } from '../modules/market-structure/index'
import { computeSupportResistance } from '../modules/support-resistance/index'
import { computeVolumeAnalysis } from '../modules/volume-analysis/index'
import { computeAnalysis } from '../modules/analysis/index'
import { validateAnalysis } from '../modules/validation/index'
import { computeConfidence } from '../modules/confidence/index'
import { computeTradePlan } from '../modules/pipeline/compute/trade-plan'
import type { PipelineSnapshot } from './features'

const MS_PER_DAY = 86_400_000

/**
 * Median spacing between consecutive opens.
 *
 * Median rather than last-pair: a single gap in the window would otherwise
 * report a doubled bar duration, which would halve the 24h window and change
 * the ticker — a data artefact leaking into engine input. Same defect class as
 * the VWAP `inferBarDuration` fallback that was fixed in `compute/vwap.ts`.
 */
export function inferBarMs(window: readonly Candle[]): number | null {
  if (window.length < 2) return null
  const deltas: number[] = []
  for (let i = 1; i < window.length; i++) {
    const d = window[i].openTime - window[i - 1].openTime
    if (Number.isFinite(d) && d > 0) deltas.push(d)
  }
  if (deltas.length === 0) return null
  deltas.sort((a, b) => a - b)
  return deltas[Math.floor(deltas.length / 2)]
}

/**
 * The 24h ticker, reconstructed from the window.
 *
 * Binance's ticker is a rolling 24h aggregate. Reconstructing it from the last
 * `24h / barDuration` candles is the only way to obtain it without a second
 * data feed, and it is *causal*: every input is a bar at or before the
 * decision bar.
 *
 * This matters beyond cosmetics — `priceChangePercent` reaches
 * `analysis.price.change24hPercent`, which drives the confidence module's
 * volatility-shock penalty. A ticker built from the whole series would be a
 * direct look-ahead into the engine's own score.
 */
export function reconstructTicker(symbol: string, window: readonly Candle[]): Ticker24h {
  const last = window[window.length - 1]
  const barMs = inferBarMs(window)
  // A 1d bar (or coarser) already spans the whole window: k = 1.
  const k = barMs === null
    ? window.length
    : Math.min(window.length, Math.max(1, Math.round(MS_PER_DAY / barMs)))
  const tail = window.slice(window.length - k)
  const first = tail[0]

  let high = -Infinity
  let low = Infinity
  let volume = 0
  let quoteVolume = 0
  let tradeCount = 0
  for (const c of tail) {
    if (c.high > high) high = c.high
    if (c.low < low) low = c.low
    volume += c.volume
    quoteVolume += c.quoteVolume
    tradeCount += c.trades
  }

  const open = first.open
  const change = last.close - open
  return {
    symbol,
    priceChange: change,
    priceChangePercent: open > 0 ? (change / open) * 100 : 0,
    weightedAvgPrice: volume > 0 ? quoteVolume / volume : last.close,
    lastPrice: last.close,
    // No order book in historical candles. Using the close for both sides is
    // the honest encoding of "spread unknown"; nothing downstream reads them.
    bidPrice: last.close,
    askPrice: last.close,
    openPrice: open,
    highPrice: high,
    lowPrice: low,
    volume,
    quoteVolume,
    openTime: first.openTime,
    closeTime: last.closeTime,
    tradeCount,
  }
}

/** MarketData for the window. `fetchedAt` is the decision bar's close — never a wall clock. */
export function windowMarketData(
  symbol: string,
  timeframe: Timeframe,
  window: readonly Candle[],
): MarketData {
  const last = window[window.length - 1]
  return {
    symbol,
    timeframe,
    fetchedAt: last.closeTime,
    // The engine's modules take `Candle[]`; this copy is what keeps them from
    // being able to mutate the harness's series.
    candles: [...window],
    ticker: reconstructTicker(symbol, window),
    fundingRate: null,
    openInterest: null,
  }
}

/**
 * Runs the V5 pipeline over one window.
 *
 * Mirrors `modules/pipeline/index.ts` exactly for the computational stages and
 * stops there: the writer, the AI provider, and the narrative composers are
 * excluded because they produce prose, not measurements, and prose cannot be
 * scored. `computeTradePlan` is included because its direction, risk/reward and
 * maturity are numeric claims about the future that the harness must test.
 *
 * `mtfAgreement` is deliberately absent: multi-timeframe agreement needs a
 * second series aligned in time, and supplying it per-decision without
 * look-ahead is a separate problem. Its absence is recorded rather than faked.
 */
export function analyseWindow(
  symbol: string,
  timeframe: Timeframe,
  window: readonly Candle[],
): PipelineSnapshot {
  const candles = [...window]
  const indicators = computeIndicators(candles)
  const marketStructure = computeMarketStructure(candles)
  const supportResistance = computeSupportResistance(candles, marketStructure, undefined, indicators.atr)
  const volumeAnalysis = computeVolumeAnalysis(candles, indicators, marketStructure, supportResistance)
  const analysis = computeAnalysis(
    windowMarketData(symbol, timeframe, window),
    indicators,
    marketStructure,
    supportResistance,
    volumeAnalysis,
  )
  const validation = validateAnalysis(analysis)
  const confidence = computeConfidence(analysis, validation)
  const tradePlan = computeTradePlan(analysis, supportResistance, confidence, validation, undefined, marketStructure)
  return { indicators, marketStructure, supportResistance, analysis, validation, confidence, tradePlan }
}
