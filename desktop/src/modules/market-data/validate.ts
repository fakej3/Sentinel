import type { Candle } from '../market/types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateCandles(candles: Candle[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (candles.length === 0) {
    warnings.push('Empty candle array')
    return { valid: true, errors, warnings }
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const p = `Candle[${i}]`

    if (!Number.isFinite(c.openTime)  || c.openTime  <= 0)           errors.push(`${p}: invalid openTime ${c.openTime}`)
    if (!Number.isFinite(c.closeTime) || c.closeTime <= c.openTime)   errors.push(`${p}: closeTime must be after openTime`)
    if (!Number.isFinite(c.open)      || c.open      < 0)            errors.push(`${p}: invalid open ${c.open}`)
    if (!Number.isFinite(c.high)      || c.high      < 0)            errors.push(`${p}: invalid high ${c.high}`)
    if (!Number.isFinite(c.low)       || c.low       < 0)            errors.push(`${p}: invalid low ${c.low}`)
    if (!Number.isFinite(c.close)     || c.close     < 0)            errors.push(`${p}: invalid close ${c.close}`)
    if (!Number.isFinite(c.volume)    || c.volume    < 0)            errors.push(`${p}: invalid volume ${c.volume}`)

    if (c.high < c.low)                                               errors.push(`${p}: high < low`)
    if (c.high < c.open  || c.high < c.close)                        errors.push(`${p}: high is less than open or close`)
    if (c.low  > c.open  || c.low  > c.close)                        errors.push(`${p}: low is greater than open or close`)

    if (i > 0 && c.openTime <= candles[i - 1].openTime) {
      errors.push(`${p}: openTime not strictly after previous candle`)
    }
  }

  // Duplicate openTime check (O(n) via Set)
  const seen = new Set<number>()
  for (const c of candles) {
    if (seen.has(c.openTime)) errors.push(`Duplicate openTime: ${c.openTime}`)
    seen.add(c.openTime)
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Remove duplicate openTimes (keep last occurrence) and sort ascending by openTime.
 * Does not mutate the input array.
 */
export function repairCandles(candles: Candle[]): Candle[] {
  const map = new Map<number, Candle>()
  for (const c of candles) map.set(c.openTime, c)
  return Array.from(map.values()).sort((a, b) => a.openTime - b.openTime)
}
