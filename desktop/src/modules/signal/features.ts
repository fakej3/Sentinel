/**
 * Continuous feature engine.
 *
 * Fifteen features, all continuous, none thresholded. Every one is expressed in
 * a scale-free unit — an ATR multiple, a ratio, or a bounded index — so the
 * same value means the same thing on a $3 stock and a $90,000 coin. Phase 1
 * established why that matters: a feature carrying price level lets a model
 * separate eras rather than markets.
 *
 * WHAT THIS FILE DOES NOT DO
 *
 * It does not decide anything. There is no BUY, no SELL, no bullish flag, no
 * comparison against a level that yields a boolean. `full-trend.ts:36-98`
 * performs eleven such comparisons and Phase 6 measured the cost at 34% of the
 * available information on synthetic data. The replacement's job is to hand a
 * model the magnitudes and let the model — and only the model — weigh them.
 *
 * SIGN CONVENTION, WITHOUT EXCEPTION: positive = bullish. Where the natural
 * reading of an indicator is inverted, it is negated here and the docstring
 * says so, so that a negative coefficient in a fitted model always means "this
 * feature points the wrong way" and never "this field happens to be backwards".
 *
 * A NOTE ON EXPECTATIONS. Phase 8 measured no detectable predictive information
 * in any of the underlying indicators on real daily equities (best |IC| = 0.04,
 * every CI containing zero). Nothing here is claimed to predict. These are
 * measurements of market state, represented without loss, so that whether they
 * predict becomes an answerable question instead of an assumed one.
 */
import type { Candle } from '../market/types'
import type { FeatureContext, FeatureSpec, FeatureValue, RawFeatures } from './types'
import { available, unavailable } from './types'
import { returnAutocorrelation, varianceRatio, volatilityRatio, MIN_REGIME_BARS } from './regime'
import { DEFAULT_CONFIG as MS_CONFIG } from '../market-structure/config'
import { atrSeries, emaSeries } from '../indicators/utils'

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Support for a measurement needing `need` bars out of `have`.
 *
 * Saturates at 1. Below `need` it degrades linearly rather than cliff-edging,
 * because a 200-period EMA seeded from 180 bars is not worthless — it is
 * slightly less determined, and the consumer should be told by how much.
 */
function support(have: number, need: number): number {
  if (need <= 0) return 1
  return Math.min(1, have / need)
}

function closes(candles: readonly Candle[]): number[] {
  return candles.map(c => c.close)
}

/** Positive ATR, or null. Every ATR-normalised feature needs this first. */
function atrOf(ctx: FeatureContext): number | null {
  const a = ctx.indicators.atr
  return a !== null && Number.isFinite(a) && a > 0 ? a : null
}

const NO_ATR = 'ATR is unavailable or zero, so no ATR-normalised distance can be expressed'
const NO_BARS = 'the window is empty; there is no current bar to measure from'

/** The decision bar's close, or null on an empty window. */
function lastClose(ctx: FeatureContext): number | null {
  const n = ctx.candles.length
  return n === 0 ? null : ctx.candles[n - 1].close
}

// ── EMA family ────────────────────────────────────────────────────────────────

/**
 * Signed distance from price to the 200-period EMA, in ATR units.
 *
 * The continuous form of `priceAboveEMA200`. Phase 6's decile analysis showed
 * predictive information rising monotonically with |distance| (IC 0.00 in the
 * smallest decile, 0.40 in the largest on synthetic data) — the entire gradient
 * the boolean discards.
 */
export const emaDistance: FeatureSpec = {
  name: 'ema_distance',
  family: 'trend',
  timeframe: 'base',
  scaling: 'rank',
  extract: (ctx): FeatureValue => {
    const ema = ctx.indicators.ema200
    const atr = atrOf(ctx)
    if (ema === null) return unavailable('insufficient-history', 'EMA200 needs 200 bars')
    if (atr === null) return unavailable('degenerate-input', NO_ATR)
    const price = lastClose(ctx)
    if (price === null) return unavailable('insufficient-history', NO_BARS)
    const d = (price - ema) / atr
    return available(d, support(ctx.candles.length, 200),
      `price sits ${d.toFixed(2)} ATR ${d >= 0 ? 'above' : 'below'} the 200-period EMA`)
  },
}

