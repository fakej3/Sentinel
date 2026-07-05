import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, ConfidenceBreakdown } from '../types'
import { normalize } from './score'

type BreakdownCategory = keyof Omit<ConfidenceBreakdown, 'contradictions'>

// Maps each canonical factor name to its evidence category.
// Exported so confluence and contradiction engines can reuse it without duplication.
export const FACTOR_CATEGORY: Readonly<Record<string, BreakdownCategory>> = {
  // ── Trend Quality (EMA positioning + alignment) ─────────────────────────────
  'Price above EMA200':        'trendQuality',
  'Price above EMA100':        'trendQuality',
  'Price above EMA50':         'trendQuality',
  'Price above EMA20':         'trendQuality',
  'Price below EMA200':        'trendQuality',
  'Price below EMA100':        'trendQuality',
  'Price below EMA50':         'trendQuality',
  'Price below EMA20':         'trendQuality',
  'EMA bullish alignment':     'trendQuality',
  'EMA bearish alignment':     'trendQuality',
  'EMA confluence zone':       'trendQuality',

  // ── Market Structure ─────────────────────────────────────────────────────────
  'Higher High confirmed':      'marketStructure',
  'Higher Low confirmed':       'marketStructure',
  'Lower High confirmed':       'marketStructure',
  'Lower Low confirmed':        'marketStructure',
  'Bullish BOS':                'marketStructure',
  'Bearish BOS':                'marketStructure',
  'Bullish CHoCH':              'marketStructure',
  'Bearish CHoCH':              'marketStructure',
  'Bullish breakout confirmed': 'marketStructure',
  'Bearish breakout confirmed': 'marketStructure',
  'Market in consolidation':    'marketStructure',
  'Failed breakout':            'marketStructure',
  'Active pullback':            'marketStructure',

  // ── Momentum (RSI, MACD, ADX, StochRSI, Bollinger) ──────────────────────────
  'RSI supports bullish':     'momentum',
  'RSI supports bearish':     'momentum',
  'RSI in 55–70 range': 'momentum',
  'RSI in 30–45 range': 'momentum',
  'Overbought RSI (>70)':     'momentum',
  'Oversold RSI (<30)':       'momentum',
  'Bullish RSI divergence':   'momentum',
  'Bearish RSI divergence':   'momentum',
  'MACD bullish bias':        'momentum',
  'MACD bearish bias':        'momentum',
  'ADX above 25':             'momentum',
  'ADX trend weak':           'momentum',
  'StochRSI oversold':        'momentum',
  'StochRSI overbought':      'momentum',
  'Price at Bollinger lower': 'momentum',
  'Price at Bollinger upper': 'momentum',

  // ── Volume ───────────────────────────────────────────────────────────────────
  'Strong volume confirmation':         'volume',
  'Strong bullish volume confirmation': 'volume',
  'Strong bearish volume confirmation': 'volume',
  'Below average volume on move':       'volume',
  'Accumulation detected':              'volume',
  'Distribution detected':             'volume',
  'Bullish OBV trend':                 'volume',
  'Bearish OBV trend':                 'volume',
  'OBV diverging from price':          'volume',
  'Volume climax selling':             'volume',
  'Volume climax buying':              'volume',
  'Price above VWAP':                  'volume',
  'Price below VWAP':                  'volume',
  'High relative volume':              'volume',
  'Low relative volume':               'volume',
  'Weak volume on breakout':           'volume',

  // ── Support / Resistance ─────────────────────────────────────────────────────
  'Price at active support':    'srPositioning',
  'Price at active resistance': 'srPositioning',
  'Strong support below':       'srPositioning',
  'Strong resistance above':    'srPositioning',
  'Active support zone':        'srPositioning',
  'Strong resistance overhead': 'srPositioning',
}

/**
 * Compute per-category evidence strength from the matched evidence items.
 * Each category score is normalized to 0–10 using the global divisor.
 * contradictionPoints is the opposing-side raw points total (used for the
 * 'contradictions' sub-score).
 */
export function computeBreakdown(
  evidence: readonly EvidenceItem[],
  cfg: ConfidenceConfig,
  contradictionPoints: number,
): ConfidenceBreakdown {
  const raw: Record<BreakdownCategory, number> = {
    trendQuality: 0,
    momentum: 0,
    volume: 0,
    marketStructure: 0,
    srPositioning: 0,
  }

  for (const item of evidence) {
    const weight = cfg.factorWeights[item.factor]
    if (weight === undefined) continue
    const category = FACTOR_CATEGORY[item.factor]
    if (category === undefined) continue
    raw[category] += Math.abs(weight)
  }

  return {
    trendQuality:    normalize(raw.trendQuality,    cfg.normalizationDivisor),
    momentum:        normalize(raw.momentum,        cfg.normalizationDivisor),
    volume:          normalize(raw.volume,          cfg.normalizationDivisor),
    marketStructure: normalize(raw.marketStructure, cfg.normalizationDivisor),
    srPositioning:   normalize(raw.srPositioning,   cfg.normalizationDivisor),
    contradictions:  normalize(contradictionPoints,  cfg.normalizationDivisor),
  }
}
