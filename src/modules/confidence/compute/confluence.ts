import type { EvidenceItem } from '../../analysis/types'
import type { ConfidenceConfig, ConfluenceResult } from '../types'
import { FACTOR_CATEGORY } from './breakdown'

const CATEGORY_NAMES: Record<string, string> = {
  trendQuality:    'Trend/EMAs',
  momentum:        'Momentum',
  volume:          'Volume',
  marketStructure: 'Market Structure',
  srPositioning:   'Support/Resistance',
}

type CategoryDirs = { bullish: number; bearish: number }

/**
 * Measures how many independent signal categories agree with the dominant trend.
 * Returns a 0–10 score plus lists of agreeing/disagreeing category names.
 */
export function computeConfluence(
  evidence: readonly EvidenceItem[],
  cfg: ConfidenceConfig,
  trend: string,
): ConfluenceResult {
  const cats = new Map<string, CategoryDirs>()

  for (const item of evidence) {
    const weight = cfg.factorWeights[item.factor]
    if (weight === undefined) continue
    const category = FACTOR_CATEGORY[item.factor]
    if (category === undefined) continue
    if (item.direction === 'neutral') continue  // neutral items don't pick a side

    const entry = cats.get(category) ?? { bullish: 0, bearish: 0 }
    if (item.direction === 'bullish') entry.bullish += Math.abs(weight)
    else entry.bearish += Math.abs(weight)
    cats.set(category, entry)
  }

  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')
  const isRanging = !isBullish && !isBearish

  const agreeing: string[] = []
  const disagreeing: string[] = []

  for (const [cat, dirs] of cats.entries()) {
    if (dirs.bullish + dirs.bearish === 0) continue
    const displayName = CATEGORY_NAMES[cat] ?? cat

    if (isRanging) {
      const net = Math.abs(dirs.bullish - dirs.bearish)
      const total = dirs.bullish + dirs.bearish
      if (total === 0 || net / total < 0.4) agreeing.push(displayName)
      else disagreeing.push(displayName)
    } else if (isBullish) {
      if (dirs.bullish >= dirs.bearish) agreeing.push(displayName)
      else disagreeing.push(displayName)
    } else {
      if (dirs.bearish >= dirs.bullish) agreeing.push(displayName)
      else disagreeing.push(displayName)
    }
  }

  const total = agreeing.length + disagreeing.length
  const agreementRatio = total === 0 ? 0 : agreeing.length / total
  const score = Math.min(10, Math.round(agreementRatio * 100) / 10)

  return { score, agreeing, disagreeing, agreementRatio }
}