/**
 * Slope of the 20-period EMA over the last `EMA_SLOPE_BARS`, in ATR per bar.
 *
 * A RATE, not a position. Phase 6 found four of the engine's five directional
 * conditions test position and the single rate test (MACD) had IC 0.0055 —
 * leaving the rate channel effectively empty, which is why Phase 4 measured no
 * ability to exploit AR(1) persistence at any strength. This is one of three
 * features restoring it.
 *
 * Both endpoints are read off ONE `emaSeries` pass — the indicator module's own
 * implementation — so the feature cannot drift from `indicators.ema20`, and the
 * earlier endpoint is the value that was genuinely knowable at that bar rather
 * than a re-seeded approximation of it.
 */
export const EMA_SLOPE_BARS = 10

export const emaSlope: FeatureSpec = {
  name: 'ema_slope',
  family: 'trend',
  timeframe: 'base',
  scaling: 'rank',
  extract: (ctx): FeatureValue => {
    const atr = atrOf(ctx)
    if (atr === null) return unavailable('degenerate-input', NO_ATR)
    const cs = closes(ctx.candles)
    if (cs.length < 20 + EMA_SLOPE_BARS) {
      return unavailable('insufficient-history', `EMA20 slope needs ${20 + EMA_SLOPE_BARS} bars, have ${cs.length}`)
    }
    // emaSeries[k] is the EMA at candle index (period - 1 + k), so the value
    // EMA_SLOPE_BARS ago is that many entries back from the end.
    const series = emaSeries(cs, 20)
    if (series.length <= EMA_SLOPE_BARS) {
      return unavailable('insufficient-history', 'the EMA20 series is shorter than the slope window')
    }
    const now = series[series.length - 1]
    const then = series[series.length - 1 - EMA_SLOPE_BARS]
    const slope = (now - then) / (EMA_SLOPE_BARS * atr)
    return available(slope, support(cs.length, 20 + EMA_SLOPE_BARS),
      `the 20-period EMA is ${slope >= 0 ? 'rising' : 'falling'} at ${Math.abs(slope).toFixed(3)} ATR per bar`)
  },
}

/**
 * EMA20 − EMA50, in ATR units.
 *
 * The continuous form of the crossover. Phase 4 measured that a plain EMA cross
 * matches the entire engine's directional accuracy (dAcc −0.0014, p = 0.60),
 * which makes its magnitude worth carrying rather than its sign alone.
 */
export const emaSeparation: FeatureSpec = {
  name: 'ema_separation',
  family: 'trend',
  timeframe: 'base',
  scaling: 'rank',
  extract: (ctx): FeatureValue => {
    const fast = ctx.indicators.ema20
    const slow = ctx.indicators.ema50
    const atr = atrOf(ctx)
    if (fast === null || slow === null) return unavailable('insufficient-history', 'EMA20 or EMA50 needs more bars')
    if (atr === null) return unavailable('degenerate-input', NO_ATR)
    const sep = (fast - slow) / atr
    return available(sep, support(ctx.candles.length, 50),
      `the 20-period EMA is ${Math.abs(sep).toFixed(2)} ATR ${sep >= 0 ? 'above' : 'below'} the 50-period`)
  },
}

// ── Oscillators, centred ──────────────────────────────────────────────────────

/**
 * RSI mapped to [-1, 1] by (rsi − 50) / 50.
 *
 * Centred, not thresholded. The engine's `rsiSupportsBullish` fires at
 * `rsi >= rsiBullishMin`, discarding both how far past the threshold the value
 * sits and everything below it. Phase 4 measured that condition as net harmful
 * to the engine's own output (ΔIC +0.0084 when removed).
 */
