/**
 * Coefficient stability, ablation and forward selection.
 *
 * ── WHAT A SIGN FLIP MEANS ────────────────────────────────────────────────────
 *
 * A feature whose coefficient is +0.4 in one fold and -0.3 in the next has not
 * been measured as bidirectional. It has been measured as noise: the fit is
 * describing whatever that particular train block happened to contain, and the
 * two estimates are both consistent with a true coefficient of zero. Flagging
 * sign instability is therefore the single most useful diagnostic in this file,
 * because a stable small coefficient is evidence and a large unstable one is
 * not.
 *
 * ── ABLATION IS RUN INSIDE THE WALK-FORWARD, NOT AFTER IT ─────────────────────
 *
 * Removing a feature and re-scoring the already-fitted model would measure the
 * feature's contribution to THIS fit, not its contribution to the method.
 * Every ablation here refits the whole walk-forward from scratch with the
 * feature absent, which is more expensive by exactly the factor it needs to be
 * to mean anything.
 *
 * ── FORWARD SELECTION SELECTS ON VALIDATION, NEVER ON TEST ────────────────────
 *
 * Greedy forward selection evaluated on the out-of-sample predictions it is
 * then judged by is a way to manufacture an edge from noise: with fifteen
 * candidates and enough steps, something always looks good. Selection here
 * scores candidates on the INNER validation blocks only.
 */
import type { Corpus } from './corpus'
import type { ScaledCorpus } from './scaling'
import type { FoldResult, RunOptions, WalkForwardResult } from './pipeline'
import {
  buildRows, fitBlock, predictRows, rowsInDateRange, runWalkForward,
} from './pipeline'
import type { CalibrationMethod, FoldConfig } from './pipeline'
import { walkForwardSplits } from '../splits'
import { brierScore } from '../../modules/signal/calibration'
import { evaluateScores } from './evaluate'
import type { ScoredRow } from './evaluate'
import { FEATURE_NAMES } from '../../modules/signal/features'
import { mean, stdev } from '../metrics/stats'

// ── Coefficient stability ─────────────────────────────────────────────────────

export interface FeatureStability {
  readonly name: string
  /** Standardised-space coefficient per fold, in fold order. */
  readonly coefficients: readonly number[]
  readonly meanCoefficient: number | null
  readonly sdCoefficient: number | null
  /**
   * Fraction of folds sharing the modal sign. 1.0 = never flips.
   * Zero coefficients (dropped features) count as neither sign.
   */
  readonly signAgreement: number | null
  readonly signFlips: boolean
  /**
   * Normal interval on the mean coefficient across folds, using the
   * across-fold standard error. Folds are not independent — they share
   * overlapping train blocks under a rolling scheme — so this UNDERSTATES the
   * true width and is reported as a stability diagnostic, not as inference.
   */
  readonly ciLower: number | null
  readonly ciUpper: number | null
  /** Folds in which the feature was dropped for constancy or thin support. */
  readonly droppedFolds: number
  /** Mean |coefficient| share of the fold's total, i.e. the fitted importance. */
  readonly meanImportance: number | null
}

const Z95 = 1.959963984540054

export function coefficientStability(folds: readonly FoldResult[]): FeatureStability[] {
  return FEATURE_NAMES.map(name => {
    const coefficients: number[] = []
    const importances: number[] = []
    let droppedFolds = 0

    for (const f of folds) {
      const j = f.weights.features.indexOf(name)
      if (j < 0) continue
      if (f.weights.dropped.includes(name)) droppedFolds++
      const b = f.weights.coefficients[j]
      coefficients.push(b)
      let total = 0
      for (const c of f.weights.coefficients) total += c * c
      importances.push(total > 0 ? (b * b) / total : 0)
    }

    const m = mean(coefficients)
    const sd = coefficients.length > 1 ? stdev(coefficients) : null
    const nonZero = coefficients.filter(c => c !== 0)
    const positive = nonZero.filter(c => c > 0).length
    const signAgreement = nonZero.length > 0
      ? Math.max(positive, nonZero.length - positive) / nonZero.length
      : null
    const se = sd !== null && coefficients.length > 1 ? sd / Math.sqrt(coefficients.length) : null

    return {
      name,
      coefficients,
      meanCoefficient: m,
      sdCoefficient: sd,
      signAgreement,
      signFlips: signAgreement !== null && signAgreement < 1,
      ciLower: m !== null && se !== null ? m - Z95 * se : null,
      ciUpper: m !== null && se !== null ? m + Z95 * se : null,
      droppedFolds,
      meanImportance: mean(importances),
    }
  })
}

// ── Ablation ──────────────────────────────────────────────────────────────────

