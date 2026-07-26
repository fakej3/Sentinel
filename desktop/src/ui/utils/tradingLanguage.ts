/**
 * Translates internal engine field values into natural trading language for display.
 * Never changes data — only presentation strings.
 */
import type { VWAPAnalysisResult, VwapSide } from '../../modules/volume-analysis/types'

export function trendLabel(trend: string): string {
  switch (trend) {
    case 'strong bullish':   return 'Strong Uptrend'
    case 'moderate bullish': return 'Uptrend'
    case 'weak bullish':     return 'Weak Uptrend'
    case 'ranging':          return 'Sideways / Ranging'
    case 'weak bearish':     return 'Weak Downtrend'
    case 'moderate bearish': return 'Downtrend'
    case 'strong bearish':   return 'Strong Downtrend'
    default:                 return trend.replace(/_/g, ' ')
  }
}

export function rsiLabel(classification: string, rsi: number | null): string {
  if (rsi === null) return 'RSI unavailable'
  switch (classification) {
    case 'overbought':      return `RSI ${rsi.toFixed(0)} — overbought, momentum may be fading`
    case 'healthy_bullish': return `RSI ${rsi.toFixed(0)} — momentum favors bulls`
    case 'neutral':         return `RSI ${rsi.toFixed(0)} — neutral momentum`
    case 'weak_bearish':    return `RSI ${rsi.toFixed(0)} — momentum leans bearish`
    case 'oversold':        return `RSI ${rsi.toFixed(0)} — oversold, potential bounce zone`
    case 'unavailable':     return 'RSI unavailable'
    default:                return `RSI ${rsi.toFixed(0)} — ${classification.replace(/_/g, ' ')}`
  }
}

export function volumeLabel(classification: string, relVol: number): string {
  const relStr = `${relVol.toFixed(1)}× average`
  switch (classification) {
    case 'very_high': return `Very high volume (${relStr}) — strong conviction`
    case 'high':      return `High volume (${relStr}) — above-average participation`
    case 'normal':    return `Normal volume (${relStr}) — typical activity`
    case 'low':       return `Low volume (${relStr}) — weak participation`
    case 'very_low':  return `Very low volume (${relStr}) — minimal activity`
    default:          return `${classification.replace(/_/g, ' ')} volume (${relStr})`
  }
}

/**
 * Shown wherever a VWAP-derived number would go when there is no session VWAP.
 * A single shared token so "unavailable" never renders as a plausible value.
 */
export const VWAP_NA = '—'

export function vwapLabel(vwap: VWAPAnalysisResult): string {
  if (!vwap.available) return `VWAP unavailable — ${vwap.unavailable.detail}`
  if (vwap.side === 'at') return 'Price is exactly at VWAP'
  // Math.abs: distancePercent is negative below VWAP, and the old code printed
  // it raw, producing "-1.20% below VWAP" — a double negative.
  const dist = Math.abs(vwap.distancePercent).toFixed(2)
  return vwap.side === 'above'
    ? `Price is ${dist}% above VWAP — intraday bias is bullish`
    : `Price is ${dist}% below VWAP — intraday bias is bearish`
}

/**
 * Text colour for a VWAP side. `'at'` and "no VWAP" both take the muted tone:
 * neither is directional, and the previous `above ? green : red` binary painted
 * both of them red, i.e. bearish.
 */
export function vwapSideClass(side: VwapSide | null): string {
  if (side === 'above') return 'text-emerald-400'
  if (side === 'below') return 'text-red-400'
  return 'text-slate-500'
}

/** Dot fill matching `vwapSideClass`, for the summary bullet list. */
export function vwapDotClass(side: VwapSide | null): string {
  if (side === 'above') return 'bg-emerald-400'
  if (side === 'below') return 'bg-red-400'
  return 'bg-slate-500'
}

/** `distancePercent` formatted, or the unavailable token. */
export function vwapDistanceLabel(vwap: VWAPAnalysisResult): string {
  return vwap.available ? `${vwap.distancePercent.toFixed(2)}%` : VWAP_NA
}

/** One-word position label: Above / Below / At, or the unavailable token. */
export function vwapPositionLabel(vwap: VWAPAnalysisResult): string {
  if (!vwap.available) return VWAP_NA
  return vwap.side === 'above' ? 'Above' : vwap.side === 'below' ? 'Below' : 'At'
}

export function emaAlignmentLabel(alignment: string): string {
  switch (alignment) {
    case 'bullish_stack': return 'EMAs stacked bullishly (20 > 50 > 100 > 200)'
    case 'bearish_stack': return 'EMAs stacked bearishly (20 < 50 < 100 < 200)'
    case 'mixed':         return 'EMAs mixed — no clear stack alignment'
    default:              return alignment.replace(/_/g, ' ')
  }
}

export function gradeLabel(grade: string): string {
  switch (grade) {
    case 'very_strong': return 'Very Strong Signal'
    case 'strong':      return 'Strong Signal'
    case 'moderate':    return 'Moderate Signal'
    case 'mixed':       return 'Mixed Signal'
    case 'weak':        return 'Weak Signal'
    default:            return grade.replace(/_/g, ' ')
  }
}

export function biasLabel(trend: string, confidence: number): string {
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')
  const strength = confidence >= 8 ? 'very strong' : confidence >= 6.5 ? 'strong' : confidence >= 5 ? 'moderate' : 'weak'

  if (isBullish) return `${strength.charAt(0).toUpperCase() + strength.slice(1)} bullish bias`
  if (isBearish) return `${strength.charAt(0).toUpperCase() + strength.slice(1)} bearish bias`
  return 'Neutral — no clear directional bias'
}
