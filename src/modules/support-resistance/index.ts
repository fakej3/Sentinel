/**
 * Support & Resistance Engine — builds price zones from swing points, scores
 * their strength via candle interactions, and classifies the current price
 * relative to those zones.
 *
 * Inputs:  Candle[], MarketStructureResult, SupportResistanceConfig
 * Outputs: SupportResistanceResult (zones[], activeSupport[], activeResistance[],
 *          nearestSupport, nearestResistance, currentZone)
 * Deps:    binance, market-structure, indicators (ATR)
 */
import type { Candle } from '../binance/types'
import type { MarketStructureResult } from '../market-structure/types'
import type { PriceZone, SupportResistanceConfig, SupportResistanceResult } from './types'
import { DEFAULT_CONFIG } from './config'
import { createZoneCandidates } from './zones'
import { computeAtr } from '../indicators'
import { mergeZones } from './merge'
import { applyInteractions } from './interactions'
import { computeStrength, computeZoneConfidence, deriveState } from './strength'
import { buildZoneEvidence, buildResultEvidence } from './evidence'

export { DEFAULT_CONFIG }
export type { PriceZone, SupportResistanceConfig, SupportResistanceResult, ZoneState, ZoneOrigin } from './types'

function makeEmptyResult(): SupportResistanceResult {
  return {
    zones: [],
    activeSupport: [],
    activeResistance: [],
    nearestSupport: null,
    nearestResistance: null,
    currentZone: null,
    evidence: ['Insufficient data for support/resistance analysis'],
  }
}

/**
 * Compute support and resistance zones from candle data and market structure swings.
 *
 * Pipeline:
 * 1. Validate inputs — return empty result when data is insufficient.
 * 2. Compute ATR (Module 2 canonical implementation) for zone sizing and merge threshold.
 * 3. Create zone candidates from swing highs (resistance) and swing lows (support).
 * 4. Merge overlapping / close zones of the same type.
 * 5. Apply candle interactions to each merged zone (touches, bounces, breaks, retests).
 * 6. Filter: drop zones below minTouchCount.
 * 7. Compute strength, confidence, state, and evidence for each zone.
 * 8. Classify: activeSupport, activeResistance, nearest, currentZone.
 * 9. Build result evidence summary.
 */
export function computeSupportResistance(
  candles: Candle[],
  marketStructure: MarketStructureResult,
  config?: Partial<SupportResistanceConfig>,
): SupportResistanceResult {
  const cfg: SupportResistanceConfig = { ...DEFAULT_CONFIG, ...config }

  if (candles.length < 2 || marketStructure.swings.length === 0) {
    return makeEmptyResult()
  }

  const currentPrice = candles[candles.length - 1].close
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  const closes = candles.map(c => c.close)
  const atr = computeAtr(highs, lows, closes)
  const mergeThreshold = atr !== null ? atr * cfg.mergeTolerance : currentPrice * 0.003

  // 1. Create zone candidates from swing points
  const candidates = createZoneCandidates(marketStructure.swings, candles, cfg, atr)

  // 2. Merge zones of the same type before applying interactions
  const mergedSupport = mergeZones(candidates.filter(z => z.type === 'support'), mergeThreshold)
  const mergedResistance = mergeZones(candidates.filter(z => z.type === 'resistance'), mergeThreshold)

  // 3. Apply candle interactions to merged zones
  const interacted = [...mergedSupport, ...mergedResistance].map(z => applyInteractions(z, candles))

  // 4. Filter: require at least minTouchCount
  const filtered = interacted.filter(z => z.touchCount >= cfg.minTouchCount)

  // 5. Finalize: recompute age, state, strength, confidence, evidence
  const totalCandles = candles.length
  const finalZones: PriceZone[] = filtered.map(z => {
    const age = totalCandles - 1 - z.firstDetectedIndex
    const withAge = { ...z, age }
    const state = deriveState(withAge, cfg.maxZoneAge)
    const strength = computeStrength(withAge, cfg.strengthDecayAge)
    const confidence = computeZoneConfidence(withAge)
    const evidence = buildZoneEvidence({ ...withAge, state, strength, confidence })
    return { ...withAge, state, strength, confidence, evidence }
  })

  // Sort all zones by center descending
  finalZones.sort((a, b) => b.center - a.center)

  // 6. Classify
  const isActive = (z: PriceZone) => !z.broken && z.state !== 'archived'

  const activeSupport = finalZones.filter(z => z.type === 'support' && isActive(z) && z.upper < currentPrice)
    .sort((a, b) => b.center - a.center)

  const activeResistance = finalZones.filter(z => z.type === 'resistance' && isActive(z) && z.lower > currentPrice)
    .sort((a, b) => a.center - b.center)

  // Nearest support: highest support zone whose upper < currentPrice
  const nearestSupport = activeSupport.find(z => z.upper < currentPrice) ?? null

  // Nearest resistance: lowest resistance zone whose lower > currentPrice
  const nearestResistance = activeResistance.find(z => z.lower > currentPrice) ?? null

  // Current zone: zone whose range contains the current price
  const currentZone = finalZones.find(
    z => isActive(z) && currentPrice >= z.lower && currentPrice <= z.upper,
  ) ?? null

  const evidence = buildResultEvidence(
    finalZones, nearestSupport, nearestResistance, currentZone, currentPrice,
  )

  return {
    zones: finalZones,
    activeSupport,
    activeResistance,
    nearestSupport,
    nearestResistance,
    currentZone,
    evidence,
  }
}
