/**
 * Trading metrics.
 *
 * A "trade" here is one observation where the engine named a direction, held
 * from the decision bar's close to the horizon bar's close. That definition
 * carries three limitations, all of which change how the numbers should be
 * read, and none of which are hidden:
 *
 * 1. TIME EXIT, NOT BRACKET EXIT. The trade exits at the horizon, not at the
 *    plan's stop or target. A bracket simulation needs to know whether the stop
 *    or the target was touched FIRST, and MFE/MAE cannot answer that — they
 *    record the extremes, not their order. Rather than assume an order (the
 *    usual silent choice, and the one that flatters the strategy), the harness
 *    reports the unambiguous time-exit result and, separately, how often the
 *    stop and the target were each reached at all. `stopTouchedRate` is an
 *    upper bound on stop-outs and `targetTouchedRate` an upper bound on target
 *    hits; they can sum above 1, and that is the measurement, not an error.
 *
 * 2. NO COSTS. No fee, no funding, no slippage. Every figure is gross. Crypto
 *    perp round-trip cost is on the order of several basis points plus
 *    slippage, so a strategy with an edge under 0.1% per trade is not
 *    distinguishable from noise at this level of measurement.
 *
 * 3. OVERLAPPING TRADES. At stride < horizon, consecutive trades share bars.
 *    The equity curve is then not a curve any single account could have
 *    traded, and dispersion statistics — Sharpe, Sortino, max drawdown — are
 *    computed on dependent samples. `overlapping` is set on every result that
 *    has this property, and annualisation is refused when it is set.
 *
 * The R multiple uses the engine's OWN stop distance:
 *
 *     R = (forward return in ATR) · direction / (stop distance in ATR)
 *
 * Not a fixed 1-ATR risk unit. With an assumed risk unit, every trading metric
 * would be measuring the assumption instead of the plan. Trades whose plan has
 * no stop are excluded and counted in `excludedNoStop`.
 */
import type { Observation } from '../types'
import type { TradingMetrics, Trade } from './types'
import { mean, median, stdev, sum } from './stats'
import { directionSign } from './predictions'

/**
 * Builds the trade list for one horizon.
 *
 * Ordered by `asOf` then symbol, so the equity curve is chronological and
 * reproducible regardless of the order observations arrived in.
 */
export function buildTrades(
  observations: readonly Observation[],
  horizonBars: number,
): { trades: Trade[]; excludedNoStop: number; excludedNoOutcome: number; excludedNoDirection: number } {
  const trades: Trade[] = []
  let excludedNoStop = 0
  let excludedNoOutcome = 0
  let excludedNoDirection = 0

  for (const o of observations) {
    const sign = directionSign(o)
    if (sign === 0) { excludedNoDirection++; continue }
    const outcome = o.outcomes[horizonBars]
    if (outcome === null || outcome === undefined) { excludedNoOutcome++; continue }
    const stop = o.features.stop_distance_atr
    if (typeof stop !== 'number' || !Number.isFinite(stop) || stop <= 0) { excludedNoStop++; continue }

    const target = o.features.target_distance_atr
    // MFE/MAE are stated for a LONG. Flip them for a short: the short's
    // favourable excursion is the long's adverse one.
    const favourableAtr = sign > 0 ? outcome.mfeAtr : -outcome.maeAtr
    const adverseAtr = sign > 0 ? outcome.maeAtr : -outcome.mfeAtr

    trades.push({
      symbol: o.symbol,
      timeframe: o.timeframe,
      asOf: o.asOf,
      barIndex: o.barIndex,
      horizonBars,
      direction: sign > 0 ? 'long' : 'short',
      confidenceScore: typeof o.features.confidence_score === 'number' ? o.features.confidence_score : null,
      returnPct: sign * outcome.forwardReturn,
      returnAtr: sign * outcome.forwardReturnAtr,
      stopDistanceAtr: stop,
      r: (sign * outcome.forwardReturnAtr) / stop,
      // "Touched" = the excursion reached the level at some point in the
      // window. Order is unknowable from these fields; see the file header.
      stopTouched: adverseAtr <= -stop,
      targetTouched: typeof target === 'number' && Number.isFinite(target) && target > 0
        ? favourableAtr >= target
        : null,
      maxFavourableR: favourableAtr / stop,
      maxAdverseR: adverseAtr / stop,
    })
  }

  trades.sort((a, b) => a.asOf - b.asOf || a.symbol.localeCompare(b.symbol) || a.barIndex - b.barIndex)
  return { trades, excludedNoStop, excludedNoOutcome, excludedNoDirection }
}

