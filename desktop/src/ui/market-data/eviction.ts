/**
 * Eviction policy — pure decision logic, deliberately separated from
 * CandleStore's mechanism (closing sockets, flushing persistence, deleting
 * map entries).
 *
 * This is the one piece of CandleStore extracted into its own module: the
 * SELECTION of which series to evict is a pure function of a few scalar
 * fields and is independently testable without a provider, persistence
 * layer, or async plumbing. Gap repair was considered for the same
 * treatment and rejected — it is inherently a sequence of side-effecting,
 * provider-dependent async steps; extracting it would just relocate the
 * same complexity into a differently-shaped wrapper without a real
 * interface boundary, which is not a improvement.
 */

export interface EvictionCandidate {
  key: string
  listenerCount: number
  /** True while any async operation (initial load, backfill, gap repair) is in flight for this entry. */
  busy: boolean
  lastAccess: number
}

/**
 * Selects which series should be evicted, given the current set of known
 * series and the maximum number of INACTIVE, IDLE series to retain.
 *
 * A series is only eligible for eviction when it has zero listeners AND is
 * not busy. Busy entries are exempt even when they have zero listeners —
 * fetchSnapshot() and prefetch() both operate on zero-listener entries by
 * design, and evicting one out from under an in-flight load would silently
 * truncate its result and force a redundant reload on next access.
 *
 * This means busy-but-inactive entries do not count against the cap while
 * they're busy — the cap only bounds the IDLE inactive population. Total
 * series in memory can therefore transiently exceed maxCached under heavy
 * concurrent background activity; it settles back down as soon as the busy
 * entries finish and become eligible on the next call. This is a deliberate
 * tradeoff: a soft, temporary overshoot is preferable to ever evicting data
 * something is actively using.
 */
export function selectEvictionCandidates(
  entries: EvictionCandidate[],
  maxCached: number,
): string[] {
  const evictable = entries.filter(e => e.listenerCount === 0 && !e.busy)
  if (evictable.length <= maxCached) return []

  evictable.sort((a, b) => a.lastAccess - b.lastAccess)
  return evictable.slice(0, evictable.length - maxCached).map(e => e.key)
}