export interface AblationRow {
  readonly removed: string
  /** Market-neutral rank IC of the full walk-forward with this feature absent. */
  readonly rankIc: number | null
  readonly rankIcLower: number | null
  readonly rankIcUpper: number | null
  readonly brier: number | null
  readonly coverage: number
  /** rankIc minus the full model's. Negative = removing the feature HURT. */
  readonly delta: number | null
}

export interface AblationReport {
  readonly baselineRankIc: number | null
  readonly rows: readonly AblationRow[]
}

function scoredRows(corpus: Corpus, result: WalkForwardResult): ScoredRow[] {
  return result.predictions.map(p => ({
    dateIdx: p.dateIdx,
    score: p.score,
    probability: p.probability,
    forwardReturn: corpus.forwardReturn[result.horizon][p.row],
  }))
}

/**
 * Leave-one-out ablation: refit the whole walk-forward fifteen times.
 *
 * The metric is MARKET-NEUTRAL rank IC. Rank rather than Pearson because a
 * single extreme return should not decide whether a feature matters, and
 * market-neutral because a feature that merely tracks the market factor would
 * otherwise be credited for the index's drift.
 */
export function ablate(
  corpus: Corpus,
  scaledByWindow: ReadonlyMap<number, ScaledCorpus>,
  baseOptions: RunOptions,
  full: WalkForwardResult,
  onProgress?: (done: number, total: number, name: string) => void,
): AblationReport {
  const baseline = evaluateScores(scoredRows(corpus, full), full.predictions.length, {
    name: 'full', horizon: full.horizon,
  })
  const baselineRankIc = baseline.marketNeutral.rankIc?.point ?? null

  const rows: AblationRow[] = []
  for (let i = 0; i < FEATURE_NAMES.length; i++) {
    const removed = FEATURE_NAMES[i]
    const subset = FEATURE_NAMES.filter(n => n !== removed)
    const result = runWalkForward(corpus, {
      ...baseOptions,
      scaledByWindow: maskWindows(scaledByWindow, subset),
      onFold: undefined,
    })
    const ev = evaluateScores(scoredRows(corpus, result), result.predictions.length, {
      name: `-${removed}`, horizon: result.horizon,
    })
    const rankIc = ev.marketNeutral.rankIc?.point ?? null
    rows.push({
      removed,
      rankIc,
      rankIcLower: ev.marketNeutral.rankIc?.lower ?? null,
      rankIcUpper: ev.marketNeutral.rankIc?.upper ?? null,
      brier: ev.pooledBrier,
      coverage: ev.coverage,
      delta: rankIc !== null && baselineRankIc !== null ? rankIc - baselineRankIc : null,
    })
    onProgress?.(i + 1, FEATURE_NAMES.length, removed)
  }
  return { baselineRankIc, rows }
}

/**
 * Blanks every feature outside `keep`, so the fit sees them as always absent.
 *
 * Blanking rather than deleting the column keeps the design matrix's column
 * order identical across ablations, which keeps `dropped` and the coefficient
 * vector aligned to `FEATURE_NAMES` everywhere. `fitLinearSignalModel` drops an
 * all-NaN column and pins its coefficient at exactly 0.
 */
export function maskWindows(
  scaledByWindow: ReadonlyMap<number, ScaledCorpus>,
  keep: readonly string[],
): ReadonlyMap<number, ScaledCorpus> {
  const keepSet = new Set(keep)
  const out = new Map<number, ScaledCorpus>()
  for (const [w, sc] of scaledByWindow) {
    const columns: Record<string, Float64Array> = {}
    for (const name of Object.keys(sc.columns)) {
      columns[name] = keepSet.has(name)
        ? sc.columns[name]
        // One SHARED all-NaN column for every excluded feature, not one each.
        // These columns are read-only on this path, and forward selection calls
        // this ~120 times: allocating fifteen 4 MB arrays per call rather than
        // reusing one was enough GC churn to make the search intractable.
        : blankColumn(sc.columns[name].length)
    }
    out.set(w, { window: w, columns, fullyScaledRows: sc.fullyScaledRows })
  }
  return out
}

// ── Inner-validation scorer, for forward selection ────────────────────────────

/**
 * Pooled Brier score of a feature subset over INNER validation blocks only.
 *
 * This is the scorer forward selection is allowed to see. Every block it
 * touches lies strictly inside an outer TRAIN block, so no candidate is ever
 * ranked using data the final evaluation will score against. Handing forward
 * selection an out-of-sample scorer instead is how fifteen candidates and a few
 * greedy steps manufacture an edge from noise.
 *
 * Hyperparameters are held FIXED across subsets for the same reason ablation
 * holds them fixed: the question is which features help, and letting the search
 * move as well would confound the two.
 */
