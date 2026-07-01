import type {
  MarketAnalysisResult,
  FullTrendLabel,
  RSIClassification,
  ADXTrendStrength,
  EMAAlignmentState,
  BollingerBandwidthState,
  ClimaxSignalType,
} from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceResult, ConfidenceGrade } from '../confidence/types'
import type { WriterConfig } from './types'

// ─── Wording helpers ──────────────────────────────────────────────────────────

function trendLabel(trend: FullTrendLabel): string {
  const map: Record<FullTrendLabel, string> = {
    'strong bullish': 'strong bullish',
    'moderate bullish': 'moderate bullish',
    'weak bullish': 'weak bullish',
    'ranging': 'ranging (no clear trend)',
    'weak bearish': 'weak bearish',
    'moderate bearish': 'moderate bearish',
    'strong bearish': 'strong bearish',
  }
  return map[trend]
}

function trendDirectionWord(trend: FullTrendLabel): string {
  if (trend.includes('bullish')) return 'bullish'
  if (trend.includes('bearish')) return 'bearish'
  return 'neutral'
}

function gradeOpeningPhrase(grade: ConfidenceGrade): string {
  const map: Record<ConfidenceGrade, string> = {
    very_strong: 'The available evidence strongly supports',
    strong: 'The current evidence supports',
    moderate: 'The current signals suggest',
    mixed: 'The current signals are mixed, with indications of',
    weak: 'The available evidence is limited, with tentative indications of',
  }
  return map[grade]
}

function gradeHedge(grade: ConfidenceGrade): string {
  const map: Record<ConfidenceGrade, string> = {
    very_strong: 'with high conviction',
    strong: 'with reasonable conviction',
    moderate: 'with moderate confidence',
    mixed: 'though the picture remains mixed',
    weak: 'though confidence is low',
  }
  return map[grade]
}

function rsiLabel(classification: RSIClassification): string {
  const map: Record<RSIClassification, string> = {
    oversold: 'oversold territory',
    weak_bearish: 'the weak-bearish zone',
    neutral: 'neutral territory',
    healthy_bullish: 'the healthy-bullish zone',
    overbought: 'overbought territory',
    unavailable: 'an indeterminate level',
  }
  return map[classification]
}

function adxStrengthLabel(strength: ADXTrendStrength): string {
  const map: Record<ADXTrendStrength, string> = {
    weak: 'no strong trend',
    emerging: 'an emerging trend',
    strong: 'a strong trend',
    very_strong: 'a very strong trend',
    extreme: 'an extreme trend',
    unavailable: 'undetermined trend strength',
  }
  return map[strength]
}

function emaAlignmentLabel(alignment: EMAAlignmentState): string {
  const map: Record<EMAAlignmentState, string> = {
    bullish_stack: 'in full bullish alignment (EMA20 > EMA50 > EMA100 > EMA200)',
    bearish_stack: 'in full bearish alignment (EMA20 < EMA50 < EMA100 < EMA200)',
    mixed: 'in mixed alignment without a clear stack',
    unavailable: 'unavailable (insufficient data)',
  }
  return map[alignment]
}

function bandwidthStateLabel(state: BollingerBandwidthState | 'unavailable'): string {
  const map: Record<BollingerBandwidthState | 'unavailable', string> = {
    squeeze: 'in a squeeze (low volatility)',
    normal: 'at normal width',
    expansion: 'expanding (rising volatility)',
    unavailable: 'unavailable',
  }
  return map[state]
}

function climaxLabel(signal: ClimaxSignalType): string {
  const map: Record<ClimaxSignalType, string> = {
    buying_climax: 'a potential buying climax',
    selling_climax: 'a potential selling climax',
    exhaustion: 'volume exhaustion',
    none: '',
  }
  return map[signal]
}

function formatPrice(price: number): string {
  if (price >= 10000) return price.toFixed(0)
  if (price >= 100) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const cutAt = text.lastIndexOf(' ', maxLen - 3)
  return text.slice(0, cutAt > 0 ? cutAt : maxLen - 3) + '...'
}

// ─── Headline ─────────────────────────────────────────────────────────────────

