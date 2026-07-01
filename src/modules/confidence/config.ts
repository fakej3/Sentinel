import type { ConfidenceConfig } from './types'

/**
 * Default configuration for Module 8 — Confidence Engine.
 *
 * Factor weights use the canonical factor names from ENGINE_RULES.md §14.4.
 * Weights come from ENGINE_RULES.md §11 scoring table.
 *
 * Where §11 uses a slightly different name than §14.4's canonical table,
 * the §14.4 canonical name is used as the map key (e.g. "MACD bullish bias"
 * rather than §11's "Bullish MACD").
 *
 * Deferred factors (RSI divergence, StochRSI crossover) are included so the
 * engine picks them up automatically once future modules emit them.
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  factorWeights: {
    // ── Positive weights (ENGINE_RULES.md §11) ──────────────────────────────
    'Price above EMA200':        15,
    'Higher High confirmed':     15,
    'Higher Low confirmed':      15,
    'Bullish RSI divergence':    15, // deferred — not yet emitted by evidence engine
    'Strong volume confirmation':12,
    'MACD bullish bias':         10, // §11 calls this "Bullish MACD"
    'RSI in 55–70 range':         8,
    'ADX above 25':               8,
    'Price above EMA50':          7,
    'Bullish OBV trend':          6,
    'Price above EMA20':          5,
    'StochRSI oversold':          5, // §11 calls this "Bullish StochRSI crossover"

    // ── Negative weights (ENGINE_RULES.md §11) ──────────────────────────────
    'Bearish RSI divergence':   -20, // deferred — not yet emitted by evidence engine
    'Price below EMA200':       -15,
    'Lower High confirmed':     -15,
    'Lower Low confirmed':      -15,
    'Weak volume on breakout':  -12, // future breakout-specific volume signal
    'MACD bearish bias':        -10, // §11 calls this "Bearish MACD"
    'Strong resistance overhead':-10,
    'Overbought RSI (>70)':     -10,
    'RSI in 30–45 range':        -8,
    'Below average volume on move':-8,
  },

  normalizationDivisor: 10.6,

  warningScorePenalty: 0.5,

  criticalScoreCap: 3.0,

  gradeThresholds: {
    veryStrong: 8.5,
    strong:     7.0,
    moderate:   5.0,
    mixed:      3.0,
  },
}
