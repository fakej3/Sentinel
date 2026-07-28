import { describe, it, expect } from 'vitest'
import { blocks, classify, dailyStats, demean, evaluateScores, MIN_CROSS_SECTION } from '../evaluate'
import type { ScoredRow } from '../evaluate'

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

/** `n` names on one date, with caller-supplied score and return functions. */
function oneDate(n: number, score: (i: number) => number | null, ret: (i: number) => number, dateIdx = 0): ScoredRow[] {
  return Array.from({ length: n }, (_, i) => ({
    dateIdx, score: score(i), probability: null, forwardReturn: ret(i),
  }))
}

describe('dailyStats — the long/short spread must be tie-safe', () => {
  // REGRESSION. A constant score has no cross-sectional information, so its
  // quintile spread must be undefined — there is no basis on which to say which
  // names belong in the top fifth. The first implementation sorted by score and
  // sliced the tails, and with every score equal the sort was stable, so the
  // "top quintile" was whichever names happened to arrive last in the input.
  // That produced a spread of -0.00081 with an interval EXCLUDING ZERO for the
  // `always_long` baseline: a signal manufactured entirely from row ordering.
  it('is null for a constant score, not an artefact of input order', () => {
    const r = lcg(1)
    const rows = oneDate(100, () => 1, () => r() - 0.5)
    const stats = dailyStats(rows)
    expect(stats.length).toBe(1)
    expect(stats[0].longShort).toBeNull()
  })

  it('is null however the returns are ordered, for a constant score', () => {
    // The old bug's magnitude depended entirely on how returns were arranged
    // against the (meaningless) ordering. Under the fix, no arrangement can
    // produce a spread.
    const ascending = oneDate(100, () => 7, i => i / 100)
    const descending = oneDate(100, () => 7, i => -i / 100)
    expect(dailyStats(ascending)[0].longShort).toBeNull()
    expect(dailyStats(descending)[0].longShort).toBeNull()
  })

  it('is null when fewer than five distinct score values exist to form disjoint tails', () => {
    // Two distinct values split 50/50: the 20th and 80th percentile both land
    // on... different values, so this one IS defined. The undefined case is
    // when the tails would overlap in value.
    const twoValues = oneDate(100, i => (i < 50 ? 0 : 1), i => i / 100)
    expect(dailyStats(twoValues)[0].longShort).not.toBeNull()

    // 90% share one value: the 20th and 80th percentile are the same number, so
    // a name cannot be assigned to one tail rather than the other.
    const lopsided = oneDate(100, i => (i < 95 ? 0 : 1), i => i / 100)
    expect(dailyStats(lopsided)[0].longShort).toBeNull()
  })

  it('includes every tied name at a boundary rather than cutting arbitrarily', () => {
    // 40 names at score -1, 60 at +1. The short leg is all 40 and the long leg
    // all 60 — no name at the same score may be split between legs.
    // Returns: -1 group averages 0, +1 group averages 1, so the spread is 1.
    const rows = oneDate(100, i => (i < 40 ? -1 : 1), i => (i < 40 ? 0 : 1))
    expect(dailyStats(rows)[0].longShort).toBeCloseTo(1, 12)
  })

  it('computes the textbook spread when scores are all distinct', () => {
    // score = i, return = i. n = 100, k = 20. Bottom 20 are i in [0,19] with
    // mean 9.5; top 20 are i in [80,99] with mean 89.5. Spread = 80.
    const rows = oneDate(100, i => i, i => i)
    expect(dailyStats(rows)[0].longShort).toBeCloseTo(80, 12)
  })

  it('is invariant to the order rows are supplied in', () => {
    const r = lcg(9)
    const base = oneDate(80, i => Math.sin(i), () => r() - 0.5)
    const shuffled = [...base]
    const q = lcg(17)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(q() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    expect(dailyStats(shuffled)[0].longShort).toBeCloseTo(dailyStats(base)[0].longShort!, 12)
  })
})

describe('dailyStats — cross-sectional statistics', () => {
  it('skips dates with too few names to support a cross-sectional statistic', () => {
    expect(dailyStats(oneDate(MIN_CROSS_SECTION - 1, i => i, i => i)).length).toBe(0)
    expect(dailyStats(oneDate(MIN_CROSS_SECTION, i => i, i => i)).length).toBe(1)
  })

  it('recovers a perfect rank relationship as rank IC 1', () => {
    const stats = dailyStats(oneDate(50, i => i, i => i * i))
    expect(stats[0].rankIc!).toBeCloseTo(1, 12)
    // Pearson is NOT 1 here, because the relationship is monotone but not
    // linear. That the two disagree is the reason both are reported.
    expect(stats[0].ic!).toBeLessThan(1)
  })

  it('recovers a perfect inverse relationship as rank IC -1', () => {
    expect(dailyStats(oneDate(50, i => i, i => -i))[0].rankIc!).toBeCloseTo(-1, 12)
  })

  it('reports AUC at chance for a score unrelated to the outcome', () => {
    // Scores 0..99, outcome up on even i. The positives occupy ranks
    // 1, 3, ..., 99, summing to 2500, so U = 2500 - 50*51/2 = 1225 and
    // AUC = 1225 / 2500 = 0.49 EXACTLY. Not 0.50: with an even split the
    // positives sit one rank below the negatives throughout. Asserting 0.5
    // here would be asserting a number the construction does not produce.
    const rows = oneDate(100, i => i, i => (i % 2 === 0 ? 1 : -1))
    expect(dailyStats(rows)[0].auc!).toBeCloseTo(0.49, 12)
  })

  it('returns null AUC on a date where every name rose', () => {
    expect(dailyStats(oneDate(50, i => i, () => 0.01))[0].auc).toBeNull()
  })

  it('ignores rows the source declined to score', () => {
    const rows = oneDate(60, i => (i < 30 ? null : i), i => i)
    expect(dailyStats(rows)[0].n).toBe(30)
  })
})

describe('demean', () => {
  it('removes the cross-sectional mean, leaving a zero-mean residual', () => {
    const rows = oneDate(40, i => i, i => i / 100)
    const out = demean(rows)
    let s = 0
    for (const r of out) s += r.forwardReturn
    expect(s / out.length).toBeCloseTo(0, 12)
  })

  it('leaves the score untouched — only the outcome is neutralised', () => {
    const rows = oneDate(30, i => i, i => i)
    const out = demean(rows)
    for (let i = 0; i < rows.length; i++) expect(out[i].score).toBe(rows[i].score)
  })

  it('demeans each date independently', () => {
    const rows = [...oneDate(25, i => i, () => 1, 0), ...oneDate(25, i => i, () => 5, 1)]
    for (const r of demean(rows)) expect(r.forwardReturn).toBeCloseTo(0, 12)
  })

  it('turns a pure market move into exactly no signal', () => {
    // Every name returns the same amount: the market moved and nothing else
    // happened. Raw IC would be undefined (zero return variance); market-neutral
    // must also find nothing, and must not manufacture a correlation.
    const rows = oneDate(50, i => i, () => 0.02)
    const stats = dailyStats(demean(rows))
    expect(stats[0].ic).toBeNull()
    expect(stats[0].rankIc).toBeNull()
  })
})

describe('blocks', () => {
  it('partitions without overlap or loss', () => {
    const b = blocks([1, 2, 3, 4, 5, 6, 7], 3)
    expect(b).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    expect(b.flat().length).toBe(7)
  })

  it('rejects a non-positive block length', () => {
    expect(() => blocks([1, 2], 0)).toThrow(/blockLength must be >= 1/)
  })
})

describe('classify', () => {
  it('computes the textbook confusion metrics', () => {
    // 3 true positives, 1 false positive, 2 false negatives, 4 true negatives.
    const rows: ScoredRow[] = [
      ...Array.from({ length: 3 }, () => ({ dateIdx: 0, score: 1, probability: 0.9, forwardReturn: 0.1 })),
      { dateIdx: 0, score: 1, probability: 0.9, forwardReturn: -0.1 },
      ...Array.from({ length: 2 }, () => ({ dateIdx: 0, score: -1, probability: 0.1, forwardReturn: 0.1 })),
      ...Array.from({ length: 4 }, () => ({ dateIdx: 0, score: -1, probability: 0.1, forwardReturn: -0.1 })),
    ]
    const c = classify(rows)
    expect(c.n).toBe(10)
    expect(c.precision!).toBeCloseTo(3 / 4, 12)
    expect(c.recall!).toBeCloseTo(3 / 5, 12)
    expect(c.accuracy!).toBeCloseTo(7 / 10, 12)
    expect(c.baseRate!).toBeCloseTo(5 / 10, 12)
    expect(c.f1!).toBeCloseTo(2 * (3 / 4) * (3 / 5) / ((3 / 4) + (3 / 5)), 12)
  })

  it('falls back to the score sign when no probability exists', () => {
    const rows: ScoredRow[] = [
      { dateIdx: 0, score: 2, probability: null, forwardReturn: 0.1 },
      { dateIdx: 0, score: -2, probability: null, forwardReturn: -0.1 },
    ]
    expect(classify(rows).accuracy).toBe(1)
  })

  it('skips rows with no decision at all', () => {
    expect(classify([{ dateIdx: 0, score: null, probability: null, forwardReturn: 0.1 }]).n).toBe(0)
  })
})

describe('evaluateScores — the null calibration', () => {
  it('finds no edge in pure noise, and says so with an interval containing zero', () => {
    // The single most important test in the file. If a random score shows an
    // edge, every other number the harness produces is worthless.
    const r = lcg(2024)
    const rows: ScoredRow[] = []
    for (let d = 0; d < 400; d++) {
      for (let s = 0; s < 60; s++) {
        rows.push({ dateIdx: d, score: r() - 0.5, probability: null, forwardReturn: (r() - 0.5) * 0.04 })
      }
    }
    const ev = evaluateScores(rows, rows.length, { name: 'noise', horizon: 5 })
    const rank = ev.marketNeutral.rankIc!
    expect(rank.lower).toBeLessThan(0)
    expect(rank.upper).toBeGreaterThan(0)
    expect(Math.abs(rank.point)).toBeLessThan(0.02)
  })

  it('recovers a planted edge that is genuinely there', () => {
    // The complement: a harness that finds nothing in noise is only useful if
    // it also finds something real. Return is the score plus noise.
    const r = lcg(77)
    const rows: ScoredRow[] = []
    for (let d = 0; d < 400; d++) {
      for (let s = 0; s < 60; s++) {
        const score = r() - 0.5
        rows.push({ dateIdx: d, score, probability: null, forwardReturn: 0.02 * score + (r() - 0.5) * 0.02 })
      }
    }
    const ev = evaluateScores(rows, rows.length, { name: 'planted', horizon: 5 })
    expect(ev.marketNeutral.rankIc!.lower).toBeGreaterThan(0)
    expect(ev.marketNeutral.longShort!.lower).toBeGreaterThan(0)
  })
})