/**
 * Maximum drawdown of a cumulative series, and the peak it fell from.
 *
 * Computed on the ADDITIVE cumulative R curve, not a compounded equity curve.
 * Compounding would require a position-sizing rule the engine does not
 * specify, and the choice of rule dominates the resulting drawdown. Additive R
 * is the risk-normalised, assumption-free statement: "the worst peak-to-trough
 * run was N units of risk."
 *
 * Returned as a NON-NEGATIVE magnitude. Zero means the curve never fell.
 */
export function maxDrawdown(increments: readonly number[]): { maxDrawdown: number; peak: number; trough: number } {
  let cum = 0, peak = 0, worst = 0, peakAt = 0, troughAt = 0
  for (const x of increments) {
    cum += x
    if (cum > peak) peak = cum
    const dd = peak - cum
    if (dd > worst) { worst = dd; peakAt = peak; troughAt = cum }
  }
  return { maxDrawdown: worst, peak: peakAt, trough: troughAt }
}

/**
 * Downside deviation about a minimum acceptable return.
 *
 *     DD = sqrt( (1/N) · Σ min(rᵢ − MAR, 0)² )
 *
 * Divided by N — ALL observations — not by the count of negatives. This is the
 * standard definition (Sortino & Price 1994); dividing by the negative count
 * produces a much larger denominator for a mostly-winning series and inflates
 * the resulting Sortino ratio, which is a common and quiet error.
 */
export function downsideDeviation(rs: readonly number[], mar = 0): number | null {
  if (rs.length === 0) return null
  return Math.sqrt(sum(rs.map(r => Math.min(r - mar, 0) ** 2)) / rs.length)
}

/**
 * All trading metrics for a set of trades.
 *
 * `overlapping` must be supplied by the caller, which knows the stride: it is
 * not inferable from the trades alone, and getting it wrong silently changes
 * how every dispersion statistic should be read.
 */
