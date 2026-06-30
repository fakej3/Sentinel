import type { PriceZone, SupportResistanceResult } from '../../support-resistance/types'
import type { AnalysisConfig, SRContextResult } from '../types'

export function deriveSRContext(
  price: number,
  supportResistance: SupportResistanceResult,
  cfg: AnalysisConfig,
): SRContextResult {
  const { nearestSupport, nearestResistance, currentZone, activeSupport, activeResistance } = supportResistance

  const nearestSupportDistance =
    nearestSupport !== null
      ? ((price - nearestSupport.center) / price) * 100
      : null

  const nearestResistanceDistance =
    nearestResistance !== null
      ? ((nearestResistance.center - price) / price) * 100
      : null

  const insideSupport = currentZone !== null && currentZone.type === 'support'
  const insideResistance = currentZone !== null && currentZone.type === 'resistance'

  const approachingSupport =
    nearestSupportDistance !== null &&
    nearestSupportDistance >= 0 &&
    nearestSupportDistance <= cfg.supportProximityPercent

  const approachingResistance =
    nearestResistanceDistance !== null &&
    nearestResistanceDistance >= 0 &&
    nearestResistanceDistance <= cfg.resistanceProximityPercent

  // Strongest = highest strength score among active zones
  const strongestActiveSupport = activeSupport.length > 0
    ? activeSupport.reduce((best, z) => z.strength > best.strength ? z : best)
    : null

  const strongestActiveResistance = activeResistance.length > 0
    ? activeResistance.reduce((best, z) => z.strength > best.strength ? z : best)
    : null

  return {
    nearestSupportDistance,
    nearestResistanceDistance,
    insideSupport,
    insideResistance,
    approachingSupport,
    approachingResistance,
    strongestActiveSupport,
    strongestActiveResistance,
  }
}