export function buildHeadline(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
): string {
  const { symbol, timeframe, fullTrend, price } = analysis
  const trendStr = trendLabel(fullTrend.trend)
  const scoreStr = confidence.score.toFixed(1)
  const priceStr = formatPrice(price.current)
  return `${symbol} ${timeframe}: ${trendStr} — Confidence ${scoreStr}/10 @ ${priceStr}`
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function buildSummary(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  cfg: WriterConfig,
): string {
  const { fullTrend, price, indicatorSummary, volumeContext } = analysis
  const direction = trendDirectionWord(fullTrend.trend)
  const opener = gradeOpeningPhrase(confidence.grade)
  const hedge = gradeHedge(confidence.grade)

  const rsiPart =
    indicatorSummary.rsi.value !== null
      ? ` RSI at ${indicatorSummary.rsi.value.toFixed(1)} is in ${rsiLabel(indicatorSummary.rsi.classification)}.`
      : ''

  const volumePart = volumeContext.confirmsCurrentMove
    ? ' Volume is confirming the current move.'
    : ' Volume is not confirming the current move.'

  const text =
    `${opener} a ${trendLabel(fullTrend.trend)} setup, ${hedge}.` +
    ` The 24-hour price change is ${formatPercent(price.change24hPercent)}.` +
    rsiPart +
    volumePart +
    ` Overall market bias is ${direction}.`

  return truncate(text, cfg.maxSummaryLength)
}

// ─── Trend Section ────────────────────────────────────────────────────────────

export function buildTrendSection(analysis: MarketAnalysisResult): string {
  const { fullTrend, emaContext, price } = analysis
  const { trend, bullishConditionsMet, bearishConditionsMet, neutralConditionsMet } = fullTrend

  const lines: string[] = []

  lines.push(
    `Trend: ${trendLabel(trend)} (${bullishConditionsMet}/5 bullish, ${bearishConditionsMet}/5 bearish, ${neutralConditionsMet}/4 neutral conditions met).`,
  )

  lines.push(`EMA alignment is ${emaAlignmentLabel(emaContext.emaAlignment)}.`)

  const emaLabels: string[] = []
  if (emaContext.priceVsEMA20 !== 'unavailable')
    emaLabels.push(`EMA20: price is ${emaContext.priceVsEMA20}`)
  if (emaContext.priceVsEMA50 !== 'unavailable')
    emaLabels.push(`EMA50: price is ${emaContext.priceVsEMA50}`)
  if (emaContext.priceVsEMA100 !== 'unavailable')
    emaLabels.push(`EMA100: price is ${emaContext.priceVsEMA100}`)
  if (emaContext.priceVsEMA200 !== 'unavailable')
    emaLabels.push(`EMA200: price is ${emaContext.priceVsEMA200}`)

  if (emaLabels.length > 0) {
    lines.push(emaLabels.join('; ') + '.')
  }

  if (emaContext.confluenceZones.length > 0) {
    const zone = emaContext.confluenceZones[0]
    lines.push(
      `EMA confluence zone detected around ${formatPrice(zone.centerPrice)} (EMA${zone.emaPeriods.join('/')}).`,
    )
  }

  if (price.atrPercent !== null) {
    lines.push(`ATR is ${price.atrPercent.toFixed(2)}% of price.`)
  }

  return lines.join(' ')
}

// ─── Indicator Section ────────────────────────────────────────────────────────

export function buildIndicatorSection(analysis: MarketAnalysisResult): string {
  const { indicatorSummary } = analysis
  const { rsi, macd, adx, bollinger, stochRsi } = indicatorSummary

  const lines: string[] = []

  // RSI
  if (rsi.value !== null) {
    lines.push(`RSI: ${rsi.value.toFixed(1)} (${rsiLabel(rsi.classification)}).`)
  } else {
    lines.push('RSI: unavailable.')
  }

  // MACD
  if (macd.histogram !== null) {
    const histSign = macd.histogram > 0 ? 'positive' : macd.histogram < 0 ? 'negative' : 'flat'
    lines.push(
      `MACD bias is ${macd.bias} with a ${histSign} histogram (${macd.histogram.toFixed(4)}).`,
    )
  } else {
    lines.push('MACD: unavailable.')
  }

  // ADX
  if (adx.adx !== null) {
    lines.push(
      `ADX: ${adx.adx.toFixed(1)} — ${adxStrengthLabel(adx.trendStrength)}, dominant direction ${adx.dominantDirection}.`,
    )
  } else {
    lines.push('ADX: unavailable.')
  }

  // Bollinger
  if (bollinger.bandwidth !== null) {
    lines.push(
      `Bollinger Bands are ${bandwidthStateLabel(bollinger.bandwidthState)} (bandwidth ${bollinger.bandwidth.toFixed(2)}%).` +
        (bollinger.priceRelativeToBands !== 'unavailable'
          ? ` Price is ${bollinger.priceRelativeToBands.replace(/_/g, ' ')}.`
          : ''),
    )
  } else {
    lines.push('Bollinger Bands: unavailable.')
  }

  // StochRSI
  if (stochRsi.k !== null && stochRsi.d !== null) {
    lines.push(`StochRSI: K=${stochRsi.k.toFixed(1)}, D=${stochRsi.d.toFixed(1)} (${stochRsi.zone}).`)
  } else {
    lines.push('StochRSI: unavailable.')
  }

  return lines.join(' ')
}

// ─── Market Structure Section ─────────────────────────────────────────────────

export function buildMarketStructureSection(analysis: MarketAnalysisResult): string {
  const { marketStructure } = analysis
  const {
    trend,
    strength,
    bos,
    choch,
    pullback,
    consolidation,
    breakout,
    recentStructure,
  } = marketStructure

  const lines: string[] = []

  lines.push(
    `Market structure is ${trend} (strength: ${strength}).` +
      ` Recent swings: ${recentStructure.higherHighs} HH, ${recentStructure.higherLows} HL, ${recentStructure.lowerHighs} LH, ${recentStructure.lowerLows} LL.`,
  )

  if (bos.detected) {
    const last = bos.last
    lines.push(
      `Break of Structure (BOS) detected${last ? ` — last ${last.direction} BOS at ${formatPrice(last.level)}` : ''}.`,
    )
  }

  if (choch.detected) {
    const last = choch.last
    lines.push(
      `Change of Character (CHoCH) detected${last ? ` — last ${last.direction} CHoCH at ${formatPrice(last.level)}` : ''}.`,
    )
  }

  if (consolidation.detected) {
    const rangePct = consolidation.rangePercent !== null ? `${consolidation.rangePercent.toFixed(2)}%` : 'unknown'
    lines.push(`Price is in consolidation: ${rangePct} range over ${consolidation.barsInRange} bars.`)
  }

  if (breakout.confirmed) {
    lines.push(
      `Confirmed ${breakout.direction ?? 'directional'} breakout${breakout.level !== null ? ` above ${formatPrice(breakout.level)}` : ''}.`,
    )
  } else if (breakout.failed) {
    lines.push('A failed breakout was detected.')
  }

  if (pullback.detected) {
    const depthStr = pullback.depth !== null ? `${(pullback.depth * 100).toFixed(1)}%` : 'unknown'
    lines.push(`Pullback in progress (depth: ${depthStr}).`)
  }

  return lines.join(' ')
}

// ─── Support / Resistance Section ─────────────────────────────────────────────

export function buildSupportResistanceSection(analysis: MarketAnalysisResult): string {
  const { srContext, supportResistance } = analysis

  const lines: string[] = []

  if (srContext.insideSupport) {
    lines.push('Price is currently inside a support zone.')
  } else if (srContext.approachingSupport && srContext.nearestSupportDistance !== null) {
    lines.push(
      `Price is approaching support (${srContext.nearestSupportDistance.toFixed(2)}% below).`,
    )
  } else if (srContext.nearestSupportDistance !== null) {
    lines.push(`Nearest support is ${srContext.nearestSupportDistance.toFixed(2)}% below.`)
  } else {
    lines.push('No active support zones identified.')
  }

  if (srContext.insideResistance) {
    lines.push('Price is currently inside a resistance zone.')
  } else if (srContext.approachingResistance && srContext.nearestResistanceDistance !== null) {
    lines.push(
      `Price is approaching resistance (${srContext.nearestResistanceDistance.toFixed(2)}% above).`,
    )
  } else if (srContext.nearestResistanceDistance !== null) {
    lines.push(`Nearest resistance is ${srContext.nearestResistanceDistance.toFixed(2)}% above.`)
  } else {
    lines.push('No active resistance zones identified.')
  }

  if (srContext.strongestActiveSupport !== null) {
    const z = srContext.strongestActiveSupport
    lines.push(
      `Strongest support zone: ${formatPrice(z.lower)}–${formatPrice(z.upper)} (strength ${z.strength.toFixed(0)}).`,
    )
  }

  if (srContext.strongestActiveResistance !== null) {
    const z = srContext.strongestActiveResistance
    lines.push(
      `Strongest resistance zone: ${formatPrice(z.lower)}–${formatPrice(z.upper)} (strength ${z.strength.toFixed(0)}).`,
    )
  }

  const supportCount = supportResistance.activeSupport.length
  const resistanceCount = supportResistance.activeResistance.length
  lines.push(
    `Active zones: ${supportCount} support, ${resistanceCount} resistance.`,
  )

  return lines.join(' ')
}

// ─── Volume Section ───────────────────────────────────────────────────────────

export function buildVolumeSection(analysis: MarketAnalysisResult): string {
  const { volumeContext } = analysis
  const {
    relativeVolume,
    volumeClassification,
    confirmsCurrentMove,
    climaxSignal,
    accDistState,
    priceAboveVWAP,
    vwapDistancePercent,
    respectingVWAP,
    obvDirection,
    obvConfirmingPrice,
    overallStrength,
  } = volumeContext

  const lines: string[] = []

  lines.push(
    `Volume: ${volumeClassification} (relative volume ${relativeVolume.toFixed(2)}x).` +
      (confirmsCurrentMove ? ' Volume confirms the current move.' : ' Volume does not confirm the current move.'),
  )

  const vwapAbove = priceAboveVWAP ? 'above' : 'below'
  lines.push(
    `Price is ${vwapAbove} VWAP by ${Math.abs(vwapDistancePercent).toFixed(2)}%.` +
      (respectingVWAP ? ' Price is respecting VWAP.' : ''),
  )

  lines.push(`OBV direction is ${obvDirection}${obvConfirmingPrice ? ' and confirms price action' : ', diverging from price'}.`)

  lines.push(`Accumulation/Distribution state: ${accDistState}.`)

  if (climaxSignal !== 'none') {
    lines.push(`Volume pattern shows ${climaxLabel(climaxSignal)}.`)
  }

  lines.push(`Overall volume strength: ${overallStrength.toFixed(1)}/10.`)

  return lines.join(' ')
}

// ─── Risk Section ─────────────────────────────────────────────────────────────

export function buildRiskSection(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  cfg: WriterConfig,
): string {
  const risks: string[] = []

  // ATR volatility risk
  if (analysis.price.atrPercent !== null && analysis.price.atrPercent > 5) {
    risks.push(`High volatility: ATR is ${analysis.price.atrPercent.toFixed(2)}% of price.`)
  }

  // Bearish evidence risk factors from confidence reasons
  const bearishReasons = confidence.reasons
    .filter(r => r.direction === 'bearish')
    .slice(0, cfg.maxRiskFactors)
  for (const r of bearishReasons) {
    risks.push(`${r.factor} detected (bearish signal).`)
  }

  // Validation-derived risks
  if (confidence.penalties.length > 0 && cfg.includeWarnings) {
    risks.push(`${confidence.penalties.length} validation issue(s) reduce reliability.`)
  }

  // Overbought / oversold extremes
  const rsiClass = analysis.indicatorSummary.rsi.classification
  if (rsiClass === 'overbought') {
    risks.push('RSI is in overbought territory — potential reversal risk.')
  } else if (rsiClass === 'oversold') {
    risks.push('RSI is in oversold territory — potential bounce risk for short positions.')
  }

  // Climax signals
  if (analysis.volumeContext.climaxSignal === 'buying_climax') {
    risks.push('Buying climax detected — exhaustion reversal is possible.')
  } else if (analysis.volumeContext.climaxSignal === 'selling_climax') {
    risks.push('Selling climax detected — exhaustion reversal is possible.')
  }

  // Approaching S/R
  if (analysis.srContext.approachingResistance) {
    risks.push('Price is approaching resistance — momentum may stall.')
  }
  if (analysis.srContext.approachingSupport) {
    risks.push('Price is approaching support — watch for breakdown or bounce.')
  }

  // Consolidation breakout risk
  if (analysis.marketStructure.consolidation.detected) {
    risks.push('Price is in consolidation — direction of breakout is uncertain.')
  }

  if (risks.length === 0) {
    risks.push('No elevated risk factors identified at this time.')
  }

  const displayed = risks.slice(0, Math.max(cfg.maxRiskFactors, 3))
  return displayed.map((r, i) => `${i + 1}. ${r}`).join(' ')
}

// ─── Confidence Section ───────────────────────────────────────────────────────

export function buildConfidenceSection(
  confidence: ConfidenceResult,
  cfg: WriterConfig,
): string {
  const { score, grade, bullishConfidence, bearishConfidence, reasons, penalties, warnings } =
    confidence

  const gradeLabel: Record<ConfidenceGrade, string> = {
    very_strong: 'Very Strong',
    strong: 'Strong',
    moderate: 'Moderate',
    mixed: 'Mixed',
    weak: 'Weak',
  }

  const lines: string[] = []
  lines.push(
    `Confidence score: ${score.toFixed(1)}/10 (${gradeLabel[grade]}).` +
      ` Bullish sub-score: ${bullishConfidence.toFixed(1)}, Bearish sub-score: ${bearishConfidence.toFixed(1)}.`,
  )

  const topReasons = reasons.slice(0, cfg.maxReasonsDisplayed)
  if (topReasons.length > 0) {
    const reasonStr = topReasons
      .map(r => `${r.factor} (${r.points > 0 ? '+' : ''}${r.points} pts)`)
      .join(', ')
    lines.push(`Key factors: ${reasonStr}.`)
  }

  if (penalties.length > 0) {
    const penStr = penalties
      .map(p => `${p.description} (−${p.scoreReduction.toFixed(1)})`)
      .join('; ')
    lines.push(`Penalties applied: ${penStr}.`)
  }

  if (warnings.length > 0 && cfg.includeWarnings) {
    const warnStr = warnings.map(w => w.message).join('; ')
    lines.push(`Warnings: ${warnStr}.`)
  }

  return lines.join(' ')
}

// ─── Validation Section ───────────────────────────────────────────────────────

export function buildValidationSection(validation: ValidationResult): string {
  if (validation.clean) return ''

  const parts: string[] = []

  if (validation.criticalCount > 0) {
    parts.push(
      `CRITICAL: ${validation.criticalCount} critical validation issue(s) detected — analysis reliability is severely limited.`,
    )
  }

  if (validation.warningCount > 0) {
    parts.push(`${validation.warningCount} validation warning(s): analysis may contain inconsistencies.`)
  }

  const criticalIssues = validation.issues.filter(i => i.severity === 'critical')
  if (criticalIssues.length > 0) {
    const issueStr = criticalIssues.map(i => i.message).join('; ')
    parts.push(`Issues: ${issueStr}`)
  }

  return parts.join(' ')
}

// ─── Conclusion ───────────────────────────────────────────────────────────────

export function buildConclusion(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
): string {
  const { fullTrend } = analysis
  const opener = gradeOpeningPhrase(confidence.grade)
  const direction = trendDirectionWord(fullTrend.trend)
  const hedge = gradeHedge(confidence.grade)

  return (
    `${opener} a ${direction} outlook ${hedge}.` +
    ` This analysis is based on ${analysis.evidence.length} evidence factor(s) from technical indicators, market structure, volume, and support/resistance data.` +
    ` This is not financial advice.`
  )
}

// ─── Critical stub ────────────────────────────────────────────────────────────

/** Builds minimal section stubs used when validation has critical issues. */
export function buildCriticalStubs(validation: ValidationResult): {
  headline: string
  summary: string
  trendSection: string
  indicatorSection: string
  marketStructureSection: string
  supportResistanceSection: string
  volumeSection: string
  riskSection: string
  confidenceSection: string
  validationSection: string
  conclusion: string
} {
  const warning = buildValidationSection(validation)
  return {
    headline: 'Analysis unavailable — critical validation failure',
    summary: 'Analysis cannot be generated due to critical validation issues.',
    trendSection: '',
    indicatorSection: '',
    marketStructureSection: '',
    supportResistanceSection: '',
    volumeSection: '',
    riskSection: '',
    confidenceSection: '',
    validationSection: warning,
    conclusion: '',
  }
}
