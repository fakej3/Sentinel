import { describe, it, expect } from 'vitest'
import { selectEvictionCandidates } from '../eviction'
import type { EvictionCandidate } from '../eviction'

function candidate(key: string, opts: Partial<EvictionCandidate> = {}): EvictionCandidate {
  return { key, listenerCount: 0, busy: false, lastAccess: 0, ...opts }
}

describe('selectEvictionCandidates', () => {
  it('evicts nothing when idle count is at or below the cap', () => {
    const entries = [candidate('a'), candidate('b'), candidate('c')]
    expect(selectEvictionCandidates(entries, 3)).toEqual([])
    expect(selectEvictionCandidates(entries, 5)).toEqual([])
  })

  it('never selects entries with active listeners, regardless of age', () => {
    const entries = [
      candidate('active-oldest', { listenerCount: 1, lastAccess: 0 }),
      candidate('idle-1', { lastAccess: 10 }),
      candidate('idle-2', { lastAccess: 20 }),
    ]
    expect(selectEvictionCandidates(entries, 1)).toEqual(['idle-1'])
  })

  it('never selects busy entries, even when idle and oldest', () => {
    const entries = [
      candidate('busy-oldest', { busy: true, lastAccess: 0 }),
      candidate('idle-1', { lastAccess: 10 }),
      candidate('idle-2', { lastAccess: 20 }),
      candidate('idle-3', { lastAccess: 30 }),
    ]
    // Cap of 2 idle-and-safe entries: idle-1 is the oldest SAFE one, evicted.
    // busy-oldest is exempt even though it's the actual oldest overall.
    expect(selectEvictionCandidates(entries, 2)).toEqual(['idle-1'])
  })

  it('evicts oldest-by-lastAccess first among safe candidates', () => {
    const entries = [
      candidate('newest', { lastAccess: 300 }),
      candidate('oldest', { lastAccess: 100 }),
      candidate('middle', { lastAccess: 200 }),
    ]
    expect(selectEvictionCandidates(entries, 1)).toEqual(['oldest', 'middle'])
  })

  it('busy-but-idle entries do not count against the cap', () => {
    // 5 idle entries, 3 of them busy. Cap = 2. Only the 2 safe (non-busy)
    // idle entries beyond the cap of 2 safe ones should be considered —
    // here there are exactly 2 safe entries, so nothing is evicted even
    // though total idle count (5) exceeds the cap.
    const entries = [
      candidate('busy-1', { busy: true, lastAccess: 1 }),
      candidate('busy-2', { busy: true, lastAccess: 2 }),
      candidate('busy-3', { busy: true, lastAccess: 3 }),
      candidate('safe-1', { lastAccess: 4 }),
      candidate('safe-2', { lastAccess: 5 }),
    ]
    expect(selectEvictionCandidates(entries, 2)).toEqual([])
  })

  it('returns an empty array for an empty input', () => {
    expect(selectEvictionCandidates([], 6)).toEqual([])
  })

  it('handles a cap of zero by evicting all safe candidates', () => {
    const entries = [candidate('a', { lastAccess: 1 }), candidate('b', { lastAccess: 2 })]
    expect(selectEvictionCandidates(entries, 0)).toEqual(['a', 'b'])
  })
})
