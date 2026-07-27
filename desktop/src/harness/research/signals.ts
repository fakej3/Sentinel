/**
 * Signal-level evaluation: does each individual signal predict future returns?
 *
 * A "signal" here is a function from an observation to a scalar, plus a rule
 * turning that scalar into a direction. Two things are then measured, and they
 * are NOT the same question:
 *
 *   INFORMATION  Does the scalar rank future returns? Measured by the
 *                information coefficient (Spearman of signal vs forward
 *                return) and by AUC against the up/down label. Scale-free,
 *                sign-free, and unaffected by how the signal is thresholded.
 *
 *   TRADEABILITY Does a rule built on the signal make money? Measured by
 *                expectancy in R, profit factor, Sharpe, Sortino, drawdown.
 *
 * A signal can have information and be untradeable (the effect is smaller than
 * the cost of acting on it), and a rule can be profitable with an
 * information-free signal (if it accidentally captures drift). Reporting only
 * one of the two is how a technical indicator acquires a reputation.
 *
 * EVERY SIGNAL IS EVALUATED ALONE, before any combination. That is the point:
 * the engine combines ~68 factors, and if none of them carries information
 * individually then the combination is aggregating noise.
 */
import type { Observation } from '../types'
import { mean, spearman, stdev } from '../metrics/stats'
import { rocAuc } from '../metrics/probability'
import { downsideDeviation, maxDrawdown } from '../metrics/trading'
import { bootstrapMean, blockBootstrapMean, tTestMeanZero, type Estimate, type TestResult } from './inference'

/** A named scalar read from one observation. `null` when unavailable. */
export interface SignalDef {
  readonly name: string
  readonly group: string
  /** Scalar value. Sign convention: positive = bullish. */
  readonly value: (o: Observation) => number | null
  /**
   * How the scalar becomes a direction.
   *
   * `sign`      — long when > 0, short when < 0. For centred signals.
   * `threshold` — long above `hi`, short below `lo`. For bounded oscillators,
   *               where the neutral middle is not a directional statement.
   */
  readonly rule: { kind: 'sign' } | { kind: 'threshold'; lo: number; hi: number }
}

export interface SignalResult {
  readonly name: string
  readonly group: string
  readonly horizonBars: number
  readonly n: number
  /** Coverage: share of observations where the signal was available. */
  readonly coverage: number

  // ── Information ──────────────────────────────────────────────────────────
  /** Spearman(signal, forward return). The information coefficient. */
  readonly ic: number | null
  readonly icTest: TestResult | null
  /** AUC of the signal against the up/down label. 0.5 = no discrimination. */
  readonly auc: number | null

  // ── Tradeability ─────────────────────────────────────────────────────────
  readonly trades: number
  readonly hitRate: number | null
  readonly expectancyR: number | null
  readonly expectancyCI: Estimate | null
  readonly expectancyTest: TestResult | null
  readonly profitFactor: number | null
  readonly sharpePerTrade: number | null
  readonly sortinoPerTrade: number | null
  readonly maxDrawdownR: number
  readonly medianR: number | null
}

/** Direction implied by a signal, or 0 for no position. */
function directionOf(def: SignalDef, v: number): number {
  if (def.rule.kind === 'sign') return v > 0 ? 1 : v < 0 ? -1 : 0
  if (v >= def.rule.hi) return 1
  if (v <= def.rule.lo) return -1
  return 0
}

/**
 * Evaluates one signal at one horizon.
 *
 * R uses the OBSERVATION'S OWN stop distance, the same denominator the engine's
 * own trades use, so a signal's expectancy is directly comparable with
 * Sentinel's. Where the plan carried no stop the observation is excluded from
 * the trading block but still counted for the information block, which needs
 * only the return.
 */
