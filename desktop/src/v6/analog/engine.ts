/**
 * AnalogEngine — SKELETON ONLY (Phase 2 will implement retrieval).
 *
 * This is the only module in V6 that will ever be permitted to make a claim
 * about what happens next, and it will do so in exactly one way: by reporting
 * what actually followed, historically, in situations similar to this one.
 * Every number it emits will be a measured frequency with a sample count, not
 * a weight anyone chose.
 *
 * Phase 1 ships the interfaces and a null corpus. `retrieve` therefore always
 * returns "insufficient corpus", which is the correct answer when there is no
 * corpus — not a placeholder to be replaced by optimism later.
 *
 * ── WHY THE INTERFACE LOOKS LIKE THIS ────────────────────────────────────────
 *
 * `sampleSize` and `interval` are mandatory on every forward estimate, not
 * optional extras. A frequency without a sample count is indistinguishable
 * from an opinion, and V5's defining failure was 86 numbers that looked like
 * measurements and were not. Making the evidence non-optional at the type level
 * means a future implementation cannot forget to carry it.
 *
 * ── TEMPORAL SEPARATION IS A CORRECTNESS REQUIREMENT ─────────────────────────
 *
 * A retrieved analog must not overlap the query window, and its forward outcome
 * must lie strictly after the query's last bar. Without that, retrieval leaks
 * future information into the present and every backtest built on it is
 * invalid. It is stated here, in the contract, rather than left to the
 * implementation to remember.
 */
import type { Unavailable } from '../../modules/common/availability'
import { unavailable } from '../../modules/common/availability'
import type { TrajectoryPoint } from '../trajectory/types'
import type { Situation } from '../situation/types'

/** What we are asking about. */
export interface AnalogQuery {
  /** The situation's reference-class key — narrows the candidate set. */
  readonly situation: Situation
  /** The recent shape, oldest first. Distance is computed over this. */
  readonly shape: readonly TrajectoryPoint[]
  /** Horizons, in bars, at which the forward outcome is measured. */
  readonly horizons: readonly number[]
}

/** One historical occurrence judged similar to the query. */
export interface AnalogMatch {
  readonly symbol: string
  readonly timeframe: string
  /** Open time of the analog's last bar — the moment it "looked like now". */
  readonly asOf: number
  /** Distance in the trajectory metric. Smaller is more similar. */
  readonly distance: number
}

/**
 * What happened after the analogs, at one horizon.
 *
 * Deliberately a DISTRIBUTION, not a direction. "Up 63% of 340" is a statement
 * about history that can be checked; "bullish" is not.
 */
export interface ForwardEstimate {
  readonly horizonBars: number
  /** Fractions summing to 1 across the three outcomes. */
  readonly upShare: number
  readonly downShare: number
  readonly flatShare: number
  /** Median favourable and adverse excursion, in ATR units. */
  readonly medianFavourableAtr: number
  readonly medianAdverseAtr: number
  /** Number of analogs behind this estimate. Never optional. */
  readonly sampleSize: number
  /** Wilson interval half-width on the dominant share. Never optional. */
  readonly intervalHalfWidth: number
}

export type AnalogResult =
  | {
    readonly ok: true
    readonly matches: readonly AnalogMatch[]
    readonly estimates: readonly ForwardEstimate[]
    readonly unavailable: null
  }
  | {
    readonly ok: false
    readonly matches: readonly []
    readonly estimates: readonly []
    readonly unavailable: Unavailable
  }

/**
 * A searchable body of historical situations.
 *
 * An interface rather than a class so Phase 2 can swap an in-memory corpus for
 * a persisted one without touching any caller, and so tests can inject a fixed
 * corpus and get deterministic retrieval.
 */
export interface AnalogCorpus {
  /** Total situations held. Zero means retrieval is impossible, not empty. */
  size(): number
  /** Situations sharing a reference-class key. */
  countForKey(key: string): number
}

/** The Phase 1 corpus: genuinely empty, and honest about it. */
export const EMPTY_CORPUS: AnalogCorpus = {
  size: () => 0,
  countForKey: () => 0,
}

/**
 * Minimum analogs before an estimate may be published.
 *
 * PROVENANCE: heuristic, and explicitly a placeholder. The defensible value is
 * the sample size at which the Wilson interval becomes narrow enough for the
 * estimate to beat the unconditional base rate — a quantity that can only be
 * computed once a corpus exists. Phase 3 replaces this with that computation.
 * It is named and documented rather than inlined so it cannot quietly become
 * permanent.
 */
export const MIN_SAMPLE_SIZE = 30

/**
 * Retrieve analogs for a query.
 *
 * Phase 1: always unavailable, because the corpus is empty. This is not a stub
 * that lies — it is the correct result for the data available.
 */
export function retrieve(query: AnalogQuery, corpus: AnalogCorpus = EMPTY_CORPUS): AnalogResult {
  const total = corpus.size()
  if (total === 0) {
    return {
      ok: false, matches: [], estimates: [],
      unavailable: unavailable('insufficient-history',
        'No historical corpus is loaded, so no analog can be retrieved. Retrieval is implemented in Phase 2.'),
    }
  }

  const forKey = corpus.countForKey(query.situation.signature.key)
  if (forKey < MIN_SAMPLE_SIZE) {
    return {
      ok: false, matches: [], estimates: [],
      unavailable: unavailable('insufficient-history',
        `Only ${forKey} historical occurrences of situation '${query.situation.signature.key}'; `
        + `${MIN_SAMPLE_SIZE} are required before an estimate can be published.`),
    }
  }

  // Phase 2 implements distance computation and outcome measurement here.
  return {
    ok: false, matches: [], estimates: [],
    unavailable: unavailable('not-applicable',
      'Analog retrieval is not implemented yet (Phase 2). The corpus is populated but no estimate is produced.'),
  }
}
