/**
 * Statistical inference for the Phase 4 validation study.
 *
 * Every test here answers "could this have happened by chance?" and every one
 * of them is reported with an effect size, because a p-value without an effect
 * size tells you the sample was large, not that the finding matters.
 *
 * TWO STANDING HAZARDS, both handled explicitly:
 *
 * 1. DEPENDENCE. Observations from one series overlap in time even at
 *    stride = max(horizon), because the underlying price path is shared. Where
 *    a statistic is computed across series, `blockBootstrap` resamples whole
 *    SERIES rather than individual trades, so the resampling unit matches the
 *    unit of independence.
 *
 * 2. MULTIPLICITY. This study runs hundreds of tests. Benjamini–Hochberg
 *    controls the false discovery rate across a declared family; every reported
 *    q-value names the family it was computed within. Bonferroni is offered for
 *    the few cases where a single false positive would be costly.
 */
import { mean, quantile, stdev, sum } from '../metrics/stats'
import { rng } from '../sources'

export interface Estimate {
  readonly point: number
  readonly lower: number
  readonly upper: number
  readonly n: number
  readonly method: string
}

/**
 * Percentile bootstrap CI over i.i.d. draws.
 *
 * Percentile rather than normal-approximation: R multiples are heavily skewed
 * (a capped downside against an uncapped upside), so a symmetric interval
 * around the mean would be wrong on both sides.
 */
export function bootstrapMean(xs: readonly number[], iterations = 5000, seed = 1, alpha = 0.05): Estimate | null {
  if (xs.length < 2) return null
  const r = rng(seed)
  const draws: number[] = []
  for (let b = 0; b < iterations; b++) {
    let s = 0
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(r() * xs.length)]
    draws.push(s / xs.length)
  }
  return {
    point: mean(xs)!,
    lower: quantile(draws, alpha / 2)!,
    upper: quantile(draws, 1 - alpha / 2)!,
    n: xs.length,
    method: `percentile bootstrap (${iterations} iterations)`,
  }
}

/**
 * Block bootstrap: resamples whole GROUPS, not individual observations.
 *
 * The correct unit when observations within a group share a price path. Using
 * an i.i.d. bootstrap on dependent data produces intervals that are too narrow
 * by roughly sqrt(average group size), which is exactly the inflation this
 * project has already been caught by once.
 */
export function blockBootstrapMean(
  groups: readonly (readonly number[])[],
  iterations = 5000,
  seed = 1,
  alpha = 0.05,
): Estimate | null {
  const flat = groups.flat()
  if (groups.length < 2 || flat.length < 2) return null
  const r = rng(seed)
  const draws: number[] = []
  for (let b = 0; b < iterations; b++) {
    const pooled: number[] = []
    for (let g = 0; g < groups.length; g++) pooled.push(...groups[Math.floor(r() * groups.length)])
    if (pooled.length > 0) draws.push(sum(pooled) / pooled.length)
  }
  if (draws.length === 0) return null
  return {
    point: mean(flat)!,
    lower: quantile(draws, alpha / 2)!,
    upper: quantile(draws, 1 - alpha / 2)!,
    n: flat.length,
    method: `block bootstrap over ${groups.length} groups (${iterations} iterations)`,
  }
}

export interface TestResult {
  readonly statistic: number
  readonly pValue: number
  readonly effectSize: number
  readonly effectSizeName: string
  readonly n: number
  readonly test: string
}

/** Normal CDF via Abramowitz & Stegun 7.1.26 — accurate to ~1.5e-7, ample for p-values. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp(-z * z / 2)
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - p : p
}

/**
 * One-sample t-test that the mean is zero, with Cohen's d.
 *
 * Uses the normal approximation for the p-value. At n > 100 — which every test
 * in this study satisfies — the difference from the exact t distribution is
 * below the third decimal, well inside the precision anything is reported to.
 */
