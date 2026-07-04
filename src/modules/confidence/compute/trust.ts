import type { MarketAnalysisResult } from '../../analysis/types'
import type { ValidationResult } from '../../validation/types'
import type { TrustFactor, TrustResult } from '../types'

/**
 * Assess data and pipeline quality independently of signal strength.
 * Trust answers "can we rely on this analysis?" — not "how strong is the signal?"
 */
export function computeTrust(
  analysis: MarketAnalysisResult,
  validation: ValidationResult,
): TrustResult {
  const { indicators, supportResistance, volumeContext } = analysis

  const factors: TrustFactor[] = [
    {
      label: 'RSI available',
      passed: indicators.rsi !== null,
      note: indicators.rsi === null ? 'Insufficient price history for RSI' : undefined,
    },
    {
      label: 'MACD available',
      passed: indicators.macd !== null,
      note: indicators.macd === null ? 'Insufficient price history for MACD' : undefined,
    },
    {
      label: 'Long-term EMA (200) available',
      passed: indicators.ema200 !== null,
      note: indicators.ema200 === null ? 'Fewer than 200 bars of history' : undefined,
    },
    {
      label: 'No critical data issues',
      passed: validation.criticalCount === 0,
      note: validation.criticalCount > 0
        ? `${validation.criticalCount} critical issue(s) detected`
        : undefined,
    },
    {
      label: 'Structural validation passed',
      passed: validation.passed,
      note: !validation.passed
        ? `${validation.warningCount} warning(s) flagged`
        : undefined,
    },
    {
      label: 'Support/resistance zones identified',
      passed: supportResistance.zones.length > 0,
      note: supportResistance.zones.length === 0 ? 'No S/R zones detected' : undefined,
    },
    {
      label: 'Volume data sufficient',
      passed: volumeContext.volumeClassification !== 'very_low',
      note: volumeContext.volumeClassification === 'very_low'
        ? 'Very low volume — signals are less reliable'
        : undefined,
    },
  ]

  const passedCount = factors.filter(f => f.passed).length
  const score = Math.round((passedCount / factors.length) * 100)
  const level: 'high' | 'medium' | 'low' = score >= 80 ? 'high' : score >= 57 ? 'medium' : 'low'
  const reductions = factors.filter(f => !f.passed && f.note !== undefined).map(f => f.note!)

  return { score, level, factors, reductions }
}