export function evaluateSignal(
  def: SignalDef,
  observations: readonly Observation[],
  horizonBars: number,
  seed = 11,
): SignalResult {
  const vals: number[] = []
  const rets: number[] = []
  const ups: boolean[] = []
  const rs: number[] = []
  const hits: boolean[] = []
  // Grouped by symbol, so the block bootstrap resamples whole price paths.
  const bySymbol = new Map<string, number[]>()

  let available = 0
  for (const o of observations) {
    const outcome = o.outcomes[horizonBars]
    if (outcome === null || outcome === undefined) continue
    const v = def.value(o)
    if (v === null || !Number.isFinite(v)) continue
    available++

    vals.push(v)
    rets.push(outcome.forwardReturn)
    ups.push(outcome.up)

    const dir = directionOf(def, v)
    if (dir === 0) continue
    const stop = o.features.stop_distance_atr
    if (typeof stop !== 'number' || !Number.isFinite(stop) || stop <= 0) continue

    const r = (dir * outcome.forwardReturnAtr) / stop
    rs.push(r)
    hits.push(dir * outcome.forwardReturn > 0)
    const bucket = bySymbol.get(o.symbol)
    if (bucket === undefined) bySymbol.set(o.symbol, [r]); else bucket.push(r)
  }

  const withOutcome = observations.filter(o => {
    const r = o.outcomes[horizonBars]
    return r !== null && r !== undefined
  }).length

  const ic = vals.length >= 3 ? spearman(vals, rets) : null
  const sd = stdev(rs)
  const dd = downsideDeviation(rs, 0)
  const m = mean(rs)
  const wins = rs.filter(x => x > 0)
  const losses = rs.filter(x => x < 0)
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0))

  return {
    name: def.name,
    group: def.group,
    horizonBars,
    n: vals.length,
    coverage: withOutcome > 0 ? available / withOutcome : 0,

    ic,
    // Under the null of no association, Spearman's rho has SE ≈ 1/sqrt(n−1);
    // the t-test on Fisher-z would be marginally tighter but the difference is
    // immaterial at these sample sizes and the simpler statistic is auditable.
    icTest: ic !== null && vals.length > 3
      ? {
        statistic: ic * Math.sqrt(vals.length - 1),
        pValue: 2 * (1 - normalCdfLocal(Math.abs(ic) * Math.sqrt(vals.length - 1))),
        effectSize: ic,
        effectSizeName: 'Spearman rho',
        n: vals.length,
        test: 'Spearman rank correlation, normal approximation',
      }
      : null,
    auc: vals.length >= 3 ? rocAuc(vals, ups) : null,

    trades: rs.length,
    hitRate: hits.length > 0 ? hits.filter(Boolean).length / hits.length : null,
    expectancyR: m,
    expectancyCI: bySymbol.size >= 2
      ? blockBootstrapMean([...bySymbol.values()], 3000, seed)
      : bootstrapMean(rs, 3000, seed),
    expectancyTest: tTestMeanZero(rs),
    profitFactor: grossLoss > 0 ? wins.reduce((a, b) => a + b, 0) / grossLoss : null,
    sharpePerTrade: m !== null && sd !== null && sd > 0 ? m / sd : null,
    sortinoPerTrade: m !== null && dd !== null && dd > 0 ? m / dd : null,
    maxDrawdownR: maxDrawdown(rs).maxDrawdown,
    medianR: rs.length > 0 ? [...rs].sort((a, b) => a - b)[Math.floor(rs.length / 2)] : null,
  }
}

function normalCdfLocal(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp(-z * z / 2)
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - p : p
}

