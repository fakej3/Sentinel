/**
 * Comparators, scored on exactly the same out-of-sample rows as the model.
 *
 * The pairing matters. A baseline evaluated over a different row set is not a
 * comparison, it is two studies printed next to each other — differences in
 * coverage, era and symbol mix would be attributed to the method. Every
 * comparator here is handed the identical `OosPrediction` row list, and any
 * that cannot score a row returns `null` for it and takes the coverage penalty
 * openly.
 *
 * TWO COMPARATORS ARE DEGENERATE BY CONSTRUCTION, AND THAT IS THE POINT:
 *
 *   always_long has zero cross-sectional variance, so its IC, rank IC, AUC and
 *   long/short spread are all undefined. It is not a weak signal, it is not a
 *   signal — but it is the benchmark a user actually experiences, and its
 *   classification accuracy is the base rate every other method must beat.
 *
 *   random has an expected IC of exactly zero. If the pipeline reports
 *   otherwise by more than its confidence interval, the measurement is broken
 *   and nothing else in the study can be believed. It is the null calibration.
 */
import type { Corpus } from './corpus'
import type { ScaledCorpus } from './scaling'
import type { OosPrediction } from './pipeline'
import type { ScoredRow } from './evaluate'
import { FEATURE_NAMES } from '../../modules/signal/features'
import { rng } from '../sources'

export interface Comparator {
  readonly name: string
  readonly description: string
  readonly rows: readonly ScoredRow[]
}

export interface ComparatorOptions {
  readonly horizon: number
  readonly seed?: number
  /**
   * Scaled corpus used for the individual-feature baselines.
   *
   * The SCALED value is used rather than the raw one because that is what the
   * model consumes, so a feature's solo performance and its coefficient in the
   * fitted model describe the same quantity. A per-symbol trailing z-score also
   * makes symbols comparable cross-sectionally, which a raw ATR multiple is
   * not: two ATR above the mean means something different for a stock whose
   * feature ranges over [-1, 1] than for one ranging over [-8, 8].
   */
  readonly scaled: ScaledCorpus
}

function baseRow(corpus: Corpus, p: OosPrediction, horizon: number): Omit<ScoredRow, 'score' | 'probability'> {
  return { dateIdx: p.dateIdx, forwardReturn: corpus.forwardReturn[horizon][p.row] }
}

/**
 * Builds every comparator over the supplied out-of-sample rows.
 *
 * `model` is included so it sits in the same list and goes through the same
 * evaluation path — a headline number computed by a different route than the
 * baselines it is compared against is not a comparison either.
 */
export function buildComparators(
  corpus: Corpus,
  predictions: readonly OosPrediction[],
  options: ComparatorOptions,
): Comparator[] {
  const { horizon, scaled } = options
  const seed = options.seed ?? 4242
  const out: Comparator[] = []

  out.push({
    name: 'fitted_model',
    description: 'Walk-forward ridge logistic regression over the 15 continuous signal features, calibrated out of sample.',
    rows: predictions.map(p => ({ ...baseRow(corpus, p, horizon), score: p.score, probability: p.probability })),
  })

  // ── The existing engine ─────────────────────────────────────────────────────
  // Phase 5 established that `confidence.score` has no causal effect on
  // `direction` — the two are independent channels. Both are reported: the
  // signed product is the engine's most informative continuous summary, and the
  // bare direction is what `trade-plan.ts:216` actually acts on.
  out.push({
    name: 'sentinel_engine',
    description: 'Existing engine: direction times the 0-10 confidence score.',
    rows: predictions.map(p => {
      const d = corpus.aux['old_direction'][p.row]
      const c = corpus.aux['old_confidence'][p.row]
      const v = Number.isFinite(d) && Number.isFinite(c) ? d * c : null
      return { ...baseRow(corpus, p, horizon), score: v, probability: null }
    }),
  })

  out.push({
    name: 'sentinel_direction',
    description: 'Existing engine: direction only (+1 long, -1 short, 0 none), which is what the trade plan consumes.',
    rows: predictions.map(p => {
      const d = corpus.aux['old_direction'][p.row]
      return { ...baseRow(corpus, p, horizon), score: Number.isFinite(d) ? d : null, probability: null }
    }),
  })

  // ── Trivial references ──────────────────────────────────────────────────────
  const r = rng(seed)
  out.push({
    name: 'random',
    description: 'Seeded uniform noise. Expected IC exactly zero — the null calibration for the whole measurement.',
    rows: predictions.map(p => ({ ...baseRow(corpus, p, horizon), score: r() - 0.5, probability: null })),
  })

  out.push({
    name: 'always_long',
    description: 'Constant score. No cross-sectional variance, so IC/AUC/spread are undefined by construction; its accuracy is the base rate.',
    rows: predictions.map(p => ({ ...baseRow(corpus, p, horizon), score: 1, probability: null })),
  })

  // ── EMA crossover ───────────────────────────────────────────────────────────
  // dist_emaN = (price - EMA_N) / price, so EMA20 - EMA50 has the OPPOSITE sign
  // to dist20 - dist50. Written in EMA terms to keep the sign unambiguous; an
  // earlier study inverted exactly this and reported IC -0.130 for +0.183.
  out.push({
    name: 'ema_cross',
    description: 'Long when EMA20 > EMA50, short otherwise. The canonical trend-following rule.',
    rows: predictions.map(p => {
      const d20 = corpus.aux['dist_ema20'][p.row]
      const d50 = corpus.aux['dist_ema50'][p.row]
      const spread = Number.isFinite(d20) && Number.isFinite(d50) ? d50 - d20 : null
      return {
        ...baseRow(corpus, p, horizon),
        score: spread === null ? null : (spread > 0 ? 1 : spread < 0 ? -1 : 0),
        probability: null,
      }
    }),
  })

  out.push({
    name: 'ema_cross_continuous',
    description: 'The same crossover carried as a magnitude rather than a sign, to isolate the cost of binarising it.',
    rows: predictions.map(p => {
      const d20 = corpus.aux['dist_ema20'][p.row]
      const d50 = corpus.aux['dist_ema50'][p.row]
      return {
        ...baseRow(corpus, p, horizon),
        score: Number.isFinite(d20) && Number.isFinite(d50) ? d50 - d20 : null,
        probability: null,
      }
    }),
  })

  // ── Individual feature baselines ────────────────────────────────────────────
  for (const name of FEATURE_NAMES) {
    out.push({
      name: `feature:${name}`,
      description: `The scaled ${name} feature used alone as a score.`,
      rows: predictions.map(p => {
        const v = scaled.columns[name][p.row]
        return { ...baseRow(corpus, p, horizon), score: Number.isFinite(v) ? v : null, probability: null }
      }),
    })
  }

  return out
}