export const rsiNormalized: FeatureSpec = {
  name: 'rsi_normalized',
  family: 'oscillator',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const rsi = ctx.indicators.rsi
    if (rsi === null) return unavailable('insufficient-history', 'RSI needs 15 bars')
    const v = (rsi - 50) / 50
    return available(v, support(ctx.candles.length, 15), `RSI is ${rsi.toFixed(1)} (${v.toFixed(2)} centred)`)
  },
}

/**
 * MACD histogram in ATR units.
 *
 * No deadband. The engine's ATR-scaled neutrality band (`full-trend.ts:67-69`)
 * is the most information-preserving line in that file — it lets MACD abstain
 * rather than vote on a rounding error — but it still emits a boolean. Carrying
 * the magnitude makes the abstention unnecessary: a separation near zero simply
 * contributes near zero.
 */
export const macdHistogramNormalized: FeatureSpec = {
  name: 'macd_histogram_normalized',
  family: 'momentum',
  timeframe: 'base',
  scaling: 'rank',
  extract: (ctx): FeatureValue => {
    const macd = ctx.indicators.macd
    const atr = atrOf(ctx)
    if (macd === null) return unavailable('insufficient-history', 'MACD needs 35 bars')
    if (atr === null) return unavailable('degenerate-input', NO_ATR)
    const v = macd.histogram / atr
    return available(v, support(ctx.candles.length, 35),
      `the MACD histogram is ${v.toFixed(3)} ATR (${v >= 0 ? 'above' : 'below'} its signal)`)
  },
}

/**
 * ADX scaled to [0, 1], signed by the DI spread.
 *
 * ADX measures trend STRENGTH and is directionless; DI+ − DI− carries the
 * direction. Multiplying them yields a single signed intensity, which is the
 * quantity a directional model wants. Reporting ADX alone would hand the model
 * a magnitude with no sign, and the engine's `adxBelowWeakThreshold` uses it
 * only as a NEUTRAL vote — so its directional content is currently unused.
 */
export const adxNormalized: FeatureSpec = {
  name: 'adx_normalized',
  family: 'trend',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const adx = ctx.indicators.adx
    if (adx === null) return unavailable('insufficient-history', 'ADX needs 28 bars')
    const di = adx.diPlus + adx.diMinus
    if (!(di > 0)) return unavailable('degenerate-input', 'DI+ and DI− are both zero; no directional intensity exists')
    const signedStrength = (adx.adx / 100) * ((adx.diPlus - adx.diMinus) / di)
    return available(signedStrength, support(ctx.candles.length, 28),
      `ADX ${adx.adx.toFixed(1)} with DI spread ${(adx.diPlus - adx.diMinus).toFixed(1)} gives signed intensity ${signedStrength.toFixed(3)}`)
  },
}

// ── Volatility ────────────────────────────────────────────────────────────────

/**
 * Trailing percentile of the current ATR% within the window, in [-0.5, 0.5].
 *
 * A LEVEL statement about volatility, computed inside the feature rather than
 * left to the scaler, because the percentile of a bounded ratio is meaningful
 * on its own and the two would otherwise be the same transform applied twice.
 *
 * BOTH SIDES ARE SMOOTHED THE SAME WAY, and that is the whole subtlety. An
 * earlier version of this feature ranked the Wilder-smoothed current ATR%
 * against a distribution of UNSMOOTHED per-bar true ranges. Those are different
 * distributions: a 14-period average has a fraction of a single bar's variance,
 * so the smoothed value sits near the middle of the raw distribution almost
 * always. Measured on 300 bars of a homoscedastic series, the output had
 * standard deviation 0.069 against the 1/sqrt(12) = 0.289 of the uniform
 * distribution a percentile should have, never came within 0.29 of either
 * bound, and carried a +0.057 mean bias. The feature was reporting a percentile
 * that could not reach its own extremes.
 *
 * The fix is to rank the current ATR% against the trailing series of ATR%,
 * using the indicator module's own `atrSeries` for both. Like against like.
 *
 * NOT directional. It is signed only in the sense that high volatility sits
 * above zero; a model may use it to condition, not to choose a side.
 */
export const ATR_PERCENTILE_WINDOW = 100