const f = (o: Observation, k: string): number | null => {
  const v = o.features[k]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * The signals to evaluate.
 *
 * Sign convention throughout: POSITIVE = BULLISH. Where the engine's raw field
 * has the opposite orientation it is negated here, so that a negative IC always
 * means "this signal points the wrong way" and never "this field happens to be
 * inverted".
 *
 * Distance-to-EMA signals are `sign`-ruled: above the average is bullish. RSI,
 * StochRSI, MFI and CCI are `threshold`-ruled at their conventional levels,
 * because the middle of an oscillator is not a directional claim and treating
 * it as one would manufacture trades out of noise.
 */
export const SIGNALS: readonly SignalDef[] = [
  // ── Trend / EMA ───────────────────────────────────────────────────────────
  { name: 'dist_ema20', group: 'EMA', value: o => f(o, 'dist_ema20'), rule: { kind: 'sign' } },
  { name: 'dist_ema50', group: 'EMA', value: o => f(o, 'dist_ema50'), rule: { kind: 'sign' } },
  { name: 'dist_ema200', group: 'EMA', value: o => f(o, 'dist_ema200'), rule: { kind: 'sign' } },
  { name: 'ema_stack', group: 'EMA', value: o => {
    const a = o.categorical.ema_alignment
    return a === 'bullish_stack' ? 1 : a === 'bearish_stack' ? -1 : 0
  }, rule: { kind: 'sign' } },
  { name: 'ema20_vs_50_cross', group: 'EMA', value: o => {
    // dist_emaN = (price − EMA_N)/price, so EMA20 − EMA50 has the OPPOSITE
    // sign to dist20 − dist50. Writing it the wrong way round inverted the
    // signal and reported IC = −0.130 for what is in fact a +0.130 signal —
    // caught because the `ema_cross` baseline, written correctly, disagreed.
    const d20 = f(o, 'dist_ema20'), d50 = f(o, 'dist_ema50')
    return d20 === null || d50 === null ? null : d50 - d20
  }, rule: { kind: 'sign' } },

  // ── Momentum ──────────────────────────────────────────────────────────────
  { name: 'macd_hist_atr', group: 'Momentum', value: o => f(o, 'macd_hist_atr'), rule: { kind: 'sign' } },
  { name: 'macd_sep_atr', group: 'Momentum', value: o => f(o, 'macd_sep_atr'), rule: { kind: 'sign' } },
  { name: 'macd_hist_delta_atr', group: 'Momentum', value: o => f(o, 'macd_hist_delta_atr'), rule: { kind: 'sign' } },
  { name: 'rsi', group: 'Momentum', value: o => f(o, 'rsi'), rule: { kind: 'threshold', lo: 30, hi: 70 } },
  { name: 'rsi_centred', group: 'Momentum', value: o => { const v = f(o, 'rsi'); return v === null ? null : v - 50 }, rule: { kind: 'sign' } },
  { name: 'stoch_k', group: 'Momentum', value: o => f(o, 'stoch_k'), rule: { kind: 'threshold', lo: 0.2, hi: 0.8 } },
  { name: 'cci', group: 'Momentum', value: o => f(o, 'cci'), rule: { kind: 'threshold', lo: -100, hi: 100 } },
  { name: 'adx_di_spread', group: 'Momentum', value: o => f(o, 'adx_di_spread'), rule: { kind: 'sign' } },

  // ── Market structure ──────────────────────────────────────────────────────
  { name: 'ms_hh_minus_lh', group: 'Structure', value: o => {
    const hh = f(o, 'ms_hh'), lh = f(o, 'ms_lh')
    return hh === null || lh === null ? null : hh - lh
  }, rule: { kind: 'sign' } },
  { name: 'ms_hl_minus_ll', group: 'Structure', value: o => {
    const hl = f(o, 'ms_hl'), ll = f(o, 'ms_ll')
    return hl === null || ll === null ? null : hl - ll
  }, rule: { kind: 'sign' } },
  { name: 'ms_trend', group: 'Structure', value: o =>
    o.categorical.ms_trend === 'bullish' ? 1 : o.categorical.ms_trend === 'bearish' ? -1 : 0,
  rule: { kind: 'sign' } },
  { name: 'ms_bos', group: 'Structure', value: o => f(o, 'ms_bos_detected'), rule: { kind: 'sign' } },
  { name: 'ms_choch', group: 'Structure', value: o => f(o, 'ms_choch_detected'), rule: { kind: 'sign' } },
  { name: 'ms_breakout', group: 'Structure', value: o => f(o, 'ms_breakout_confirmed'), rule: { kind: 'sign' } },

  // ── Volume ────────────────────────────────────────────────────────────────
  { name: 'rel_volume', group: 'Volume', value: o => { const v = f(o, 'rel_volume'); return v === null ? null : v - 1 }, rule: { kind: 'sign' } },
  { name: 'vol_strength', group: 'Volume', value: o => f(o, 'vol_strength'), rule: { kind: 'sign' } },
  { name: 'vol_confirms', group: 'Volume', value: o => f(o, 'vol_confirms'), rule: { kind: 'sign' } },
  { name: 'mfi_centred', group: 'Volume', value: o => { const v = f(o, 'mfi'); return v === null ? null : v - 50 }, rule: { kind: 'sign' } },

  // ── VWAP ──────────────────────────────────────────────────────────────────
  { name: 'dist_vwap', group: 'VWAP', value: o => f(o, 'dist_vwap'), rule: { kind: 'sign' } },
  { name: 'vwap_side', group: 'VWAP', value: o =>
    o.categorical.vwap_side === 'above' ? 1 : o.categorical.vwap_side === 'below' ? -1 : 0,
  rule: { kind: 'sign' } },

  // ── Support / resistance ──────────────────────────────────────────────────
  // Closer to support than resistance reads as bullish. Negated so positive is
  // bullish under the file-wide convention.
  { name: 'sr_position', group: 'S/R', value: o => {
    const s = f(o, 'sr_support_dist'), r = f(o, 'sr_resistance_dist')
    return s === null || r === null ? null : r - s
  }, rule: { kind: 'sign' } },
  { name: 'sr_zone_count', group: 'S/R', value: o => f(o, 'sr_active_zones'), rule: { kind: 'sign' } },

  // ── Engine aggregates ─────────────────────────────────────────────────────
  { name: 'trend_label', group: 'Engine', value: o =>
    o.categorical.trend.includes('bullish') ? 1 : o.categorical.trend.includes('bearish') ? -1 : 0,
  rule: { kind: 'sign' } },
  { name: 'confidence_directional', group: 'Engine', value: o => {
    // The engine's own conviction, signed by its own direction. This is the
    // engine's complete directional statement as a single scalar.
    const c = f(o, 'confidence_score')
    const d = o.categorical.direction
    if (c === null) return null
    return d === 'long' ? c : d === 'short' ? -c : 0
  }, rule: { kind: 'sign' } },
  { name: 'confidence_spread', group: 'Engine', value: o => {
    const b = f(o, 'confidence_bullish'), s = f(o, 'confidence_bearish')
    return b === null || s === null ? null : b - s
  }, rule: { kind: 'sign' } },
  { name: 'maturity_signed', group: 'Engine', value: o => {
    const m = f(o, 'maturity')
    const d = o.categorical.direction
    if (m === null) return null
    return d === 'long' ? m : d === 'short' ? -m : 0
  }, rule: { kind: 'sign' } },
  { name: 'trust_score', group: 'Engine', value: o => f(o, 'trust_score'), rule: { kind: 'sign' } },
  { name: 'evidence_count', group: 'Engine', value: o => f(o, 'evidence_count'), rule: { kind: 'sign' } },
]
