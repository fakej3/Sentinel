/**
 * Translates internal engine field values into natural trading language for display.
 * Never changes data — only presentation strings.
 */

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

export function macdLabel(bias: string, histogram?: number | null): string {
  const histNote = histogram !== undefined && histogram !== null
    ? ` (histogram ${histogram > 0 ? '+' : ''}${histogram.toFixed(4)})`
    : ''
  switch (bias) {
    case 'bullish':    return `MACD crossing up — bullish momentum building${histNote}`
    case 'bearish':    return `MACD crossing down — bearish momentum building${histNote}`
    case 'neutral':    return `MACD near zero — no clear directional momentum${histNote}`
    default:           return `MACD ${bias}${histNote}`
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

export function vwapLabel(above: boolean, distPct: number): string {
  const dist = distPct.toFixed(2)
  return above
    ? `Price is ${dist}% above VWAP — intraday bias is bullish`
    : `Price is ${dist}% below VWAP — intraday bias is bearish`
}

export function emaAlignmentLabel(alignment: string): string {
  switch (alignment) {
    case 'bullish_stack': return 'EMAs stacked bullishly (20 > 50 > 100 > 200)'
    case 'bearish_stack': return 'EMAs stacked bearishly (20 < 50 < 100 < 200)'
    case 'mixed':         return 'EMAs mixed — no clear stack alignment'
    default:              return alignment.replace(/_/g, ' ')
  }
}

export function structureLabel(trend: string, strength: string): string {
  const t = trend === 'uptrend' ? 'Higher highs and higher lows'
    : trend === 'downtrend' ? 'Lower highs and lower lows'
    : 'Ranging structure'
  return `${t} — ${strength} structure`
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
