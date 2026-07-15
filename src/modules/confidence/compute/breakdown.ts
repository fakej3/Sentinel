import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, ConfidenceBreakdown } from '../types'
import type { EvidenceFactor } from '../../analysis/evidence-factors'
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
} from '../../analysis/evidence-factors'
import { normalize } from './score'

type BreakdownCategory = keyof Omit<ConfidenceBreakdown, 'contradictions'>

// Maps each canonical factor name to its evidence category.
// Exported so confluence and contradiction engines can reuse it without duplication.
// Typed as Partial<Record<EvidenceFactor, ...>>: deferred factors that do not yet belong
// to a display category are simply absent and will not contribute to breakdown scores.
export const FACTOR_CATEGORY: Readonly<Partial<Record<EvidenceFactor, BreakdownCategory>>> = {
  // ── Trend Quality (EMA positioning + alignment) ─────────────────────────────
  [F_PRICE_ABOVE_EMA200]:        'trendQuality',
  [F_PRICE_ABOVE_EMA100]:        'trendQuality',
  [F_PRICE_ABOVE_EMA50]:         'trendQuality',
  [F_PRICE_ABOVE_EMA20]:         'trendQuality',
  [F_PRICE_BELOW_EMA200]:        'trendQuality',
  [F_PRICE_BELOW_EMA100]:        'trendQuality',
  [F_PRICE_BELOW_EMA50]:         'trendQuality',
  [F_PRICE_BELOW_EMA20]:         'trendQuality',
  [F_EMA_BULLISH_ALIGNMENT]:     'trendQuality',
  [F_EMA_BEARISH_ALIGNMENT]:     'trendQuality',
  [F_EMA_CONFLUENCE_ZONE]:       'trendQuality',

  // ── Market Structure ─────────────────────────────────────────────────────────
  [F_HIGHER_HIGH]:               'marketStructure',
  [F_HIGHER_LOW]:                'marketStructure',
  [F_LOWER_HIGH]:                'marketStructure',
  [F_LOWER_LOW]:                 'marketStructure',
  [F_BULLISH_BOS]:               'marketStructure',
  [F_BEARISH_BOS]:               'marketStructure',
  [F_BULLISH_CHOCH]:             'marketStructure',
  [F_BEARISH_CHOCH]:             'marketStructure',
  [F_BULLISH_BREAKOUT]:          'marketStructure',
  [F_BEARISH_BREAKOUT]:          'marketStructure',
  [F_MARKET_CONSOLIDATION]:      'marketStructure',
  [F_FAILED_BREAKOUT]:           'marketStructure',
  [F_ACTIVE_PULLBACK]:           'marketStructure',

  // ── Momentum (RSI, MACD, ADX, StochRSI, Bollinger) ──────────────────────────
  [F_RSI_SUPPORTS_BULLISH]:      'momentum',
  [F_RSI_SUPPORTS_BEARISH]:      'momentum',
  [F_RSI_55_70]:                 'momentum',
  [F_RSI_30_45]:                 'momentum',
  [F_RSI_OVERBOUGHT]:            'momentum',
  [F_RSI_OVERSOLD]:              'momentum',
  [F_RSI_BULLISH_DIVERGENCE]:    'momentum',
  [F_RSI_BEARISH_DIVERGENCE]:    'momentum',
  [F_RSI_NEUTRAL]:               'momentum',
  [F_RSI_NEUTRAL_OVERLAP]:       'momentum',
  [F_MACD_BULLISH]:              'momentum',
  [F_MACD_BEARISH]:              'momentum',
  [F_ADX_ABOVE_25]:              'momentum',
  [F_ADX_TREND_WEAK]:            'momentum',
  [F_STOCHRSI_OVERSOLD]:         'momentum',
  [F_STOCHRSI_OVERBOUGHT]:       'momentum',
  [F_PRICE_AT_BOLLINGER_LOWER]:  'momentum',
  [F_PRICE_AT_BOLLINGER_UPPER]:  'momentum',
  [F_BOLLINGER_SQUEEZE]:         'momentum',
  [F_BOLLINGER_EXPANSION]:       'momentum',

  // ── Volume ───────────────────────────────────────────────────────────────────
  [F_STRONG_VOLUME]:             'volume',
  [F_STRONG_BULLISH_VOLUME]:     'volume',
  [F_STRONG_BEARISH_VOLUME]:     'volume',
  [F_BELOW_AVERAGE_VOLUME]:      'volume',
  [F_ACCUMULATION]:              'volume',
  [F_DISTRIBUTION]:              'volume',
  [F_BULLISH_OBV]:               'volume',
  [F_BEARISH_OBV]:               'volume',
  [F_OBV_DIVERGING]:             'volume',
  [F_OBV_DIVERGING_BULLISH]:     'volume',
  [F_VOLUME_CLIMAX_SELLING]:     'volume',
  [F_VOLUME_CLIMAX_BUYING]:      'volume',
  [F_VOLUME_EXHAUSTION]:         'volume',
  [F_PRICE_ABOVE_VWAP]:          'volume',
  [F_PRICE_BELOW_VWAP]:          'volume',
  [F_HIGH_RELATIVE_VOLUME]:      'volume',
  [F_LOW_RELATIVE_VOLUME]:       'volume',

  // ── Support / Resistance ─────────────────────────────────────────────────────
  [F_PRICE_AT_SUPPORT]:          'srPositioning',
  [F_PRICE_AT_RESISTANCE]:       'srPositioning',
  [F_STRONG_SUPPORT_BELOW]:      'srPositioning',
  [F_STRONG_RESISTANCE_ABOVE]:   'srPositioning',
  [F_ACTIVE_SUPPORT_ZONE]:       'srPositioning',
  [F_STRONG_RESISTANCE_OVERHEAD]: 'srPositioning',

  // Deferred factors (Weak volume on breakout, RSI divergence) have weights
  // but are not yet assigned to a breakdown category.
} satisfies Partial<Record<EvidenceFactor, BreakdownCategory>>

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
    if (weight === undefined || !Number.isFinite(weight)) continue
    const category = FACTOR_CATEGORY[item.factor as EvidenceFactor]
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