/** Wilder's period, matching `indicators/compute/atr.ts` so the two cannot diverge. */
const ATR_PERIOD = 14

export const atrPercentile: FeatureSpec = {
  name: 'atr_percentile',
  family: 'volatility',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const cs = ctx.candles
    // atrSeries yields one value per candle from index ATR_PERIOD onward, so a
    // window of W ATR observations needs W + ATR_PERIOD candles.
    const need = ATR_PERCENTILE_WINDOW + ATR_PERIOD
    if (cs.length < need) {
      return unavailable('insufficient-history', `ATR percentile needs ${need} bars, have ${cs.length}`)
    }
    const atrs = atrSeries(
      cs.map(c => c.high), cs.map(c => c.low), cs.map(c => c.close), ATR_PERIOD,
    )
    if (atrs.length < ATR_PERCENTILE_WINDOW) {
      return unavailable('insufficient-history', 'the ATR series is shorter than the percentile window')
    }

    // atrs[k] is the ATR at candle index ATR_PERIOD + k; normalise each by the
    // close of ITS OWN bar, so the series is comparable across price levels.
    const pct: number[] = []
    for (let k = atrs.length - ATR_PERCENTILE_WINDOW; k < atrs.length; k++) {
      const close = cs[ATR_PERIOD + k].close
      if (close > 0 && Number.isFinite(atrs[k])) pct.push((atrs[k] / close) * 100)
    }
    if (pct.length < 2) return unavailable('degenerate-input', 'no usable ATR observations in the window')

    const cur = pct[pct.length - 1]
    let below = 0, equal = 0
    for (const x of pct) { if (x < cur) below++; else if (x === cur) equal++ }
    const rank = (below + 0.5 * equal) / pct.length - 0.5
    return available(rank, support(cs.length, need),
      `current ATR of ${cur.toFixed(2)}% sits at the ${((rank + 0.5) * 100).toFixed(0)}th percentile `
      + `of the last ${pct.length} bars`)
  },
}

/**
 * Position within the Bollinger channel: (price − middle) / (upper − middle).
 *
 * 0 at the middle band, +1 at the upper, −1 at the lower, and unbounded beyond.
 * Continuous everywhere, including outside the bands — which is exactly where
 * the engine's `priceRelativeToBands` collapses to a single categorical.
 */
export const bollingerPosition: FeatureSpec = {
  name: 'bollinger_position',
  family: 'volatility',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const bb = ctx.indicators.bollingerBands
    if (bb === null) return unavailable('insufficient-history', 'Bollinger Bands need 20 bars')
    const half = bb.upper - bb.middle
    if (!(half > 0)) return unavailable('degenerate-input', 'the Bollinger channel has zero width')
    const price = lastClose(ctx)
    if (price === null) return unavailable('insufficient-history', NO_BARS)
    const pos = (price - bb.middle) / half
    return available(pos, support(ctx.candles.length, 20),
      `price sits ${pos.toFixed(2)} band-widths from the Bollinger midline`)
  },
}

/**
 * Bollinger width as a fraction of the middle band: (upper − lower) / middle.
 *
 * The conventional normalised bandwidth. `BollingerResult.bandwidth` is the RAW
 * price-unit width — a defect that reached users as "bandwidth 6075.99%" on a
 * BTC-scale chart before it was fixed. This feature never touches that field.
 *
 * NOT directional: a volatility state, for conditioning.
 */
export const bollingerWidth: FeatureSpec = {
  name: 'bollinger_width',
  family: 'volatility',
  timeframe: 'base',
  scaling: 'rank',
  extract: (ctx): FeatureValue => {
    const bb = ctx.indicators.bollingerBands
    if (bb === null) return unavailable('insufficient-history', 'Bollinger Bands need 20 bars')
    if (!(bb.middle > 0)) return unavailable('degenerate-input', 'the Bollinger midline is not positive')
    const w = (bb.upper - bb.lower) / bb.middle
    return available(w, support(ctx.candles.length, 20),
      `the Bollinger channel spans ${(w * 100).toFixed(2)}% of its midline`)
  },
}

