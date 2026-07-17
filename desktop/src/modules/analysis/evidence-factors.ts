/**
 * Canonical evidence factor names.
 *
 * Every string that evidence.ts emits as `EvidenceItem.factor` is declared here.
 * Both the evidence engine (compute/evidence.ts) and the confidence engine
 * (confidence/config.ts, confidence/compute/breakdown.ts) must import from this
 * module.  TypeScript enforces the contract: if evidence.ts emits a new factor
 * it must be added here, and the compiler will catch any weight or category entry
 * that refers to a name that no longer exists.
 */

// ── EMA position ──────────────────────────────────────────────────────────────
export const F_PRICE_ABOVE_EMA200       = 'Price above EMA200'       as const
export const F_PRICE_ABOVE_EMA100       = 'Price above EMA100'       as const
export const F_PRICE_ABOVE_EMA50        = 'Price above EMA50'        as const
export const F_PRICE_ABOVE_EMA20        = 'Price above EMA20'        as const
export const F_PRICE_BELOW_EMA200       = 'Price below EMA200'       as const
export const F_PRICE_BELOW_EMA100       = 'Price below EMA100'       as const
export const F_PRICE_BELOW_EMA50        = 'Price below EMA50'        as const
export const F_PRICE_BELOW_EMA20        = 'Price below EMA20'        as const
export const F_EMA_BULLISH_ALIGNMENT    = 'EMA bullish alignment'    as const
export const F_EMA_BEARISH_ALIGNMENT    = 'EMA bearish alignment'    as const
export const F_EMA_CONFLUENCE_ZONE      = 'EMA confluence zone'      as const

// ── Market structure ──────────────────────────────────────────────────────────
export const F_HIGHER_HIGH              = 'Higher High confirmed'      as const
export const F_HIGHER_LOW               = 'Higher Low confirmed'       as const
export const F_LOWER_HIGH               = 'Lower High confirmed'       as const
export const F_LOWER_LOW                = 'Lower Low confirmed'        as const
export const F_BULLISH_BOS              = 'Bullish BOS'               as const
export const F_BEARISH_BOS              = 'Bearish BOS'               as const
export const F_BULLISH_CHOCH            = 'Bullish CHoCH'             as const
export const F_BEARISH_CHOCH            = 'Bearish CHoCH'             as const
export const F_BULLISH_BREAKOUT         = 'Bullish breakout confirmed' as const
export const F_BEARISH_BREAKOUT         = 'Bearish breakout confirmed' as const
export const F_MARKET_CONSOLIDATION     = 'Market in consolidation'   as const
export const F_FAILED_BREAKOUT          = 'Failed breakout'           as const
export const F_ACTIVE_PULLBACK          = 'Active pullback'           as const

// ── RSI ───────────────────────────────────────────────────────────────────────
export const F_RSI_SUPPORTS_BULLISH     = 'RSI supports bullish'          as const
export const F_RSI_SUPPORTS_BEARISH     = 'RSI supports bearish'          as const
export const F_RSI_55_70                = 'RSI in 55–70 range'            as const
export const F_RSI_30_45                = 'RSI in 30–45 range'            as const
export const F_RSI_OVERBOUGHT           = 'Overbought RSI (>70)'          as const
export const F_RSI_OVERSOLD             = 'Oversold RSI (<30)'            as const
export const F_RSI_BULLISH_DIVERGENCE   = 'Bullish RSI divergence'        as const
export const F_RSI_BEARISH_DIVERGENCE   = 'Bearish RSI divergence'        as const
export const F_RSI_NEUTRAL              = 'RSI neutral'                   as const
export const F_RSI_NEUTRAL_OVERLAP      = 'RSI in neutral overlap zone'   as const

// ── MACD ──────────────────────────────────────────────────────────────────────
export const F_MACD_BULLISH             = 'MACD bullish bias'  as const
export const F_MACD_BEARISH             = 'MACD bearish bias'  as const

// ── ADX ───────────────────────────────────────────────────────────────────────
export const F_ADX_ABOVE_25             = 'ADX above 25'    as const
export const F_ADX_TREND_WEAK           = 'ADX trend weak'  as const

// ── Bollinger Bands ───────────────────────────────────────────────────────────
export const F_BOLLINGER_SQUEEZE        = 'Bollinger squeeze'            as const
export const F_BOLLINGER_EXPANSION      = 'Bollinger expansion'          as const
export const F_PRICE_AT_BOLLINGER_LOWER = 'Price at Bollinger lower'     as const
export const F_PRICE_AT_BOLLINGER_UPPER = 'Price at Bollinger upper'     as const

// ── StochRSI ──────────────────────────────────────────────────────────────────
export const F_STOCHRSI_OVERSOLD        = 'StochRSI oversold'   as const
export const F_STOCHRSI_OVERBOUGHT      = 'StochRSI overbought' as const

// ── Support / Resistance ──────────────────────────────────────────────────────
export const F_PRICE_AT_SUPPORT         = 'Price at active support'    as const
export const F_PRICE_AT_RESISTANCE      = 'Price at active resistance' as const
export const F_STRONG_SUPPORT_BELOW     = 'Strong support below'       as const
export const F_STRONG_RESISTANCE_ABOVE  = 'Strong resistance above'    as const
export const F_ACTIVE_SUPPORT_ZONE      = 'Active support zone'        as const
export const F_STRONG_RESISTANCE_OVERHEAD = 'Strong resistance overhead' as const

