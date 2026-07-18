import type { ConfidenceConfig } from './types'
import type { EvidenceFactor } from '../analysis/evidence-factors'
import {
  F_PRICE_ABOVE_EMA200, F_PRICE_ABOVE_EMA100, F_PRICE_ABOVE_EMA50, F_PRICE_ABOVE_EMA20,
  F_PRICE_BELOW_EMA200, F_PRICE_BELOW_EMA100, F_PRICE_BELOW_EMA50, F_PRICE_BELOW_EMA20,
  F_EMA_BULLISH_ALIGNMENT, F_EMA_BEARISH_ALIGNMENT, F_EMA_CONFLUENCE_ZONE,
  F_HIGHER_HIGH, F_HIGHER_LOW, F_LOWER_HIGH, F_LOWER_LOW,
  F_BULLISH_BOS, F_BEARISH_BOS, F_BULLISH_CHOCH, F_BEARISH_CHOCH,
  F_BULLISH_BREAKOUT, F_BEARISH_BREAKOUT, F_MARKET_CONSOLIDATION, F_FAILED_BREAKOUT, F_ACTIVE_PULLBACK,
  F_RSI_SUPPORTS_BULLISH, F_RSI_SUPPORTS_BEARISH,
  F_RSI_55_70, F_RSI_30_45,
  F_RSI_OVERBOUGHT, F_RSI_OVERSOLD,
  F_RSI_BULLISH_DIVERGENCE, F_RSI_BEARISH_DIVERGENCE,
  F_RSI_NEUTRAL, F_RSI_NEUTRAL_OVERLAP,
  F_MACD_BULLISH, F_MACD_BEARISH,
  F_ADX_ABOVE_25, F_ADX_TREND_WEAK,
  F_BOLLINGER_SQUEEZE, F_BOLLINGER_EXPANSION, F_PRICE_AT_BOLLINGER_LOWER, F_PRICE_AT_BOLLINGER_UPPER,
  F_STOCHRSI_OVERSOLD, F_STOCHRSI_OVERBOUGHT,
  F_PRICE_AT_SUPPORT, F_PRICE_AT_RESISTANCE, F_STRONG_SUPPORT_BELOW, F_STRONG_RESISTANCE_ABOVE,
  F_ACTIVE_SUPPORT_ZONE, F_STRONG_RESISTANCE_OVERHEAD,
  F_STRONG_VOLUME, F_STRONG_BULLISH_VOLUME, F_STRONG_BEARISH_VOLUME, F_BELOW_AVERAGE_VOLUME,
  F_ACCUMULATION, F_DISTRIBUTION,
  F_BULLISH_OBV, F_BEARISH_OBV, F_OBV_DIVERGING, F_OBV_DIVERGING_BULLISH,
  F_VOLUME_CLIMAX_SELLING, F_VOLUME_CLIMAX_BUYING, F_VOLUME_EXHAUSTION,
  F_PRICE_ABOVE_VWAP, F_PRICE_BELOW_VWAP, F_HIGH_RELATIVE_VOLUME, F_LOW_RELATIVE_VOLUME,
  F_WEAK_VOLUME_ON_BREAKOUT,
} from '../analysis/evidence-factors'

