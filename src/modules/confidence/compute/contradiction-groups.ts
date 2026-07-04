import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, ContradictionGroup } from '../types'
import { FACTOR_CATEGORY } from './breakdown'

const CATEGORY_NAMES: Record<string, string> = {
  trendQuality:    'Trend/EMAs',
  momentum:        'Momentum',
  volume:          'Volume',
  marketStructure: 'Market Structure',
  srPositioning:   'Support/Resistance',
}

/**
 * Groups contradicting evidence by signal category for directional markets.
 * Returns an empty array for ranging markets (no dominant direction to contradict).
 */
export function groupContradictions(
  evidence: readonly EvidenceItem[],
  cfg: ConfidenceConfig,
  trend: string,
): ContradictionGroup[] {
  if (!trend.includes('bullish') && !trend.includes('bearish')) return []

  const isBullish = trend.includes('bullish')

  type CatData = { factors: string[]; totalPoints: number }
  const byCategory = new Map<string, CatData>()

  for (const item of evidence) {
    const weight = cfg.factorWeights[item.factor]
    if (weight === undefined) continue
    const category = FACTOR_CATEGORY[item.factor]
    if (category === undefined) continue

    const isContradicting = isBullish ? weight < 0 : weight > 0
    if (!isContradicting) continue

    const entry = byCategory.get(category) ?? { factors: [], totalPoints: 0 }
    entry.factors.push(item.factor)
    entry.totalPoints += Math.abs(weight)
    byCategory.set(category, entry)
  }

  const groups: ContradictionGroup[] = []
  const dirWord = isBullish ? 'bearish' : 'bullish'

  for (const [category, data] of byCategory.entries()) {
    const displayName = CATEGORY_NAMES[category] ?? category
    const severity: ContradictionGroup['severity'] =
      data.totalPoints >= 20 ? 'strong' :
      data.totalPoints >= 10 ? 'moderate' : 'mild'

    groups.push({
      category: displayName,
      severity,
      description: `${dirWord} ${displayName} signals (${data.totalPoints} pts) oppose the dominant trend`,
      factors: data.factors,
    })
  }

  groups.sort((a, b) => {
    const order: Record<ContradictionGroup['severity'], number> = { strong: 0, moderate: 1, mild: 2 }
    return order[a.severity] - order[b.severity]
  })

  return groups
}