// ── Structure ─────────────────────────────────────────────────────────────────

/**
 * Signed room to the nearest structure, in ATR units.
 *
 * Positive when resistance is further away than support — price has more room
 * above than below. Negative when the reverse. This is the continuous form of
 * the engine's `insideSupport` / `insideResistance` booleans.
 *
 * SIGN NOTE: the reading "closer to support is bullish" is the mean-reversion
 * one. Whether it holds is for a fitted coefficient to say; the feature only
 * has to be oriented consistently, and Phase 4 measured `sr_position` at
 * IC −0.035 with the same orientation, so a negative weight is the expected
 * outcome rather than a surprise.
 */
export const supportResistanceDistance: FeatureSpec = {
  name: 'sr_distance',
  family: 'structure',
  timeframe: 'base',
  scaling: 'rank',
  extract: (ctx): FeatureValue => {
    const atr = atrOf(ctx)
    if (atr === null) return unavailable('degenerate-input', NO_ATR)
    const sup = ctx.supportResistance.nearestSupport
    const res = ctx.supportResistance.nearestResistance
    if (sup === null || res === null) {
      return unavailable('not-applicable', 'no support and resistance pair exists on both sides of price')
    }
    const price = lastClose(ctx)
    if (price === null) return unavailable('insufficient-history', NO_BARS)
    const toSupport = (price - sup.center) / atr
    const toResistance = (res.center - price) / atr
    const v = toResistance - toSupport
    // Confidence 1, and the reason is that `confidence` means MEASUREMENT
    // SUPPORT, not predictive quality. Given that both zones exist the value is
    // exact arithmetic on three prices — there is no estimator here whose
    // precision could degrade. The zones have already been filtered by
    // `minTouchCount` upstream, and folding `PriceZone.confidence` in here
    // would import the unfitted 0-10 evidence score that Phase 4 measured to
    // have negative Brier skill, dressed up as a support figure.
    return available(v, 1,
      `price has ${toResistance.toFixed(2)} ATR to resistance and ${toSupport.toFixed(2)} ATR to support`)
  },
}

/**
 * Net swing structure: (HH + HL − LH − LL) / total labelled swings.
 *
 * Bounded in [-1, 1] and continuous in the balance, where the engine's
 * `hasConsistentHHHL` is a threshold on each count independently. Phase 4's
 * vote ablation found market structure to be one of only two conditions that
 * contributed at all on synthetic data (ΔIC −0.0163 when removed).
 */
/**
 * Labelled swings `recentStructure` is capped to — not a choice made here.
 * See `market-structure/trend.ts:44`: `labeled.slice(-(minSwingsForTrend * 2))`.
 */
export const SWING_WINDOW = MS_CONFIG.minSwingsForTrend * 2

export const swingStrength: FeatureSpec = {
  name: 'swing_strength',
  family: 'structure',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const s = ctx.marketStructure.recentStructure
    const total = s.higherHighs + s.higherLows + s.lowerHighs + s.lowerLows
    if (total === 0) {
      // 'not-applicable', not 'insufficient-history': a long window with no
      // labelled swings is a market without resolvable structure, which more
      // history does not necessarily fix.
      return unavailable('not-applicable', 'no labelled swings in the window')
    }
    const v = (s.higherHighs + s.higherLows - s.lowerHighs - s.lowerLows) / total
    // Support is the share of the structural window that carries a DIRECTIONAL
    // label. The window is not chosen here: `recentStructure` is defined as the
    // last (minSwingsForTrend × 2) labelled swings (market-structure/trend.ts:44),
    // so that product is the denominator by construction. Equal highs/lows sit
    // in the window but not in `total`, and correctly lower the support of a
    // ratio computed from fewer directional observations.
    return available(v, support(total, SWING_WINDOW),
      `${s.higherHighs + s.higherLows} bullish and ${s.lowerHighs + s.lowerLows} bearish swing labels give a net of ${v.toFixed(2)}`)
  },
}

// ── Participation ─────────────────────────────────────────────────────────────

