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
   * Zone half-width = ATR × atrMultiplier.
   * Default: 0.25
   */
  atrMultiplier: number
  /**
   * Two zones merge when gap < ATR × mergeTolerance.
   * Default: 0.5
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