// ── Volume ────────────────────────────────────────────────────────────────────
export const F_STRONG_VOLUME            = 'Strong volume confirmation'          as const
export const F_STRONG_BULLISH_VOLUME    = 'Strong bullish volume confirmation'  as const
export const F_STRONG_BEARISH_VOLUME    = 'Strong bearish volume confirmation'  as const
export const F_BELOW_AVERAGE_VOLUME     = 'Below average volume on move'        as const
export const F_ACCUMULATION             = 'Accumulation detected'               as const
export const F_DISTRIBUTION             = 'Distribution detected'               as const
export const F_BULLISH_OBV              = 'Bullish OBV trend'                   as const
export const F_BEARISH_OBV              = 'Bearish OBV trend'                   as const
export const F_OBV_DIVERGING            = 'OBV diverging from price'            as const
export const F_OBV_DIVERGING_BULLISH    = 'OBV diverging from price (bullish)'  as const
export const F_VOLUME_CLIMAX_SELLING    = 'Volume climax selling'               as const
export const F_VOLUME_CLIMAX_BUYING     = 'Volume climax buying'                as const
export const F_VOLUME_EXHAUSTION        = 'Volume exhaustion'                   as const
export const F_PRICE_ABOVE_VWAP         = 'Price above VWAP'                   as const
export const F_PRICE_BELOW_VWAP         = 'Price below VWAP'                   as const
export const F_HIGH_RELATIVE_VOLUME     = 'High relative volume'                as const
export const F_LOW_RELATIVE_VOLUME      = 'Low relative volume'                 as const

// ── Deferred (pre-wired so weights apply automatically when emitted) ───────────
export const F_WEAK_VOLUME_ON_BREAKOUT  = 'Weak volume on breakout' as const

/**
 * Union of every valid evidence factor name.
 * Using this type in factorWeights and FACTOR_CATEGORY makes the compiler
 * fail if a weight or category entry refers to a name not in this list.
 */
export type EvidenceFactor =
  | typeof F_PRICE_ABOVE_EMA200
  | typeof F_PRICE_ABOVE_EMA100
  | typeof F_PRICE_ABOVE_EMA50
  | typeof F_PRICE_ABOVE_EMA20
  | typeof F_PRICE_BELOW_EMA200
  | typeof F_PRICE_BELOW_EMA100
  | typeof F_PRICE_BELOW_EMA50
  | typeof F_PRICE_BELOW_EMA20
  | typeof F_EMA_BULLISH_ALIGNMENT
  | typeof F_EMA_BEARISH_ALIGNMENT
  | typeof F_EMA_CONFLUENCE_ZONE
  | typeof F_HIGHER_HIGH
  | typeof F_HIGHER_LOW
  | typeof F_LOWER_HIGH
  | typeof F_LOWER_LOW
  | typeof F_BULLISH_BOS
  | typeof F_BEARISH_BOS
  | typeof F_BULLISH_CHOCH
  | typeof F_BEARISH_CHOCH
  | typeof F_BULLISH_BREAKOUT
  | typeof F_BEARISH_BREAKOUT
  | typeof F_MARKET_CONSOLIDATION
  | typeof F_FAILED_BREAKOUT
  | typeof F_ACTIVE_PULLBACK
  | typeof F_RSI_SUPPORTS_BULLISH
  | typeof F_RSI_SUPPORTS_BEARISH
  | typeof F_RSI_55_70
  | typeof F_RSI_30_45
  | typeof F_RSI_OVERBOUGHT
  | typeof F_RSI_OVERSOLD
  | typeof F_RSI_BULLISH_DIVERGENCE
  | typeof F_RSI_BEARISH_DIVERGENCE
  | typeof F_RSI_NEUTRAL
  | typeof F_RSI_NEUTRAL_OVERLAP
  | typeof F_MACD_BULLISH
  | typeof F_MACD_BEARISH
  | typeof F_ADX_ABOVE_25
  | typeof F_ADX_TREND_WEAK
  | typeof F_BOLLINGER_SQUEEZE
  | typeof F_BOLLINGER_EXPANSION
  | typeof F_PRICE_AT_BOLLINGER_LOWER
  | typeof F_PRICE_AT_BOLLINGER_UPPER
  | typeof F_STOCHRSI_OVERSOLD
  | typeof F_STOCHRSI_OVERBOUGHT
  | typeof F_PRICE_AT_SUPPORT
  | typeof F_PRICE_AT_RESISTANCE
  | typeof F_STRONG_SUPPORT_BELOW
  | typeof F_STRONG_RESISTANCE_ABOVE
  | typeof F_ACTIVE_SUPPORT_ZONE
  | typeof F_STRONG_RESISTANCE_OVERHEAD
  | typeof F_STRONG_VOLUME
  | typeof F_STRONG_BULLISH_VOLUME
  | typeof F_STRONG_BEARISH_VOLUME
  | typeof F_BELOW_AVERAGE_VOLUME
  | typeof F_ACCUMULATION
  | typeof F_DISTRIBUTION
  | typeof F_BULLISH_OBV
  | typeof F_BEARISH_OBV
  | typeof F_OBV_DIVERGING
  | typeof F_OBV_DIVERGING_BULLISH
  | typeof F_VOLUME_CLIMAX_SELLING
  | typeof F_VOLUME_CLIMAX_BUYING
  | typeof F_VOLUME_EXHAUSTION
  | typeof F_PRICE_ABOVE_VWAP
  | typeof F_PRICE_BELOW_VWAP
  | typeof F_HIGH_RELATIVE_VOLUME
  | typeof F_LOW_RELATIVE_VOLUME
  | typeof F_WEAK_VOLUME_ON_BREAKOUT
