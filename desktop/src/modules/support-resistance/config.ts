import type { SupportResistanceConfig } from './types'

/**
 * Zone half-width in ATR units. The single free geometry parameter of this
 * module — every other distance constant below is derived from it.
 * Full derivation and failure-mode analysis in types.ts.
 */
const ATR_HALF_WIDTH = 0.25

export const DEFAULT_CONFIG: SupportResistanceConfig = {
  atrMultiplier: ATR_HALF_WIDTH,

  // Merge when the gap between two same-type zones is smaller than one full
  // zone width. Written as the derivation rather than the literal 0.5 so the
  // invariant cannot silently drift if the half-width is ever retuned.
  mergeTolerance: 2 * ATR_HALF_WIDTH,

  /**
   * Minimum touches before a zone is reported.
   *
   * A swing point is created BY a single touch, so touchCount === 1 carries no
   * information beyond "a swing happened here" — that is already represented as
   * a swing. Requiring 2 means the level was revisited, which is the weakest
   * possible evidence that participants are transacting around it.
   * Raising to 3+ would discard genuine fresh levels that have only been
   * retested once; those are exactly the levels a trader watches most closely.
   *
   * PROVENANCE: derived. 2 is the minimum integer expressing "revisited".
   */
  minTouchCount: 2,

  /**
   * Candles after which a zone is archived regardless of quality.
   *
   * PROVENANCE: heuristic. 200 bars is the same horizon as the longest EMA the
   * engine computes, so a zone survives exactly as long as the slowest trend
   * reference that could still contextualise it. Not fitted.
   */
  maxZoneAge: 200,

  /**
   * How far back swing points are harvested into zone candidates.
   *
   * PROVENANCE: heuristic. Half of maxZoneAge — a zone must have room to age
   * and be tested within the archive horizon after it is created, otherwise
   * zones would be born already close to expiry.
   */
  lookback: 100,

  /**
   * Candles of inactivity after which a zone's strength begins to decay.
   *
   * PROVENANCE: heuristic. Half of lookback: a level untouched for longer than
   * the window in which it could have been re-formed is losing relevance.
   * Not fitted.
   */
  strengthDecayAge: 50,
}