/**
 * Log relative volume: ln(current / 20-period average).
 *
 * Log, not the raw ratio, because relative volume is bounded below by 0 and
 * unbounded above — a 4× spike and a 4× drought are equally far from normal in
 * log space and wildly unequal in the raw ratio.
 *
 * NOT directional. Volume says how much participation, never which way.
 */
export const volumeAnomaly: FeatureSpec = {
  name: 'volume_anomaly',
  family: 'participation',
  timeframe: 'base',
  scaling: 'rank',
  extract: (ctx): FeatureValue => {
    const vm = ctx.indicators.volumeMA
    if (vm === null) return unavailable('insufficient-history', 'volume MA needs 20 bars')
    const rel = vm.relativeVolume
    if (!Number.isFinite(rel) || rel <= 0) {
      return unavailable('degenerate-input', 'relative volume is zero or undefined; the window may have no traded volume')
    }
    const v = Math.log(rel)
    return available(v, support(ctx.candles.length, 20),
      `volume is ${rel.toFixed(2)}x its 20-bar average (${v >= 0 ? '+' : ''}${v.toFixed(2)} in log units)`)
  },
}

// ── Regime, as features ───────────────────────────────────────────────────────

/**
 * Realised-volatility ratio, centred at 0 by subtracting 1.
 *
 * Expansion positive, contraction negative. Not directional.
 */
export const volatilityRegime: FeatureSpec = {
  name: 'volatility_regime',
  family: 'regime',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const vr = volatilityRatio(ctx.candles)
    if (vr === null) return unavailable('insufficient-history', 'the volatility ratio needs 100 bars of returns')
    const v = vr - 1
    return available(v, support(ctx.candles.length, 101),
      `short-window volatility is ${vr.toFixed(2)}x the long-window level`)
  },
}

/**
 * Trend persistence: the variance ratio, centred at 0 by subtracting 1.
 *
 * Positive means moves persist, negative means they retrace. THE statistic a
 * trend-following engine depends on and the current one never computes — Phase
 * 4 measured that it cannot profit from AR(1) persistence at φ up to 0.5, and
 * Phase 6 traced that to an empty rate channel.
 *
 * NOT directional: it says whether a move tends to continue, not which way the
 * move is. A model must combine it with a direction feature to use it.
 */
export const trendPersistence: FeatureSpec = {
  name: 'trend_persistence',
  family: 'regime',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const vr = varianceRatio(ctx.candles)
    if (vr === null) {
      return unavailable('insufficient-history', `the variance ratio needs ${MIN_REGIME_BARS} bars of returns`)
    }
    const v = vr - 1
    const ac = returnAutocorrelation(ctx.candles)
    return available(v, support(ctx.candles.length - 1, MIN_REGIME_BARS),
      `variance ratio ${vr.toFixed(2)} (${v >= 0 ? 'persistent' : 'mean-reverting'})`
      + (ac === null ? '' : `, lag-1 autocorrelation ${ac.toFixed(3)}`))
  },
}

/**
 * Kaufman efficiency ratio: |net change| / Σ|bar-to-bar change| over the window.
 *
 * In [0, 1]. 1 = a straight line, 0 = pure noise around a level. A measure of
 * how DIRECTLY price travelled, independent of which way — the cleanest single
 * summary of whether a trend-following rule has anything to work with.
 *
 * NOT directional, by construction (it takes an absolute value).
 */
export const EFFICIENCY_WINDOW = 20

