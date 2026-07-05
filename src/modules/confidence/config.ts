import type { ConfidenceConfig } from './types'

/**
 * Default configuration for Module 8 — Confidence Engine.
 *
 * Factor weights use the canonical factor names emitted by evidence.ts.
 * Divisor = 10: a realistic "very strong" market scores ≥ 100 raw points
 * and saturates at score 10.0 naturally.
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
    'Price above EMA200':         15,
    'Price above EMA100':         10,
    'Price above EMA50':           7,
    'Price above EMA20':           5,
    'Price below EMA200':        -15,
    'Price below EMA100':        -10,
    'Price below EMA50':          -7,
    'Price below EMA20':          -5,

    // ── EMA alignment ────────────────────────────────────────────────────────
    'EMA bullish alignment':      12,
    'EMA bearish alignment':     -12,

    // ── Market structure ─────────────────────────────────────────────────────
    'Higher High confirmed':      15,
    'Higher Low confirmed':       15,
    'Lower High confirmed':      -15,
    'Lower Low confirmed':       -15,
    'Bullish BOS':                10,
    'Bearish BOS':               -10,
    'Bullish CHoCH':               8,
    'Bearish CHoCH':              -8,
    'Bullish breakout confirmed':  10,
    'Bearish breakout confirmed': -10,
    'Market in consolidation':    -3,
    'Failed breakout':            -5,
    'Active pullback':            -3,

    // ── RSI ──────────────────────────────────────────────────────────────────
    'RSI supports bullish':        7,
    'RSI supports bearish':       -7,
    'RSI in 55–70 range':          8,
    'RSI in 30–45 range':         -8,
    'Overbought RSI (>70)':      -10,
    'Oversold RSI (<30)':          8,
    'Bullish RSI divergence':     15,  // deferred
    'Bearish RSI divergence':    -20,  // deferred

    // ── MACD ─────────────────────────────────────────────────────────────────
    'MACD bullish bias':          10,
    'MACD bearish bias':         -10,

    // ── ADX ──────────────────────────────────────────────────────────────────
    'ADX above 25':                8,
    'ADX trend weak':             -4,

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    'Price at Bollinger lower':    5,
    'Price at Bollinger upper':   -5,

    // ── StochRSI ─────────────────────────────────────────────────────────────
    'StochRSI oversold':           5,
    'StochRSI overbought':        -4,

    // ── Support / Resistance ─────────────────────────────────────────────────
    'Price at active support':    10,
    'Price at active resistance': -10,
    'Strong support below':        5,
    'Strong resistance above':    -8,
    'Active support zone':         3,
    'Strong resistance overhead':  -5,

    // ── Volume ───────────────────────────────────────────────────────────────
    'Strong volume confirmation':  12,   // neutral / ranging markets
    'Strong bullish volume confirmation': 12,  // volume confirms bullish move
    'Strong bearish volume confirmation': -12, // volume confirms bearish move
    'Below average volume on move':-8,
    'Accumulation detected':       10,
    'Distribution detected':      -10,
    'Bullish OBV trend':            6,
    'Bearish OBV trend':           -6,
    'OBV diverging from price':    -5,
    'Volume climax selling':        6,  // selling exhaustion = bullish reversal cue
    'Volume climax buying':        -6,  // buying exhaustion = bearish reversal cue
    'Price above VWAP':             4,
    'Price below VWAP':            -4,
    'High relative volume':         3,
    'Low relative volume':         -3,

    // ── Deferred ─────────────────────────────────────────────────────────────
    'Weak volume on breakout':    -12,  // future breakout-volume module
  },

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
}
