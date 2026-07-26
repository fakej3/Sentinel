export type ZoneState = 'active' | 'tested' | 'strengthened' | 'weakening' | 'broken' | 'flipped' | 'archived'
export type ZoneOrigin = 'swing-high' | 'swing-low' | 'merged'

export interface PriceZone {
  /** Unique identifier, e.g. "sr-001" */
  id: string
  type: 'support' | 'resistance'
  origin: ZoneOrigin
  state: ZoneState
  /** Midpoint between upper and lower */
  center: number
  /** Top of the zone (upper boundary) */
  upper: number
  /** Bottom of the zone (lower boundary) */
  lower: number
  /** upper − lower */
  width: number
  /** Total number of times price entered the zone */
  touchCount: number
  /** Times price entered the zone and reversed back out */
  successfulReactions: number
  /** Times price entered the zone and continued through it */
  failedReactions: number
  /** True when price has closed through the zone without reversing */
  broken: boolean
  /** True when price returned to the zone from the opposite side after breaking */
  retested: boolean
  /** Candle index when this zone was first detected */
  firstDetectedIndex: number
  /** Candle index of the most recent touch, bounce, or break */
  lastInteractionIndex: number
  /** Candles elapsed since firstDetectedIndex */
  age: number
  /**
   * 0–10 evidence-weighted strength score.
   * ENGINE_RULES.md §12.6 scoring algorithm.
   */
  strength: number
  /** 0–10 evidence alignment score */
  confidence: number
  /** Human-readable strings explaining this zone's properties */
  evidence: string[]
}

export interface SupportResistanceConfig {
  /**
   * Zone half-width = ATR × atrMultiplier, so total zone width = 2 × this × ATR.
   *
   * DERIVATION (default 0.25 → zone width = 0.5 ATR = half a typical bar range):
   *
   * A support/resistance level is a band, not a price. The band must be wide
   * enough that ordinary wick noise still registers as a touch, and narrow
   * enough that a touch remains discriminating.
   *
   *   Too LARGE (≥ 1.0 ATR width): a single average bar spans the entire zone,
   *     so essentially every bar "touches" it. touchCount inflates, every zone
   *     scores as strong, and the strength ranking loses all discriminating
   *     power — the failure mode is that everything looks like support.
   *   Too SMALL (≤ 0.1 ATR width): the band is thinner than routine wick noise,
   *     so price repeatedly steps over the level without registering. touchCount
   *     collapses and the minTouchCount ≥ 2 filter rejects genuine levels — the
   *     failure mode is that real support disappears.
   *   At 0.5 ATR width an average bar spans two zone-widths, so a touch means
   *     price actually visited the level rather than merely passing through the
   *     neighbourhood. This is the largest width that keeps a touch informative.
   *
   * SCALING: expressed in ATR, so it scales automatically with volatility
   * regime and with timeframe — the same multiplier is correct on 15m and 1D.
   *
   * PROVENANCE: heuristic. The reasoning above bounds the value between roughly
   * 0.15 and 0.4; 0.25 sits in the middle of that defensible range. It is not
   * fitted against resolved outcomes.
   */
  atrMultiplier: number
  /**
   * Two zones of the same type merge when the empty gap between them is
   * smaller than ATR × mergeTolerance.
   *
   * DERIVED, NOT INDEPENDENT: the correct merge distance is exactly one zone
   * width, i.e. mergeTolerance = 2 × atrMultiplier. Two levels separated by
   * less than the width of a single zone are not resolvable as distinct
   * levels — treating them as separate double-counts one level and splits its
   * touch history across two weaker zones.
   *
   * The default (0.5) already satisfies 2 × 0.25, so this is a statement of an
   * existing invariant rather than a change. It is kept configurable because
   * overriding atrMultiplier alone must not silently break the relationship;
   * DEFAULT_CONFIG derives it explicitly so the two cannot drift apart.
   */
  mergeTolerance: number
  /**
   * Minimum touches for a zone to appear in output.
   * Default: 2
   */
  minTouchCount: number
  /**
   * Candles after which a zone is archived.
   * Default: 200
   */
  maxZoneAge: number
  /**
   * How many candles back to scan for zone-forming swings.
   * Default: 100
   */
  lookback: number
  /**
   * Zone strength begins decaying after this many candles of no interaction.
   * Default: 50
   */
  strengthDecayAge: number
}

export interface SupportResistanceResult {
  /** All detected zones sorted by center descending */
  zones: PriceZone[]
  /** Non-broken support zones sorted by center descending (nearest first when below price) */
  activeSupport: PriceZone[]
  /** Non-broken resistance zones sorted by center ascending (nearest first when above price) */
  activeResistance: PriceZone[]
  /** Highest active support zone whose upper < currentPrice */
  nearestSupport: PriceZone | null
  /** Lowest active resistance zone whose lower > currentPrice */
  nearestResistance: PriceZone | null
  /** Zone whose range contains the current price */
  currentZone: PriceZone | null
  /** Human-readable summary of key zones */
  evidence: string[]
}
