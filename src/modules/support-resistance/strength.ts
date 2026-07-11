import type { PriceZone, ZoneState } from './types'

/** ENGINE_RULES.md §12.6 */
export function computeStrength(zone: PriceZone, strengthDecayAge: number): number {
  const score =
    20 +
    Math.max(0, Math.min(zone.touchCount - 1, 5)) * 10 +
    Math.min(zone.successfulReactions, 4) * 5 -
    Math.min(zone.failedReactions, 2) * 10 +
    (zone.retested ? 5 : 0) -
    Math.max(0, zone.age - strengthDecayAge) * 0.2

  return Math.min(10, Math.max(0, score / 10))
}

/** Confidence reflects how reliably the zone has fulfilled its historical role. */
export function computeZoneConfidence(zone: PriceZone): number {
  const total = zone.successfulReactions + zone.failedReactions
  if (total === 0) return zone.touchCount >= 2 ? 3 : 0

  const ratio = zone.successfulReactions / total
  let score = ratio * 10

  // Bonus for more observations
  if (total >= 4) score = Math.min(10, score + 1)
  if (zone.retested) score = Math.min(10, score + 0.5)

  return Math.min(10, Math.max(0, score))
}

/** ENGINE_RULES.md §12.5 — derive state from zone fields */
export function deriveState(zone: PriceZone, maxZoneAge: number): ZoneState {
  if (zone.age > maxZoneAge) return 'archived'
  if (zone.broken && zone.retested) return 'flipped'
  if (zone.broken) return 'broken'
  if (zone.failedReactions >= 1) return 'weakening'
  if (zone.successfulReactions >= 2) return 'strengthened'
  if (zone.successfulReactions === 1) return 'tested'
  return 'active'
}