export function tradingMetrics(
  trades: readonly Trade[],
  options: { overlapping: boolean; excludedNoStop?: number; excludedNoOutcome?: number; excludedNoDirection?: number } ,
): TradingMetrics {
  const n = trades.length
  const rs = trades.map(t => t.r)
  const wins = rs.filter(r => r > 0)
  const losses = rs.filter(r => r < 0)
  // Exactly-zero R is neither a win nor a loss. Counted separately rather than
  // folded into losses, so win rate + loss rate need not sum to 1 and the
  // discrepancy is visible instead of hidden.
  const scratches = rs.filter(r => r === 0).length

  const grossProfit = sum(wins)
  const grossLoss = Math.abs(sum(losses))

  const avgWin = mean(wins)
  const avgLoss = mean(losses)
  const winRate = n > 0 ? wins.length / n : null
  const lossRate = n > 0 ? losses.length / n : null

  const meanR = mean(rs)
  const sd = stdev(rs)
  const dd = downsideDeviation(rs, 0)
  const drawdown = maxDrawdown(rs)
  const totalR = sum(rs)

  const targetTouchedKnown = trades.filter(t => t.targetTouched !== null)

  return {
    n,
    overlapping: options.overlapping,
    excludedNoStop: options.excludedNoStop ?? 0,
    excludedNoOutcome: options.excludedNoOutcome ?? 0,
    excludedNoDirection: options.excludedNoDirection ?? 0,

    winRate,
    lossRate,
    scratchRate: n > 0 ? scratches / n : null,
    wins: wins.length,
    losses: losses.length,

    averageWinR: avgWin,
    averageLossR: avgLoss,
    // Payoff ratio = average win / |average loss|. Undefined with no losses:
    // an infinite payoff ratio from a 12-trade sample is not information.
    payoffRatio: avgWin !== null && avgLoss !== null && avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : null,
    // Profit factor = gross profit / gross loss. Same reasoning.
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,

    // Expectancy IS the mean R. The win/loss decomposition
    //   E = winRate·avgWin + lossRate·avgLoss
    // is reported separately and asserted equal in the tests; if the two ever
    // disagree, one of them is wrong.
    expectancyR: meanR,
    expectancyDecomposed: winRate !== null && lossRate !== null && avgWin !== null && avgLoss !== null
      ? winRate * avgWin + lossRate * avgLoss
      : null,

    averageR: meanR,
    medianR: median(rs),
    totalR,
    stdevR: sd,

    // Per-trade Sharpe: mean / standard deviation of R, dimensionless. NOT
    // annualised — annualisation needs a trade frequency, and with overlapping
    // windows there is no honest one. `annualisedSharpe` is a separate,
    // explicitly parameterised function.
    sharpePerTrade: meanR !== null && sd !== null && sd > 0 ? meanR / sd : null,
    sortinoPerTrade: meanR !== null && dd !== null && dd > 0 ? meanR / dd : null,

    maxDrawdownR: drawdown.maxDrawdown,
    // Recovery factor = total return / max drawdown. Undefined when the curve
    // never drew down — dividing by zero would report infinite robustness from
    // a sample too short to have fallen yet.
    recoveryFactor: drawdown.maxDrawdown > 0 ? totalR / drawdown.maxDrawdown : null,

    averageReturnPct: mean(trades.map(t => t.returnPct)),
    medianReturnPct: median(trades.map(t => t.returnPct)),

    stopTouchedRate: n > 0 ? trades.filter(t => t.stopTouched).length / n : null,
    targetTouchedRate: targetTouchedKnown.length > 0
      ? targetTouchedKnown.filter(t => t.targetTouched === true).length / targetTouchedKnown.length
      : null,
    averageMaxFavourableR: mean(trades.map(t => t.maxFavourableR)),
    averageMaxAdverseR: mean(trades.map(t => t.maxAdverseR)),
  }
}

/**
 * Annualised Sharpe ratio.
 *
 * REFUSES to annualise overlapping trades. Scaling a per-trade Sharpe by
 * sqrt(tradesPerYear) assumes independent trades; with overlapping forward
 * windows the trades are strongly autocorrelated, and the scaling inflates the
 * figure by roughly sqrt(horizon / stride). That is the single most common way
 * a backtest reports a Sharpe of 4.
 *
 * `tradesPerYear` is supplied by the caller because it depends on bar duration,
 * horizon and stride — none of which a trade list carries.
 */
export function annualisedSharpe(
  m: TradingMetrics,
  tradesPerYear: number,
): { value: number; tradesPerYear: number } | { value: null; reason: string } {
  if (m.overlapping) {
    return { value: null, reason: 'trades overlap; annualising dependent samples inflates the ratio by ~sqrt(horizon/stride)' }
  }
  if (m.sharpePerTrade === null) return { value: null, reason: 'per-trade Sharpe is undefined (n < 2 or zero dispersion)' }
  if (!(tradesPerYear > 0) || !Number.isFinite(tradesPerYear)) {
    return { value: null, reason: `tradesPerYear must be a positive finite number, got ${tradesPerYear}` }
  }
  return { value: m.sharpePerTrade * Math.sqrt(tradesPerYear), tradesPerYear }
}
