import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceResult } from '../confidence/types'
import type { TradePlan, InvalidationScenario, MultiTimeframeAgreement } from '../pipeline/types'
import type { BinancePost } from './types'

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BinancePostInput {
  analysis: MarketAnalysisResult
  validation: ValidationResult
  confidence: ConfidenceResult
  tradePlan: TradePlan
  invalidationScenarios: InvalidationScenario[]
  mtfAgreement?: MultiTimeframeAgreement
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(price: number): string {
  if (price >= 10_000) return `$${price.toFixed(0)}`
  if (price >= 100)    return `$${price.toFixed(2)}`
  if (price >= 1)      return `$${price.toFixed(4)}`
  return `$${price.toFixed(6)}`
}

function fmtZone(lower: number, upper: number): string {
  return `${fmt(lower)}–${fmt(upper)}`
}

function trendLabel(trend: string): string {
  const map: Record<string, string> = {
    'strong bullish':   'Strong Bullish',
    'moderate bullish': 'Moderate Bullish',
    'weak bullish':     'Weak Bullish',
    'ranging':          'Ranging',
    'weak bearish':     'Weak Bearish',
    'moderate bearish': 'Moderate Bearish',
    'strong bearish':   'Strong Bearish',
  }
  return map[trend] ?? trend
}

// ─── Blocking conditions ─────────────────────────────────────────────────────

function deriveBlockReason(
  tradePlan: TradePlan,
  validation: ValidationResult,
  mtfAgreement: MultiTimeframeAgreement | undefined,
): string | null {
  if (validation.criticalCount > 0) {
    const msg = validation.issues.find(i => i.severity === 'critical')?.message
    return `Critical data quality issue: ${msg ?? 'analysis unreliable — do not publish'}`
  }
  if (!tradePlan.actionable) {
    return tradePlan.setupQualityReason
  }
  if (mtfAgreement?.agreement === 'strong_conflict') {
    return `Multi-timeframe conflict: ${mtfAgreement.conflictingCount} timeframe(s) oppose the dominant ${mtfAgreement.dominantDirection} direction`
  }
  return null
}

// ─── Evidence bullets ─────────────────────────────────────────────────────────

function buildEvidenceBullets(
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
): string[] {
  const bullets: string[] = []
  const { indicatorSummary, volumeContext, marketStructure } = analysis

  // RSI
  const rsiVal = indicatorSummary.rsi.value
  if (rsiVal !== null) {
    const cls = indicatorSummary.rsi.classification
    const desc = cls === 'overbought' ? 'overbought'
      : cls === 'oversold' ? 'oversold'
      : cls === 'healthy_bullish' ? 'healthy bullish zone'
      : cls === 'weak_bearish' ? 'bearish zone'
      : 'neutral'
    bullets.push(`RSI: ${rsiVal.toFixed(0)} (${desc})`)
  }

  // MACD
  const hist = indicatorSummary.macd.histogram
  if (hist !== null) {
    const sign = hist > 0 ? 'positive' : hist < 0 ? 'negative' : 'flat'
    bullets.push(`MACD: ${indicatorSummary.macd.bias}, histogram ${sign} (${hist.toFixed(4)})`)
  }

  // Volume confirmation
  const rv = volumeContext.relativeVolume.toFixed(1)
  bullets.push(
    volumeContext.confirmsCurrentMove
      ? `Volume: ${rv}× average — confirms move`
      : `Volume: ${rv}× average — move not volume-confirmed`,
  )

  // Market structure — BOS takes priority over CHoCH
  if (marketStructure.bos.detected && marketStructure.bos.last) {
    const dir = marketStructure.bos.last.direction
    bullets.push(`${dir === 'bullish' ? 'Bullish' : 'Bearish'} BOS confirmed at ${fmt(marketStructure.bos.last.level)}`)
  } else if (marketStructure.choch.detected && marketStructure.choch.last) {
    const dir = marketStructure.choch.last.direction
    bullets.push(`${dir} CHoCH at ${fmt(marketStructure.choch.last.level)}`)
  }

  // ADX — only if noteworthy
  const adxVal = indicatorSummary.adx.adx
  const adxStrength = indicatorSummary.adx.trendStrength
  if (adxVal !== null && (adxStrength === 'strong' || adxStrength === 'very_strong' || adxStrength === 'weak')) {
    bullets.push(`ADX: ${adxVal.toFixed(0)} (${adxStrength} trend momentum)`)
  }

  // Top confidence reasons not yet covered above
  const topReasons = confidence.reasons
    .filter(r => !bullets.some(b => b.toLowerCase().includes(r.factor.toLowerCase().split(' ')[0])))
    .slice(0, 1)
  for (const r of topReasons) {
    bullets.push(`${r.factor} (${r.points > 0 ? '+' : ''}${r.points} pts)`)
  }

  return bullets.slice(0, 4)
}

// ─── Risk bullets ─────────────────────────────────────────────────────────────

function buildRiskBullets(analysis: MarketAnalysisResult, confidence: ConfidenceResult): string[] {
  const risks: string[] = []
  const { srContext, volumeContext, indicatorSummary, marketStructure } = analysis

  if (indicatorSummary.rsi.classification === 'overbought') {
    risks.push(`RSI overbought at ${indicatorSummary.rsi.value?.toFixed(0)} — reversal risk elevated`)
  } else if (indicatorSummary.rsi.classification === 'oversold') {
    risks.push(`RSI oversold at ${indicatorSummary.rsi.value?.toFixed(0)} — short entries carry bounce risk`)
  }

  if (srContext.approachingResistance && srContext.nearestResistanceDistance !== null) {
    risks.push(`Resistance ${srContext.nearestResistanceDistance.toFixed(1)}% above — upside may stall`)
  }
  if (srContext.approachingSupport && srContext.nearestSupportDistance !== null) {
    risks.push(`Support ${srContext.nearestSupportDistance.toFixed(1)}% below — breakdown risk if level fails`)
  }

  if (volumeContext.climaxSignal === 'buying_climax') {
    risks.push('Buying climax — volume exhaustion at highs, reversal risk')
  } else if (volumeContext.climaxSignal === 'selling_climax') {
    risks.push('Selling climax — volume exhaustion at lows, bounce risk')
  }

  if (marketStructure.consolidation.detected) {
    risks.push(`In consolidation (${marketStructure.consolidation.rangePercent?.toFixed(1) ?? '?'}% range) — direction uncertain`)
  }

  if (!volumeContext.confirmsCurrentMove && volumeContext.relativeVolume < 0.7) {
    risks.push(`Low volume (${volumeContext.relativeVolume.toFixed(1)}× average) — weak conviction behind move`)
  }

  if (confidence.penalties.length > 0) {
    risks.push(`${confidence.penalties.length} validation issue(s) reduce signal reliability`)
  }

  return risks.slice(0, 3)
}

// ─── Post builders ───────────────────────────────────────────────────────────

function buildTradePost(
  header: string,
  analysis: MarketAnalysisResult,
  confidence: ConfidenceResult,
  tradePlan: TradePlan,
  invalidationScenarios: InvalidationScenario[],
): string {
  const lines: string[] = []
  const trend = analysis.fullTrend.trend
  const biasLabel = trend.includes('bullish') ? 'Bullish' : trend.includes('bearish') ? 'Bearish' : 'Neutral'

  lines.push(header)
  lines.push('')
  lines.push(`Bias: ${biasLabel}`)

  if (tradePlan.entryZone) {
    lines.push(`Entry zone: ${fmtZone(tradePlan.entryZone.lower, tradePlan.entryZone.upper)}`)
  }
  if (tradePlan.invalidationLevel !== null) {
    lines.push(`Stop-loss: ${fmt(tradePlan.invalidationLevel)}`)
  }
  if (tradePlan.targetLevel !== null) {
    lines.push(`Target: ${fmt(tradePlan.targetLevel)}`)
  }
  if (tradePlan.riskRewardRatio !== null) {
    lines.push(`Risk/reward: ${tradePlan.riskRewardRatio.toFixed(2)}:1`)
  }

  lines.push('')
  lines.push('Evidence:')
  for (const b of buildEvidenceBullets(analysis, confidence)) {
    lines.push(`• ${b}`)
  }

  const risks = buildRiskBullets(analysis, confidence)
  if (risks.length > 0) {
    lines.push('')
    lines.push('Risk factors:')
    for (const r of risks) {
      lines.push(`• ${r}`)
    }
  }

  // Critical price-level invalidation scenario takes precedence; fall back to tradePlan level
  const priceLevelInvalidation = invalidationScenarios.find(
    s => s.type === 'price_level' && s.severity === 'critical',
  )
  lines.push('')
  if (priceLevelInvalidation) {
    lines.push(`Invalidation: ${priceLevelInvalidation.description}.`)
  } else if (tradePlan.invalidationLevel !== null) {
    lines.push(`Invalidation: ${biasLabel.toLowerCase()} thesis invalid on close beyond ${fmt(tradePlan.invalidationLevel)}.`)
  }

  lines.push('')
  lines.push('⚠️ Not financial advice.')

  return lines.join('\n')
}

function buildWaitPost(
  header: string,
  blockReason: string,
  analysis: MarketAnalysisResult,
): string {
  const lines: string[] = []
  const { srContext, volumeContext, indicatorSummary } = analysis

  lines.push(header)
  lines.push('')
  lines.push('⚠️ WAIT — No high-quality trade setup available.')
  lines.push(`Reason: ${blockReason}`)

  // Contextual market data — useful even without a trade
  const contextParts: string[] = []
  if (indicatorSummary.adx.adx !== null) {
    contextParts.push(`ADX: ${indicatorSummary.adx.adx.toFixed(0)} (${indicatorSummary.adx.trendStrength})`)
  }
  if (volumeContext.relativeVolume < 0.7) {
    contextParts.push(`Volume: ${volumeContext.relativeVolume.toFixed(1)}× average (below confirmation)`)
  }
  if (contextParts.length > 0) {
    lines.push('')
    lines.push(contextParts.join(' | '))
  }

  // S/R levels to monitor
  const watching: string[] = []
  if (srContext.nearestSupportDistance !== null) {
    watching.push(`Support ${srContext.nearestSupportDistance.toFixed(1)}% below`)
  }
  if (srContext.nearestResistanceDistance !== null) {
    watching.push(`Resistance ${srContext.nearestResistanceDistance.toFixed(1)}% above`)
  }
  if (watching.length > 0) {
    lines.push('')
    lines.push('Levels to monitor:')
    for (const w of watching) {
      lines.push(`• ${w}`)
    }
  }

  lines.push('')
  lines.push('⚠️ Not financial advice.')

  return lines.join('\n')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a structured Binance-post-format output (Mode 1).
 *
 * Mode 1 is concise and publication-ready: Bias, Entry, SL, TP, RR,
 * key evidence, risk factors, and an explicit invalidation level.
 *
 * When the setup is not actionable or a blocking condition exists,
 * returns a WAIT post instead of forcing a trade.
 *
 * Evidence coverage is always 100% — every claim derives from a
 * concrete computed field; no facts are invented.
 */
export function buildBinancePost(input: BinancePostInput): BinancePost {
  const { analysis, validation, confidence, tradePlan, invalidationScenarios, mtfAgreement } = input
  const { fullTrend } = analysis
  const trend = fullTrend.trend
  const bias: BinancePost['bias'] = trend.includes('bullish') ? 'bullish'
    : trend.includes('bearish') ? 'bearish'
    : 'neutral'

  const header = `${analysis.symbol} ${analysis.timeframe} | Confidence: ${confidence.score.toFixed(1)}/10 — ${trendLabel(trend)}`

  const blockReason = deriveBlockReason(tradePlan, validation, mtfAgreement)
  const publishable = blockReason === null

  const text = publishable
    ? buildTradePost(header, analysis, confidence, tradePlan, invalidationScenarios)
    : buildWaitPost(header, blockReason!, analysis)

  return {
    text,
    publishable,
    blockReason,
    bias,
    confidenceScore: confidence.score,
    evidenceCoverage: 100,
  }
}