/**
 * Default configuration for Module 8 — Confidence Engine.
 *
 * Factor weights use the canonical factor constants from analysis/evidence-factors.ts.
 * The `satisfies Record<EvidenceFactor, number>` annotation ensures every factor in
 * the EvidenceFactor union has a weight here — the compiler will fail if a new factor
 * is added to the union without a corresponding entry in this map.
 *
 * Weight philosophy:
 *   High-impact evidence     → |10–15|
 *   Medium-impact evidence   → |5–10|
 *   Low-impact evidence      → |2–5|
 *   Neutral confirmatory     → |2–8| (positive, e.g. ADX)
 *
 * Deferred factors (RSI divergence, StochRSI crossover, Weak volume on breakout)
 * are pre-wired so the engine picks them up automatically when future modules
 * begin emitting them.
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  factorWeights: {
    // ── EMA position ─────────────────────────────────────────────────────────
    [F_PRICE_ABOVE_EMA200]:         15,
    [F_PRICE_ABOVE_EMA100]:         10,
    [F_PRICE_ABOVE_EMA50]:           7,
    [F_PRICE_ABOVE_EMA20]:           5,
    [F_PRICE_BELOW_EMA200]:        -15,
    [F_PRICE_BELOW_EMA100]:        -10,
    [F_PRICE_BELOW_EMA50]:          -7,
    [F_PRICE_BELOW_EMA20]:          -5,

    // ── EMA alignment ────────────────────────────────────────────────────────
    [F_EMA_BULLISH_ALIGNMENT]:      12,
    [F_EMA_BEARISH_ALIGNMENT]:     -12,
    [F_EMA_CONFLUENCE_ZONE]:         2,

    // ── Market structure ─────────────────────────────────────────────────────
    [F_HIGHER_HIGH]:                15,
    [F_HIGHER_LOW]:                 15,
    [F_LOWER_HIGH]:                -15,
    [F_LOWER_LOW]:                 -15,
    [F_BULLISH_BOS]:                10,
    [F_BEARISH_BOS]:               -10,
    [F_BULLISH_CHOCH]:               8,
    [F_BEARISH_CHOCH]:              -8,
    [F_BULLISH_BREAKOUT]:           10,
    [F_BEARISH_BREAKOUT]:          -10,
    [F_MARKET_CONSOLIDATION]:       -3,
    [F_FAILED_BREAKOUT]:            -5,
    [F_ACTIVE_PULLBACK]:            -3,

    // ── RSI ──────────────────────────────────────────────────────────────────
    [F_RSI_SUPPORTS_BULLISH]:        7,
    [F_RSI_SUPPORTS_BEARISH]:       -7,
    [F_RSI_55_70]:                   8,  // pre-wired: evidence.ts currently emits F_RSI_SUPPORTS_BULLISH instead
    [F_RSI_30_45]:                  -8,  // pre-wired: evidence.ts currently emits F_RSI_SUPPORTS_BEARISH instead
    [F_RSI_OVERBOUGHT]:            -10,
    [F_RSI_OVERSOLD]:                8,
    [F_RSI_BULLISH_DIVERGENCE]:     15,  // deferred
    [F_RSI_BEARISH_DIVERGENCE]:    -20,  // deferred
    [F_RSI_NEUTRAL]:                 1,
    [F_RSI_NEUTRAL_OVERLAP]:         1,

    // ── MACD ─────────────────────────────────────────────────────────────────
    [F_MACD_BULLISH]:               10,
    [F_MACD_BEARISH]:              -10,

    // ── ADX ──────────────────────────────────────────────────────────────────
    [F_ADX_ABOVE_25]:                8,
    [F_ADX_TREND_WEAK]:             -4,

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    [F_BOLLINGER_SQUEEZE]:           3,
    [F_BOLLINGER_EXPANSION]:         4,
    [F_PRICE_AT_BOLLINGER_LOWER]:    5,
    [F_PRICE_AT_BOLLINGER_UPPER]:   -5,

    // ── StochRSI ─────────────────────────────────────────────────────────────
    [F_STOCHRSI_OVERSOLD]:           5,
    [F_STOCHRSI_OVERBOUGHT]:        -4,

    // ── Support / Resistance ─────────────────────────────────────────────────
    [F_PRICE_AT_SUPPORT]:           10,
    [F_PRICE_AT_RESISTANCE]:       -10,
    [F_STRONG_SUPPORT_BELOW]:        5,
    [F_STRONG_RESISTANCE_ABOVE]:    -8,
    [F_ACTIVE_SUPPORT_ZONE]:         3,
    [F_STRONG_RESISTANCE_OVERHEAD]:  -5,

    // ── Volume ───────────────────────────────────────────────────────────────
    [F_STRONG_VOLUME]:              12,
    [F_STRONG_BULLISH_VOLUME]:      12,
    [F_STRONG_BEARISH_VOLUME]:     -12,
    [F_BELOW_AVERAGE_VOLUME]:       -8,
    [F_ACCUMULATION]:               10,
    [F_DISTRIBUTION]:              -10,
    [F_BULLISH_OBV]:                 6,
    [F_BEARISH_OBV]:                -6,
    [F_OBV_DIVERGING]:              -5,
    [F_OBV_DIVERGING_BULLISH]:       5,
    [F_VOLUME_CLIMAX_SELLING]:       6,
    [F_VOLUME_CLIMAX_BUYING]:       -6,
    [F_VOLUME_EXHAUSTION]:          -2,
    [F_PRICE_ABOVE_VWAP]:            4,
    [F_PRICE_BELOW_VWAP]:           -4,
    [F_HIGH_RELATIVE_VOLUME]:        3,
    [F_LOW_RELATIVE_VOLUME]:        -3,

    // ── Deferred ─────────────────────────────────────────────────────────────
    [F_WEAK_VOLUME_ON_BREAKOUT]:   -12,
  } satisfies Record<EvidenceFactor, number>,

  normalizationDivisor: 10,

  warningScorePenalty: 0.5,

  criticalScoreCap: 3.0,

  gradeThresholds: {
    veryStrong: 8.5,
    strong:     7.0,
    moderate:   5.0,
    mixed:      3.0,
  },

  contradictionPenaltyFactor: 0.3,

  neutralStrengthFactor: 0.5,

  overconfidenceThreshold: 8.0,

  trustPenaltyLow: 1.6,

  trustPenaltyMedium: 0.75,
}
