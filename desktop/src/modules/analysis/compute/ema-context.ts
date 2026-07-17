import type { IndicatorResult } from '../../indicators/types'
import type { AnalysisConfig, EMAContextResult, EMAConfluenceZone, EMALabel, EMAAlignmentState } from '../types'

interface EMAEntry {
  period: number
  value: number
}

function priceLabel(price: number, ema: number | null): EMALabel {
  if (ema === null) return 'unavailable'
  return price > ema ? 'above' : 'below'
}

function buildConfluenceZones(emas: EMAEntry[], confluencePercent: number): EMAConfluenceZone[] {
  if (emas.length < 2) return []

  const sorted = [...emas].sort((a, b) => a.value - b.value)
  const zones: EMAConfluenceZone[] = []
  let group: EMAEntry[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const ref = group[0].value
    const pct = ((sorted[i].value - ref) / ref) * 100
    if (pct <= confluencePercent) {
      group.push(sorted[i])
    } else {
      if (group.length >= 2) {
        const values = group.map((e) => e.value)
        const low = Math.min(...values)
        const high = Math.max(...values)
        zones.push({
          emaPeriods: group.map((e) => e.period),
          centerPrice: (low + high) / 2,
          low,
          high,
        })
      }
      group = [sorted[i]]
    }
  }

  if (group.length >= 2) {
    const values = group.map((e) => e.value)
    const low = Math.min(...values)
    const high = Math.max(...values)
    zones.push({
      emaPeriods: group.map((e) => e.period),
      centerPrice: (low + high) / 2,
      low,
      high,
    })
  }

  return zones
}

export function computeEMAContext(
  price: number,
  indicators: IndicatorResult,
  cfg: AnalysisConfig,
): EMAContextResult {
  const { ema20, ema50, ema100, ema200 } = indicators

  const priceVsEMA20 = priceLabel(price, ema20)
  const priceVsEMA50 = priceLabel(price, ema50)
  const priceVsEMA100 = priceLabel(price, ema100)
  const priceVsEMA200 = priceLabel(price, ema200)

  // Build alignment state
  let emaAlignment: EMAAlignmentState
  const allAvailable = ema20 !== null && ema50 !== null && ema100 !== null && ema200 !== null
  const anyAvailable = ema20 !== null || ema50 !== null || ema100 !== null || ema200 !== null

  if (!anyAvailable) {
    emaAlignment = 'unavailable'
  } else if (allAvailable) {
    if (ema20 > ema50 && ema50 > ema100 && ema100 > ema200) {
      emaAlignment = 'bullish_stack'
    } else if (ema20 < ema50 && ema50 < ema100 && ema100 < ema200) {
      emaAlignment = 'bearish_stack'
    } else {
      emaAlignment = 'mixed'
    }
  } else {
    emaAlignment = 'mixed'
  }

  // Build EMA entries for confluence detection
  const entries: EMAEntry[] = []
  if (ema20 !== null) entries.push({ period: 20, value: ema20 })
  if (ema50 !== null) entries.push({ period: 50, value: ema50 })
  if (ema100 !== null) entries.push({ period: 100, value: ema100 })
  if (ema200 !== null) entries.push({ period: 200, value: ema200 })

  const confluenceZones = buildConfluenceZones(entries, cfg.emaConfluencePercent)

  return {
    priceVsEMA20,
    priceVsEMA50,
    priceVsEMA100,
    priceVsEMA200,
    emaAlignment,
    confluenceZones,
  }
}
