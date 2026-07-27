/**
 * Ranking metrics: is a higher confidence score actually better?
 *
 * This is a weaker and more important question than calibration. Calibration
 * asks whether 0.8 means 80%; ranking asks only whether 0.8 beats 0.6. A score
 * can be badly calibrated and still perfectly useful for ranking — you would
 * just have to relabel it. A score that does not RANK is useless at any label.
 *
 * The headline output is `monotonic`: does the hit rate rise, bucket over
 * bucket? If it does not, the report says where it broke, by how much, and
 * whether the break is larger than the sampling noise in the buckets involved.
 */
import type { Bucket, RankingMetrics } from './types'
import { mean, pearson, proportionCI, quantile, spearman } from './stats'

/** One scored, outcome-bearing sample. */
export interface ScoredOutcome {
  readonly score: number
  readonly hit: boolean
  readonly returnPct: number
  /** Return in units of the plan's own risk. null when the plan had no stop. */
  readonly r: number | null
}

function summarise(label: string, lower: number, upper: number, xs: readonly ScoredOutcome[]): Bucket {
  const hits = xs.filter(x => x.hit).length
  const rs = xs.map(x => x.r).filter((v): v is number => v !== null)
  return {
    label,
    lower,
    upper,
    n: xs.length,
    hitRate: xs.length > 0 ? hits / xs.length : null,
    hitRateCI: proportionCI(hits, xs.length),
    averageReturnPct: mean(xs.map(x => x.returnPct)),
    averageR: rs.length > 0 ? mean(rs) : null,
    meanScore: mean(xs.map(x => x.score)),
  }
}

/**
 * Fixed buckets over the engine's 0–10 confidence score, aligned to the
 * engine's OWN grade thresholds.
 *
 * PROVENANCE: `DEFAULT_CONFIDENCE_CONFIG.gradeThresholds` — veryStrong 8.5,
 * strong 7.0, moderate 5.0, mixed 3.0. These are the boundaries the engine
 * already uses to label a score, so a break in monotonicity at one of them is
 * a break in a distinction the product actually makes to the user. Inventing
 * different boundaries would measure a partition nobody sees.
 */
export const GRADE_BUCKETS: ReadonlyArray<{ label: string; lower: number; upper: number }> = [
  { label: 'weak (0–3)', lower: 0, upper: 3 },
  { label: 'mixed (3–5)', lower: 3, upper: 5 },
  { label: 'moderate (5–7)', lower: 5, upper: 7 },
  { label: 'strong (7–8.5)', lower: 7, upper: 8.5 },
  { label: 'very_strong (8.5–10)', lower: 8.5, upper: 10 },
]

/**
 * Deciles of the OBSERVED score distribution, not of the 0–10 range.
 *
 * Equal-count buckets, so every decile's hit rate is estimated with the same
 * precision. Equal-width buckets over a score that clusters — and Sentinel's
 * does — put most of the sample in two bins and leave the rest as noise.
 *
 * Ties are why this returns fewer than 10 buckets sometimes: identical scores
 * cannot be split across a boundary without making the assignment depend on
 * input order. Duplicate edges are collapsed and the actual count is visible in
 * the output.
 */
function decileBuckets(xs: readonly ScoredOutcome[], count = 10): Bucket[] {
  if (xs.length === 0) return []
  const scores = xs.map(x => x.score)
  const edges = [Math.min(...scores)]
  for (let i = 1; i < count; i++) edges.push(quantile(scores, i / count)!)
  edges.push(Math.max(...scores))
  const uniq = [...new Set(edges)].sort((a, b) => a - b)
  if (uniq.length < 2) {
    return [summarise(`all (${uniq[0].toFixed(2)})`, uniq[0], uniq[0], xs)]
  }

  const out: Bucket[] = []
  for (let k = 0; k < uniq.length - 1; k++) {
    const lo = uniq[k]
    const hi = uniq[k + 1]
    const last = k === uniq.length - 2
    const inBucket = xs.filter(x => x.score >= lo && (last ? x.score <= hi : x.score < hi))
    out.push(summarise(`D${k + 1} [${lo.toFixed(2)}, ${hi.toFixed(2)}${last ? ']' : ')'}`, lo, hi, inBucket))
  }
  return out
}

/**
 * All ranking metrics.
 *
 * `minBucketCount` gates the monotonicity check. Without it, a bucket holding
 * four samples decides whether the engine is "monotonic", and the answer
 * becomes a coin flip. Buckets below the floor are still reported — they are
 * just not allowed to cast a vote.
 */
export function rankingMetrics(
  xs: readonly ScoredOutcome[],
  options: { minBucketCount?: number } = {},
): RankingMetrics {
  const minBucketCount = options.minBucketCount ?? 30

  const buckets = GRADE_BUCKETS.map((b, i) => {
    const last = i === GRADE_BUCKETS.length - 1
    return summarise(
      b.label, b.lower, b.upper,
      xs.filter(x => x.score >= b.lower && (last ? x.score <= b.upper : x.score < b.upper)),
    )
  })
  const deciles = decileBuckets(xs)

  const scores = xs.map(x => x.score)
  const hits = xs.map(x => (x.hit ? 1 : 0))
  const returns = xs.map(x => x.returnPct)

  // Monotonicity over the grade buckets — the partition the user sees.
  const eligible = buckets.filter(b => b.n >= minBucketCount && b.hitRate !== null)
  const breaks: { from: string; to: string; drop: number }[] = []
  for (let i = 1; i < eligible.length; i++) {
    const drop = eligible[i - 1].hitRate! - eligible[i].hitRate!
    if (drop > 0) breaks.push({ from: eligible[i - 1].label, to: eligible[i].label, drop })
  }

  return {
    n: xs.length,
    buckets,
    deciles,
    spearmanScoreOutcome: spearman(scores, hits),
    pearsonScoreOutcome: pearson(scores, hits),
    spearmanScoreReturn: spearman(scores, returns),
    // null, not true, when fewer than two buckets are eligible: with one
    // bucket there is nothing to be monotonic across, and reporting `true`
    // would claim a property that was never tested.
    monotonic: eligible.length >= 2 ? breaks.length === 0 : null,
    monotonicityBreaks: breaks,
    minBucketCount,
  }
}
