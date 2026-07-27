/**
 * SituationEncoder — names the reference class the current market belongs to.
 *
 * It answers exactly one question: "what kind of situation is this?" — so that
 * the AnalogEngine can later ask "what usually happened next in situations like
 * it". It answers no other question. In particular it does not say whether the
 * situation is good, bullish, tradeable, or strong, and it produces no number
 * that could be summed with another number.
 *
 * The bucketing is deliberately coarse. Analog retrieval needs hundreds of
 * historical members per class; a fine-grained signature would give every
 * moment its own unique class and retrieve nothing. Losing resolution HERE is
 * correct, because the trajectory retains the full shape and is what distance
 * is actually computed over — the signature only narrows the candidate set.
 *
 * This is the opposite of V5's mistake. V5 lost resolution at the START of the
 * pipeline (18 scalars, then 68 booleans) and could never recover it. V6 keeps
 * the shape and coarsens only the index.
 */
import { unavailable } from '../../modules/common/availability'
import type { MultiTimeframeContext } from '../context/types'
import { baseView } from '../context/multi-timeframe'
import { tail } from '../trajectory/encoder'
import type {
  Drift, Location, Participation, SituationConfig,
  SituationMeasurements, SituationResult, SituationSignature, Volatility,
} from './types'
import { DEFAULT_SITUATION_CONFIG } from './types'

/**
 * Fixed field order. The key is an index into historical storage, so it must be
 * byte-identical for identical inputs across processes and releases; deriving
 * it from object iteration order would make that depend on construction order.
 */
function buildKey(
  drift: Drift, volatility: Volatility, location: Location, participation: Participation,
): string {
  return `${drift}/${volatility}/${location}/${participation}`
}

function classifyDrift(upShare: number, band: number): Drift {
  if (upShare > 0.5 + band) return 'up'
  if (upShare < 0.5 - band) return 'down'
  return 'mixed'
}

function classifyVolatility(ratio: number, band: number): Volatility {
  if (ratio > 1 + band) return 'expanding'
  if (ratio < 1 - band) return 'compressing'
  return 'stable'
}

function classifyLocation(position: number, low: number, high: number): Location {
  if (position >= high) return 'high'
  if (position <= low) return 'low'
  return 'mid'
}

/**
 * Participation is 'normal' when volume dispersion is unmeasurable, because an
 * absent measurement is not evidence of thin trading. Reporting 'thin' there
 * would be exactly V5's zero-VWAP defect in a new place: a missing value
 * silently becoming a directional claim.
 */
function classifyParticipation(z: number | null, boundary: number): Participation {
  if (z === null) return 'normal'
  if (z >= boundary) return 'elevated'
  if (z <= -boundary) return 'thin'
  return 'normal'
}

export function encodeSituation(
  context: MultiTimeframeContext,
  config: SituationConfig = DEFAULT_SITUATION_CONFIG,
): SituationResult {
  const view = baseView(context)
  const points = tail(view.trajectory, config.window)

  if (points.length < config.window) {
    return {
      ok: false,
      situation: null,
      unavailable: unavailable('insufficient-history',
        `Situation encoding needs ${config.window} encoded bars; the trajectory has ${points.length}.`),
    }
  }

  // Drift measured by SIGN CONSISTENCY rather than by net movement: a market
  // that rose every bar and one that rose once by a large amount are different
  // situations, and net displacement alone cannot tell them apart. Net is
  // carried in the measurements so the renderer can state both.
  let up = 0
  let net = 0
  let zSum = 0
  let zCount = 0
  for (const p of points) {
    if (p.displacement > 0) up++
    net += p.displacement
    if (p.volumeZ !== null) { zSum += p.volumeZ; zCount++ }
  }
  const upShare = up / points.length
  const participationZ = zCount > 0 ? zSum / zCount : null

  const measurements: SituationMeasurements = {
    upShare,
    netDisplacement: net,
    volatilityRatio: view.volatility.ratio,
    rangePosition: view.range.position,
    rangeWidthInAtr: view.range.widthInAtr,
    participationZ,
    window: points.length,
  }

  const signature: SituationSignature = (() => {
    const drift = classifyDrift(upShare, config.driftBand)
    const volatility = classifyVolatility(view.volatility.ratio, config.volatilityBand)
    const location = classifyLocation(view.range.position, config.locationLow, config.locationHigh)
    const participation = classifyParticipation(participationZ, config.participationZ)
    return { drift, volatility, location, participation, key: buildKey(drift, volatility, location, participation) }
  })()

  return {
    ok: true,
    situation: { signature, measurements, asOf: points[points.length - 1].openTime },
    unavailable: null,
  }
}

/**
 * Every signature the encoder can produce (81).
 *
 * Exists so tests can assert the cardinality budget and so Phase 2 can measure
 * corpus population per class before any retrieval is trusted.
 */
export function allSignatureKeys(): readonly string[] {
  const drifts: Drift[] = ['up', 'down', 'mixed']
  const vols: Volatility[] = ['compressing', 'stable', 'expanding']
  const locs: Location[] = ['low', 'mid', 'high']
  const parts: Participation[] = ['thin', 'normal', 'elevated']
  const keys: string[] = []
  for (const d of drifts) for (const v of vols) for (const l of locs) for (const p of parts) {
    keys.push(buildKey(d, v, l, p))
  }
  return keys
}

export type {
  Situation, SituationSignature, SituationMeasurements, SituationResult, SituationConfig,
  Drift, Volatility, Location, Participation,
} from './types'
export { DEFAULT_SITUATION_CONFIG } from './types'