export function tTestMeanZero(xs: readonly number[]): TestResult | null {
  if (xs.length < 3) return null
  const m = mean(xs)!
  const sd = stdev(xs)!
  if (sd === 0) return null
  const t = m / (sd / Math.sqrt(xs.length))
  return {
    statistic: t,
    pValue: 2 * (1 - normalCdf(Math.abs(t))),
    effectSize: m / sd,
    effectSizeName: "Cohen's d",
    n: xs.length,
    test: 'one-sample t (mean = 0), normal approximation',
  }
}

/**
 * Mann–Whitney U, two-sided, with the rank-biserial correlation as effect size.
 *
 * Distribution-free, so it does not assume the symmetric light tails that a
 * t-test does — which matters here because R multiples are skewed. The
 * rank-biserial correlation is reported rather than a difference of means
 * because it is what the test actually measures: P(a > b) − P(b > a).
 */
export function mannWhitney(a: readonly number[], b: readonly number[]): TestResult | null {
  const na = a.length, nb = b.length
  if (na < 2 || nb < 2) return null
  const all = [...a.map(v => ({ v, g: 0 })), ...b.map(v => ({ v, g: 1 }))]
  all.sort((x, y) => x.v - y.v)

  const ranks = new Array<number>(all.length)
  let i = 0
  let tieCorrection = 0
  while (i < all.length) {
    let j = i
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++
    const r = (i + j) / 2 + 1
    const t = j - i + 1
    if (t > 1) tieCorrection += t * t * t - t
    for (let k = i; k <= j; k++) ranks[k] = r
    i = j + 1
  }

  let rankSumA = 0
  for (let k = 0; k < all.length; k++) if (all[k].g === 0) rankSumA += ranks[k]
  const u = rankSumA - (na * (na + 1)) / 2

  const n = na + nb
  const muU = (na * nb) / 2
  const sigmaU = Math.sqrt((na * nb / 12) * ((n + 1) - tieCorrection / (n * (n - 1))))
  if (sigmaU === 0) return null
  const z = (u - muU) / sigmaU

  return {
    statistic: u,
    pValue: 2 * (1 - normalCdf(Math.abs(z))),
    // Rank-biserial: 2U/(na·nb) − 1, in [−1, 1].
    effectSize: (2 * u) / (na * nb) - 1,
    effectSizeName: 'rank-biserial correlation',
    n,
    test: 'Mann–Whitney U, two-sided, tie-corrected',
  }
}

/**
 * McNemar's test on PAIRED binary outcomes — the right test when comparing two
 * classifiers on the same samples.
 *
 * An unpaired two-proportion test would ignore that both predictors saw
 * identical data and would be badly conservative when they agree often, which
 * two strategies on the same price path always do.
 *
 * Uses the exact binomial when discordant pairs are few, the normal
 * approximation otherwise.
 */
export function mcNemar(aCorrect: readonly boolean[], bCorrect: readonly boolean[]): TestResult | null {
  if (aCorrect.length !== bCorrect.length) throw new Error('mcNemar: length mismatch')
  let b = 0, c = 0
  for (let i = 0; i < aCorrect.length; i++) {
    if (aCorrect[i] && !bCorrect[i]) b++
    else if (!aCorrect[i] && bCorrect[i]) c++
  }
  const disc = b + c
  if (disc === 0) return null

  let pValue: number
  if (disc < 25) {
    // Exact two-sided binomial(disc, 0.5).
    const k = Math.min(b, c)
    let tail = 0
    for (let i = 0; i <= k; i++) {
      let logC = 0
      for (let j = 0; j < i; j++) logC += Math.log(disc - j) - Math.log(j + 1)
      tail += Math.exp(logC + disc * Math.log(0.5))
    }
    pValue = Math.min(1, 2 * tail)
  } else {
    const z = (b - c) / Math.sqrt(disc)
    pValue = 2 * (1 - normalCdf(Math.abs(z)))
  }
  return {
    statistic: (b - c) / Math.sqrt(disc),
    pValue,
    // Difference in accuracy between the two predictors.
    effectSize: (b - c) / aCorrect.length,
    effectSizeName: 'accuracy difference',
    n: aCorrect.length,
    test: disc < 25 ? 'McNemar, exact binomial' : 'McNemar, normal approximation',
  }
}