export function innerValidationBrier(
  corpus: Corpus,
  scaledByWindow: ReadonlyMap<number, ScaledCorpus>,
  config: FoldConfig,
  horizon: number,
  hyper: { window: number; ridge: number; calibration: CalibrationMethod },
  subset: readonly string[],
): number | null {
  if (subset.length === 0) return null
  const masked = maskWindows(scaledByWindow, subset)
  const scaled = masked.get(hyper.window)
  if (scaled === undefined) throw new Error(`no scaled corpus for window ${hyper.window}`)

  const outer = walkForwardSplits(config.firstDate, corpus.dates.length - 1, {
    trainBars: config.trainDates,
    testBars: config.testDates,
    embargoBars: config.embargoDates,
    mode: config.mode,
  })

  const ps: number[] = []
  const ys: boolean[] = []

  for (const split of outer) {
    const span = split.trainEnd - split.trainStart
    const innerTrain = span - config.innerFolds * config.innerTestDates - config.embargoDates * config.innerFolds
    if (innerTrain <= config.innerTestDates) continue
    const inner = walkForwardSplits(split.trainStart, split.trainEnd - 1, {
      trainBars: innerTrain,
      testBars: config.innerTestDates,
      embargoBars: config.embargoDates,
      mode: 'rolling',
    })
    for (const s of inner) {
      const fitted = fitBlock(
        corpus, scaled, horizon,
        s.trainStart, s.trainEnd, config.embargoDates,
        hyper.ridge, hyper.calibration, config.searchStride,
      )
      if (fitted === null) continue
      const testIdx = rowsInDateRange(corpus, horizon, s.testStart, s.testEnd, config.searchStride)
      const rows = buildRows(scaled, corpus, testIdx, horizon)
      const preds = predictRows(fitted.model, fitted.calibrator, hyper.calibration, rows)
      for (let i = 0; i < preds.length; i++) {
        if (preds[i].probability === null) continue
        ps.push(preds[i].probability!)
        ys.push(rows[i].outcome === 1)
      }
    }
  }
  return ps.length >= 100 ? brierScore(ps, ys) : null
}

/** Cached all-NaN columns, keyed by length. Never written to by any caller. */
const BLANKS = new Map<number, Float64Array>()

function blankColumn(length: number): Float64Array {
  const cached = BLANKS.get(length)
  if (cached !== undefined) return cached
  const made = new Float64Array(length).fill(NaN)
  BLANKS.set(length, made)
  return made
}

// ── Forward selection ─────────────────────────────────────────────────────────

export interface SelectionStep {
  readonly step: number
  readonly added: string
  /** Inner-validation Brier that won this step. */
  readonly innerBrier: number
  /** Every candidate's inner score at this step. */
  readonly candidates: ReadonlyArray<{ name: string; innerBrier: number | null }>
  /** Improvement over the previous step. Negative = better (Brier is a loss). */
  readonly improvement: number
}

export interface ForwardSelectionReport {
  readonly steps: readonly SelectionStep[]
  readonly selected: readonly string[]
  /** Step at which no candidate improved inner Brier. */
  readonly stoppedAt: number
}

/**
 * Greedy forward selection scored on INNER validation blocks only.
 *
 * `scoreSubset` must evaluate a feature subset without touching the outer test
 * data. The caller supplies it so this function cannot accidentally be handed
 * a test-set scorer.
 */
export function forwardSelect(
  scoreSubset: (subset: readonly string[]) => number | null,
  candidates: readonly string[] = FEATURE_NAMES,
  onProgress?: (step: number, added: string, brier: number) => void,
): ForwardSelectionReport {
  const selected: string[] = []
  const steps: SelectionStep[] = []
  let best = Infinity

  for (let step = 1; step <= candidates.length; step++) {
    const remaining = candidates.filter(c => !selected.includes(c))
    const scored = remaining.map(name => ({ name, innerBrier: scoreSubset([...selected, name]) }))
    let winner: { name: string; innerBrier: number } | null = null
    for (const s of scored) {
      if (s.innerBrier === null) continue
      if (winner === null || s.innerBrier < winner.innerBrier) winner = { name: s.name, innerBrier: s.innerBrier }
    }
    // Stop when nothing improves. Continuing past this point would keep adding
    // features that make the validation score worse, which is only ever done to
    // reach a predetermined feature count.
    if (winner === null || winner.innerBrier >= best) {
      return { steps, selected, stoppedAt: step }
    }
    steps.push({
      step,
      added: winner.name,
      innerBrier: winner.innerBrier,
      candidates: scored,
      improvement: winner.innerBrier - best,
    })
    selected.push(winner.name)
    onProgress?.(step, winner.name, winner.innerBrier)
    best = winner.innerBrier
  }
  return { steps, selected, stoppedAt: candidates.length }
}