export const marketEfficiencyRatio: FeatureSpec = {
  name: 'market_efficiency_ratio',
  family: 'regime',
  timeframe: 'base',
  scaling: 'none',
  extract: (ctx): FeatureValue => {
    const cs = closes(ctx.candles)
    if (cs.length < EFFICIENCY_WINDOW + 1) {
      return unavailable('insufficient-history', `the efficiency ratio needs ${EFFICIENCY_WINDOW + 1} bars, have ${cs.length}`)
    }
    const w = cs.slice(cs.length - (EFFICIENCY_WINDOW + 1))
    const net = Math.abs(w[w.length - 1] - w[0])
    let path = 0
    for (let i = 1; i < w.length; i++) path += Math.abs(w[i] - w[i - 1])
    if (!(path > 0)) return unavailable('degenerate-input', 'price did not move at all over the window')
    const er = net / path
    return available(er, support(cs.length, EFFICIENCY_WINDOW + 1),
      `price covered ${(er * 100).toFixed(0)}% of its path distance as net movement over ${EFFICIENCY_WINDOW} bars`)
  },
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * The default feature set.
 *
 * Order is fixed and load-bearing: `RollingScaler` and every model iterate it,
 * and a reordering would silently repermute a weight vector fitted against the
 * old order. Append; do not reorder.
 */
export const DEFAULT_FEATURES: readonly FeatureSpec[] = [
  emaDistance,
  emaSlope,
  emaSeparation,
  rsiNormalized,
  macdHistogramNormalized,
  adxNormalized,
  atrPercentile,
  bollingerPosition,
  bollingerWidth,
  supportResistanceDistance,
  swingStrength,
  volumeAnomaly,
  volatilityRegime,
  trendPersistence,
  marketEfficiencyRatio,
]

/** Feature names in registry order. */
export const FEATURE_NAMES: readonly string[] = DEFAULT_FEATURES.map(f => f.name)

/**
 * Features that carry a DIRECTION.
 *
 * The rest (`atr_percentile`, `bollinger_width`, `volume_anomaly`,
 * `volatility_regime`, `trend_persistence`, `market_efficiency_ratio`) describe
 * market state without implying a side. Stated explicitly so a model cannot
 * accidentally read a regime statistic as a directional vote — which is close
 * to what the current engine does when it feeds `adxBelowWeakThreshold` into a
 * trend label.
 */
export const DIRECTIONAL_FEATURES: readonly string[] = [
  'ema_distance', 'ema_slope', 'ema_separation', 'rsi_normalized',
  'macd_histogram_normalized', 'adx_normalized', 'bollinger_position',
  'sr_distance', 'swing_strength',
]

/**
 * Extracts every feature. Never throws: a failing feature becomes an
 * unavailable one.
 *
 * CONTRACT: `ctx.indicators`, `ctx.marketStructure` and `ctx.supportResistance`
 * must have been computed from `ctx.candles`. Several features read only the
 * precomputed results — `ema_separation`, `rsi_normalized`,
 * `macd_histogram_normalized`, `adx_normalized`, `bollinger_width` and
 * `volume_anomaly` never touch a candle — so a context assembled from mismatched
 * windows would have them reporting a measurement of one window while claiming
 * the support of another. `SignalEngine` builds the context from a single input
 * and cannot violate this; a caller assembling one by hand can.
 *
 * The empty window is the one case checked structurally rather than left to the
 * contract, because it is the case where the claim is not merely wrong but
 * meaningless: with no decision bar there is nothing to measure. Guarding it
 * here rather than in each feature means a feature added later cannot forget.
 */
export function extractFeatures(
  ctx: FeatureContext,
  specs: readonly FeatureSpec[] = DEFAULT_FEATURES,
): Record<string, FeatureValue> {
  const out: Record<string, FeatureValue> = {}
  if (ctx.candles.length === 0) {
    for (const spec of specs) out[spec.name] = unavailable('insufficient-history', NO_BARS)
    return out
  }
  for (const spec of specs) {
    try {
      out[spec.name] = spec.extract(ctx)
    } catch (e) {
      // A feature that throws must not take the pipeline down with it. The
      // failure is recorded as unavailability with the message attached, so it
      // surfaces in diagnostics rather than vanishing.
      out[spec.name] = unavailable('degenerate-input', `extraction threw: ${(e as Error).message}`)
    }
  }
  return out
}

/** The numeric view, for the scaler. */
export function toRawFeatures(values: Readonly<Record<string, FeatureValue>>): RawFeatures {
  const out: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(values)) out[k] = v.validity === 'ok' ? v.value : null
  return out
}