/**
 * Permutation test on the difference of means.
 *
 * Assumption-free: under the null that the two samples come from one
 * distribution, every labelling is equally likely, so the observed difference
 * is compared against the distribution of differences under relabelling. The
 * p-value uses the (r + 1)/(k + 1) estimator, which cannot return zero — a
 * reported p of 0 from a permutation test is always an artefact of finite
 * iterations.
 */
export function permutationTest(
  a: readonly number[],
  b: readonly number[],
  iterations = 10_000,
  seed = 7,
): TestResult | null {
  if (a.length < 2 || b.length < 2) return null
  const observed = mean(a)! - mean(b)!
  const pooled = [...a, ...b]
  const r = rng(seed)
  let atLeastAsExtreme = 0

  for (let it = 0; it < iterations; it++) {
    const shuffled = [...pooled]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t
    }
    const d = sum(shuffled.slice(0, a.length)) / a.length - sum(shuffled.slice(a.length)) / b.length
    if (Math.abs(d) >= Math.abs(observed)) atLeastAsExtreme++
  }

  const sdPooled = stdev(pooled)!
  return {
    statistic: observed,
    pValue: (atLeastAsExtreme + 1) / (iterations + 1),
    effectSize: sdPooled > 0 ? observed / sdPooled : 0,
    effectSizeName: "Cohen's d (pooled)",
    n: a.length + b.length,
    test: `permutation, ${iterations} relabellings`,
  }
}

/**
 * Benjamini–Hochberg FDR control.
 *
 * Returns q-values in the input order. Controls the expected proportion of
 * false discoveries among rejections, which is the right criterion for an
 * exploratory study running hundreds of tests — Bonferroni controls the
 * probability of ANY false positive and would leave this study unable to
 * detect anything real.
 */
export function benjaminiHochberg(pValues: readonly number[]): number[] {
  const m = pValues.length
  if (m === 0) return []
  const idx = pValues.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p)
  const q = new Array<number>(m)
  let running = 1
  for (let k = m - 1; k >= 0; k--) {
    running = Math.min(running, (idx[k].p * m) / (k + 1))
    q[idx[k].i] = Math.min(1, running)
  }
  return q
}

/** Bonferroni-adjusted p-values, for the few decisions where any false positive is costly. */
export function bonferroni(pValues: readonly number[]): number[] {
  return pValues.map(p => Math.min(1, p * pValues.length))
}

/**
 * Statistical power to detect a given effect, at the sample sizes in use.
 *
 * Reported alongside every null result. "No significant difference" from a
 * sample too small to detect a difference is not evidence of no difference,
 * and the distinction between those two is the most common misreading of a
 * negative finding.
 */
export function powerForMeanDifference(n: number, effectSize: number): number {
  if (n < 2) return 0
  const zAlpha = 1.959963984540054   // two-sided alpha = 0.05
  const lambda = Math.abs(effectSize) * Math.sqrt(n)
  return 1 - normalCdf(zAlpha - lambda) + normalCdf(-zAlpha - lambda)
}

/**
 * The smallest true effect this sample could reliably detect (80% power).
 *
 * The honest companion to a null result: "we could not detect an edge, and we
 * could only have detected one larger than this."
 */
export function minimumDetectableEffect(n: number): number {
  if (n < 2) return Infinity
  // z_(1−alpha/2) + z_power at alpha = 0.05, power = 0.8 → 1.9600 + 0.8416.
  return (1.959963984540054 + 0.8416212335729143) / Math.sqrt(n)
}
