import type { MarketAnalysisResult } from '../../analysis/types'
import type { ValidationResult } from '../../validation/types'
import type { TradePlan, InvalidationScenario } from '../types'

function fmt(price: number): string {
  if (price >= 10000) return price.toFixed(0)
  if (price >= 100)   return price.toFixed(2)
  if (price >= 1)     return price.toFixed(4)
  return price.toFixed(6)
}

/**
 * Produces data-driven invalidation scenarios from existing analysis outputs.
 * Each scenario names a concrete condition — never generic boilerplate text.
 * Returns scenarios sorted critical → major → minor.
 */
export function computeInvalidationScenarios(
  analysis: MarketAnalysisResult,
  validation: ValidationResult,
  tradePlan: TradePlan,
): InvalidationScenario[] {
  const { fullTrend, emaContext, indicatorSummary, volumeContext, srContext } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  const critical: InvalidationScenario[] = []
  const major: InvalidationScenario[] = []
  const minor: InvalidationScenario[] = []

  // ── Validation-based (always shown) ─────────────────────────────────────────
  if (validation.criticalCount > 0) {
    const issues = validation.issues.filter(i => i.severity === 'critical').slice(0, 2)
    for (const issue of issues) {
      critical.push({
        type: 'validation',
        severity: 'critical',
        description: `Data quality issue: ${issue.message}`,
      })
    }
  }

  // ── Price-level invalidation from trade plan ─────────────────────────────────
  if (tradePlan.invalidationLevel !== null) {
    const level = fmt(tradePlan.invalidationLevel)
    if (isBullish) {
      critical.push({
        type: 'price_level',
        severity: 'critical',
        description: `Close and hold below ${level} breaks the key support level and invalidates the bullish thesis`,
      })
    } else if (isBearish) {
      critical.push({
        type: 'price_level',
        severity: 'critical',
        description: `Close and hold above ${level} breaks the key resistance level and invalidates the bearish thesis`,
      })
    }
  }

  // ── Structure-based ──────────────────────────────────────────────────────────
  if (isBullish) {
    major.push({
      type: 'structure',
      severity: 'major',
      description: 'Bearish BOS or CHoCH would signal a structural trend change — bullish case breaks',
    })

    if (emaContext.emaAlignment === 'bullish_stack') {
      major.push({
        type: 'indicator',
        severity: 'major',
        description: 'Loss of EMA bullish stack (EMA20 crossing below EMA50) would weaken the trend structure',
      })
    }

    if (srContext.nearestResistanceDistance !== null && srContext.nearestResistanceDistance < 4) {
      major.push({
        type: 'price_level',
        severity: 'major',
        description: `Rejection at overhead resistance (${srContext.nearestResistanceDistance.toFixed(1)}% above) would cap the upside and confirm a range`,
      })
    }

    const rsi = indicatorSummary.rsi
    if (rsi.value !== null && rsi.classification !== 'overbought') {
      minor.push({
        type: 'indicator',
        severity: 'minor',
        description: `RSI dropping into oversold territory from ${rsi.value.toFixed(0)} would signal momentum failure`,
      })
    }

  } else if (isBearish) {
    major.push({
      type: 'structure',
      severity: 'major',
      description: 'Bullish BOS or CHoCH would signal a structural trend change — bearish case breaks',
    })

    if (emaContext.emaAlignment === 'bearish_stack') {
      major.push({
        type: 'indicator',
        severity: 'major',
        description: 'EMA bearish stack broken (EMA20 crossing above EMA50) would weaken the downtrend',
      })
    }

    if (srContext.nearestSupportDistance !== null && Math.abs(srContext.nearestSupportDistance) < 4) {
      major.push({
        type: 'price_level',
        severity: 'major',
        description: `Hold and bounce from nearby support (${Math.abs(srContext.nearestSupportDistance).toFixed(1)}% below) would stabilise price and challenge the bearish view`,
      })
    }

    const rsi = indicatorSummary.rsi
    if (rsi.value !== null && rsi.classification !== 'oversold') {
      minor.push({
        type: 'indicator',
        severity: 'minor',
        description: `RSI recovering into bullish zone from ${rsi.value.toFixed(0)} would signal momentum reversal`,
      })
    }

  } else {
    // Ranging market
    major.push({
      type: 'structure',
      severity: 'major',
      description: 'Sustained high-volume close above resistance would confirm bullish directional bias',
    })
    major.push({
      type: 'structure',
      severity: 'major',
      description: 'Sustained high-volume close below support would confirm bearish directional bias',
    })
  }

  // ── Volume-based ─────────────────────────────────────────────────────────────
  if (isBullish || isBearish) {
    if (volumeContext.relativeVolume > 0.7) {
      minor.push({
        type: 'volume',
        severity: 'minor',
        description: `Volume dropping below 0.6× average (currently ${volumeContext.relativeVolume.toFixed(1)}×) would signal fading conviction behind the move`,
      })
    }

    if (volumeContext.climaxSignal === 'buying_climax' && isBullish) {
      major.push({
        type: 'volume',
        severity: 'major',
        description: 'Buying climax detected — volume exhaustion at highs suggests potential reversal risk',
      })
    } else if (volumeContext.climaxSignal === 'selling_climax' && isBearish) {
      major.push({
        type: 'volume',
        severity: 'major',
        description: 'Selling climax detected — volume exhaustion at lows suggests potential reversal risk',
      })
    }
  }

  // ── Warning-based ────────────────────────────────────────────────────────────
  if (validation.warningCount > 0) {
    const warnings = validation.issues.filter(i => i.severity === 'warning').slice(0, 2)
    for (const w of warnings) {
      minor.push({
        type: 'validation',
        severity: 'minor',
        description: `Validation flag: ${w.message}`,
      })
    }
  }

  return [...critical, ...major, ...minor]
}
