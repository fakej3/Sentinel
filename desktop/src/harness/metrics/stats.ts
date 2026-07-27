/**
 * Shared statistical primitives.
 *
 * Every function here has one textbook definition and no options that quietly
 * change it. Where a convention has to be chosen (population vs sample
 * variance, how ties are ranked, what a metric returns when it is undefined)
 * the choice is stated in the docstring and tested against a published value.
 *
 * NOTHING here returns a plausible-looking number for an empty or degenerate
 * input. An undefined statistic returns `null`, and callers must handle it.
 * Returning 0 for "no data" is how a report ends up claiming a Sharpe ratio for
 * a slice with two observations.
 */

/**
 * Compensated (Neumaier) summation.
 *
 * Naive left-to-right addition loses low-order bits, and the loss depends on
 * the order of the terms — so pooling the same observations in a different
 * order changes the last digits of every mean, Brier score and expectancy in
 * the report. That is not a correctness bug, but in a framework whose whole
 * claim is reproducibility it is worth not having.
 *
 * Neumaier's variant tracks the rounding error in `c` and adds it back at the
 * end, handling the case where the running total is SMALLER than the next term
 * (which Kahan's original does not). It reduces the drift by many orders of
 * magnitude; it does not make addition associative, so results remain
 * order-invariant only to within floating point, and the tests assert that
 * rather than byte equality.
 */
export function sum(xs: readonly number[]): number {
  let s = 0
  let c = 0
  for (const x of xs) {
    const t = s + x
    c += Math.abs(s) >= Math.abs(x) ? (s - t) + x : (x - t) + s
    s = t
  }
  return s + c
}

/** Arithmetic mean. null for an empty array. */
export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  return sum(xs) / xs.length
}

/**
 * SAMPLE variance, denominator n − 1 (Bessel's correction).
 *
 * Sample rather than population, because every array here is a sample of a
 * process rather than an enumerated population. Requires n >= 2; returns null
 * for n < 2, where the statistic genuinely does not exist.
 */
export function variance(xs: readonly number[]): number | null {
  if (xs.length < 2) return null
  const m = mean(xs)!
  return sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1)
}

export function stdev(xs: readonly number[]): number | null {
  const v = variance(xs)
  return v === null ? null : Math.sqrt(v)
}

/**
 * Quantile by linear interpolation between order statistics — the R type-7
 * definition, which is also numpy's and pandas' default.
 *
 *     h = (n − 1)·q ,   Q = x[⌊h⌋] + (h − ⌊h⌋)·(x[⌊h⌋+1] − x[⌊h⌋])
 *
 * `xs` need not be sorted; a copy is sorted internally.
 */
export function quantile(xs: readonly number[], q: number): number | null {
  if (xs.length === 0) return null
  if (!(q >= 0 && q <= 1)) throw new Error(`quantile: q must be in [0, 1], got ${q}`)
  const s = [...xs].sort((a, b) => a - b)
  if (s.length === 1) return s[0]
  const h = (s.length - 1) * q
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return s[lo] + (h - lo) * (s[hi] - s[lo])
}

export function median(xs: readonly number[]): number | null {
  return quantile(xs, 0.5)
}

/**
 * Fractional ranks with TIES AVERAGED — the tie convention Spearman's rho
 * requires.
 *
 * Ties are not an edge case here: Sentinel's confidence score is produced by
 * summing a small number of discrete weights, so identical scores are common.
 * Ranking ties arbitrarily (by input order) would make the correlation depend
 * on the order observations happened to be recorded, which is not a statistic.
 *
 * Ranks are 1-based.
 */
export function rank(xs: readonly number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array<number>(xs.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++
    // Positions i..j (0-based) tie; their averaged 1-based rank:
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[idx[k].i] = r
    i = j + 1
  }
  return out
}

/**
 * Pearson product-moment correlation.
 *
 * null when n < 2 or either input has zero variance — a constant vector has no
 * correlation with anything, and reporting 0 would suggest "measured, and
 * independent" rather than "undefined".
 */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length) throw new Error(`pearson: length mismatch ${xs.length} vs ${ys.length}`)
  if (xs.length < 2) return null
  const mx = mean(xs)!
  const my = mean(ys)!
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

/** Spearman's rho: Pearson correlation of the tie-averaged ranks. */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length) throw new Error(`spearman: length mismatch ${xs.length} vs ${ys.length}`)
  return pearson(rank(xs), rank(ys))
}

/**
 * Two-sided Wald confidence interval for a proportion, on the LOG-ODDS scale.
 *
 * The textbook `p ± z·sqrt(p(1−p)/n)` interval can extend past [0, 1] and has
 * poor coverage near the boundaries — exactly where a hit rate of 0.85 on 40
 * trades lands. Transforming through the logit keeps the interval inside (0,1)
 * and has markedly better small-sample coverage.
 *
 * Returns null when the statistic is degenerate (n = 0, or k = 0 or n, where
 * the log-odds are infinite). A null interval is the honest output; a
 * fabricated one would be quoted as if measured.
 */
export function proportionCI(
  successes: number,
  n: number,
  z = 1.959963984540054,   // two-sided 95%
): { lower: number; upper: number } | null {
  if (n <= 0 || successes < 0 || successes > n) return null
  if (successes === 0 || successes === n) return null
  const p = successes / n
  const logit = Math.log(p / (1 - p))
  const se = Math.sqrt(1 / (n * p * (1 - p)))
  const inv = (l: number): number => 1 / (1 + Math.exp(-l))
  return { lower: inv(logit - z * se), upper: inv(logit + z * se) }
}

/** Finite values only. The single place absence is filtered, so it is filtered the same way everywhere. */
export function finite(xs: readonly (number | null | undefined)[]): number[] {
  const out: number[] = []
  for (const x of xs) if (typeof x === 'number' && Number.isFinite(x)) out.push(x)
  return out
}
