import type { PriceZone } from './types'

/**
 * Greedy nearest-first merge: iterate sorted zones bottom-to-top.
 * Two zones merge when the gap between them is less than `mergeThreshold`.
 * Gap = max(lower1, lower2) − min(upper1, upper2); negative = overlap.
 * Only zones of the same type (both support or both resistance) are merged.
 */
export function mergeZones(zones: PriceZone[], mergeThreshold: number): PriceZone[] {
  if (zones.length === 0) return []

  const sorted = [...zones].sort((a, b) => a.center - b.center)
  const result: PriceZone[] = []

  let current = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]

    if (current.type !== next.type) {
      result.push(current)
      current = next
      continue
    }

    const gap = Math.max(current.lower, next.lower) - Math.min(current.upper, next.upper)

    if (gap < mergeThreshold) {
      current = mergeTwo(current, next)
    } else {
      result.push(current)
      current = next
    }
  }

  result.push(current)
  return result
}

function mergeTwo(a: PriceZone, b: PriceZone): PriceZone {
  const totalTouches = a.touchCount + b.touchCount
  const weightedCenter = (a.center * a.touchCount + b.center * b.touchCount) / totalTouches

  const upper = Math.max(a.upper, b.upper)
  const lower = Math.min(a.lower, b.lower)

  return {
    id: a.id,
    type: a.type,
    origin: 'merged',
    state: a.broken || b.broken ? 'broken' : a.state,
    center: weightedCenter,
    upper,
    lower,
    width: upper - lower,
    touchCount: totalTouches,
    successfulReactions: a.successfulReactions + b.successfulReactions,
    failedReactions: a.failedReactions + b.failedReactions,
    broken: a.broken || b.broken,
    retested: a.retested || b.retested,
    firstDetectedIndex: Math.min(a.firstDetectedIndex, b.firstDetectedIndex),
    lastInteractionIndex: Math.max(a.lastInteractionIndex, b.lastInteractionIndex),
    age: Math.max(a.age, b.age),
    strength: 0,
    confidence: 0,
    evidence: [...a.evidence, ...b.evidence],
  }
}
