import type { Unavailable } from '../../modules/common/availability'

/**
 * Discrete dimensions of a situation signature.
 *
 * ── WHAT THESE ARE, AND WHAT THEY ARE NOT ────────────────────────────────────
 *
 * These are RETRIEVAL KEYS, not conclusions. A signature's only purpose is to
 * name a reference class so the AnalogEngine can ask "what happened the last N
 * times the market looked like this". Nothing here may be read as a claim about
 * the future, and nothing here carries a weight.
 *
 * That distinction matters because it is the exact point at which V6 could
 * decay back into V5. V5's booleans looked like descriptions too, right up
 * until they were multiplied by weights and summed. The structural guard is
 * that a signature has no numeric value at all — it cannot be added to
 * anything — and the only module permitted to attach meaning to one is the
 * AnalogEngine, from measured history.
 *
 * ── CARDINALITY BUDGET ───────────────────────────────────────────────────────
 *
 * 3 x 3 x 3 x 3 = 81 reachable signatures. This is a hard design constraint,
 * not an accident: analog retrieval needs hundreds of historical instances per
 * class, so the encoding must stay coarse. Adding a fifth 3-valued dimension
 * would triple the space to 243 and thin every bucket by the same factor. Any
 * future dimension has to justify itself against that cost.
 */

/** Directional persistence of recent displacement. */
export type Drift = 'up' | 'down' | 'mixed'

/** Volatility now versus this market's own recent norm. */
export type Volatility = 'compressing' | 'stable' | 'expanding'

/** Where price sits inside its reference range. */
export type Location = 'low' | 'mid' | 'high'

/** Participation versus this market's own recent norm. */
export type Participation = 'thin' | 'normal' | 'elevated'

export interface SituationSignature {
  readonly drift: Drift
  readonly volatility: Volatility
  readonly location: Location
  readonly participation: Participation
  /**
   * Stable, order-independent string form. This is the reference-class key the
   * AnalogEngine will index on, so it must be identical for identical inputs
   * across processes and versions — hence a fixed field order and no
   * formatting of numbers into it.
   */
  readonly key: string
}

/**
 * The measured quantities the signature was derived from.
 *
 * Carried alongside so the NarrativeRenderer can describe the situation
 * precisely without recomputing anything. V5's writer re-derived its inputs and
 * drifted out of sync with the engine; in V6 values travel with their meaning
 * attached and renderers are forbidden to compute.
 */
export interface SituationMeasurements {
  /** Share of recent bars whose displacement was positive, in [0, 1]. */
  readonly upShare: number
  /** Net displacement over the window, in ATR units. */
  readonly netDisplacement: number
  /** Volatility ratio (short ATR / long ATR). */
  readonly volatilityRatio: number
  /** Position in the reference range, in [0, 1]. */
  readonly rangePosition: number
  /** Reference range width in ATR units. */
  readonly rangeWidthInAtr: number
  /** Mean volume z-score over the window; null when volume had no dispersion. */
  readonly participationZ: number | null
  /** Bars the signature was computed over. */
  readonly window: number
}

export interface Situation {
  readonly signature: SituationSignature
  readonly measurements: SituationMeasurements
  /** Open time of the last bar the situation describes. */
  readonly asOf: number
}

export type SituationResult =
  | { readonly ok: true; readonly situation: Situation; readonly unavailable: null }
  | { readonly ok: false; readonly situation: null; readonly unavailable: Unavailable }

export interface SituationConfig {
  /**
   * Bars summarised into the signature.
   *
   * PROVENANCE: heuristic. Long enough that drift is not one candle's noise,
   * short enough that the signature describes now rather than last week.
   * Calibration target for Phase 3.
   */
  readonly window: number
  /**
   * `upShare` band around 0.5 within which drift is 'mixed'.
   *
   * PROVENANCE: heuristic. 0.5 +/- 0.15 gives roughly a 30/40/30 split on a
   * symmetric random walk, so no bucket is starved. The VALUE is a guess; the
   * requirement that the three buckets be usably populated is not.
   */
  readonly driftBand: number
  /**
   * Volatility-ratio band around 1.0 within which volatility is 'stable'.
   *
   * PROVENANCE: heuristic. Calibration target.
   */
  readonly volatilityBand: number
  /**
   * Range-position terciles.
   *
   * PROVENANCE: derived. Equal partition of [0, 1] into three parts is the
   * unique choice that makes no claim about where price "should" sit.
   */
  readonly locationLow: number
  readonly locationHigh: number
  /**
   * Volume z-score boundary between thin / normal / elevated.
   *
   * PROVENANCE: derived. One standard deviation is the natural unit of
   * "unusual" for a z-score; any other value would be an assertion about how
   * unusual is unusual.
   */
  readonly participationZ: number
}

export const DEFAULT_SITUATION_CONFIG: SituationConfig = {
  window: 20,
  driftBand: 0.15,
  volatilityBand: 0.15,
  locationLow: 1 / 3,
  locationHigh: 2 / 3,
  participationZ: 1,
}
