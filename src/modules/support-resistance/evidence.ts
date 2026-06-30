import type { PriceZone } from './types'

/** Build human-readable evidence strings for a single zone. */
export function buildZoneEvidence(zone: PriceZone): string[] {
  const evidence: string[] = []
  const priceStr = zone.center.toFixed(2)

  const typeLabel = zone.type === 'support' ? 'Support' : 'Resistance'
  evidence.push(`${typeLabel} zone at ${priceStr} (${zone.lower.toFixed(2)}–${zone.upper.toFixed(2)})`)

  if (zone.touchCount > 1) {
    evidence.push(`Touched ${zone.touchCount} times`)
  }
  if (zone.successfulReactions > 0) {
    evidence.push(`${zone.successfulReactions} successful reaction${zone.successfulReactions > 1 ? 's' : ''} (bounce${zone.successfulReactions > 1 ? 's' : ''})`)
  }
  if (zone.failedReactions > 0) {
    evidence.push(`${zone.failedReactions} failed reaction${zone.failedReactions > 1 ? 's' : ''} (break attempt${zone.failedReactions > 1 ? 's' : ''})`)
  }
  if (zone.broken) {
    evidence.push(`Zone broken — price closed through ${priceStr}`)
  }
  if (zone.retested) {
    evidence.push(`Zone retested from opposite side after break`)
  }
  if (zone.state === 'archived') {
    evidence.push(`Zone archived — exceeded maximum age (${zone.age} candles)`)
  }

  const strengthLabel =
    zone.strength >= 7.5 ? 'Very Strong' :
    zone.strength >= 5.0 ? 'Strong' :
    zone.strength >= 3.0 ? 'Moderate' : 'Weak'
  evidence.push(`Strength: ${zone.strength.toFixed(1)}/10 (${strengthLabel})`)

  return evidence
}

/** Build summary evidence for the SupportResistanceResult. */
export function buildResultEvidence(
  zones: PriceZone[],
  nearestSupport: PriceZone | null,
  nearestResistance: PriceZone | null,
  currentZone: PriceZone | null,
  currentPrice: number,
): string[] {
  const evidence: string[] = []

  const activeCount = zones.filter(z => !z.broken && z.state !== 'archived').length
  if (activeCount === 0) {
    evidence.push('No active support or resistance zones detected')
    return evidence
  }

  evidence.push(`${activeCount} active S/R zone${activeCount !== 1 ? 's' : ''} detected`)

  if (currentZone) {
    const label = currentZone.type === 'support' ? 'support' : 'resistance'
    evidence.push(`Price is inside a ${label} zone at ${currentZone.center.toFixed(2)}`)
  }

  if (nearestSupport) {
    const dist = ((currentPrice - nearestSupport.center) / currentPrice * 100).toFixed(2)
    evidence.push(`Nearest support at ${nearestSupport.center.toFixed(2)} (${dist}% below, strength ${nearestSupport.strength.toFixed(1)}/10)`)
  } else {
    evidence.push('No active support zone below current price')
  }

  if (nearestResistance) {
    const dist = ((nearestResistance.center - currentPrice) / currentPrice * 100).toFixed(2)
    evidence.push(`Nearest resistance at ${nearestResistance.center.toFixed(2)} (${dist}% above, strength ${nearestResistance.strength.toFixed(1)}/10)`)
  } else {
    evidence.push('No active resistance zone above current price')
  }

  return evidence
}
