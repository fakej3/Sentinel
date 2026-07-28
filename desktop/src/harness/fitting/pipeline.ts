/**
 * Walk-forward fitting.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────────────
 *
 * For each outer fold, in date order:
 *
 *     [ ---- train ---- ][embargo][ -- test -- ]
 *
 * and INSIDE the train block, before anything is fitted for real:
 *
 *     [ inner train ][emb][ inner calib ][emb][ inner test ]   x innerFolds
 *
 * The inner loop chooses the scaling window, the ridge penalty and the
 * calibration method by out-of-sample Brier score on inner test blocks that lie
 * entirely inside the outer train block. Only then is the final model fitted on
 * the whole outer train block and applied to the outer test block, which no
 * fitting or selection decision has ever seen.
 *
 * That nesting is the whole point. Selecting a hyperparameter on the outer test
 * block — even once, even by eye — makes every subsequent out-of-sample number
 * an in-sample number. It is the single most common way a backtest reports an
 * edge that does not exist.
 *
 * ── THREE BLOCKS, NOT TWO ─────────────────────────────────────────────────────
 *
 * The calibrator is fitted on a chronological block the MODEL was not fitted
 * on. A calibrator fitted on the model's own training scores learns that the
 * model is right more often than it will be, because logistic regression is
 * calibrated in-sample by construction. Every train block is therefore split
 * into a model portion and a later calibration portion, with an embargo
 * between them for the same reason there is one before the test block.
 *
 * ── EMBARGO ───────────────────────────────────────────────────────────────────
 *
 * Every gap is at least `max(horizons)` trading days, because a label at date t
 * is computed from prices through t + h. `harness/splits.ts` derives this and
 * refuses splits that violate it; this file reuses that derivation rather than
 * restating it.
 */
import type { Corpus } from './corpus'
import type { ScaledCorpus } from './scaling'
import { scaleCorpus } from './scaling'
import { walkForwardSplits, defaultEmbargo } from '../splits'
import type { Split } from '../types'
import { FEATURE_NAMES } from '../../modules/signal/features'
import {
  LinearSignalModel, fitLinearSignalModel,
} from '../../modules/signal/model'
import type { ModelWeights, TrainingRow } from '../../modules/signal/model'
import { brierScore, fitIsotonic, fitPlatt } from '../../modules/signal/calibration'
import type { Calibrator } from '../../modules/signal/types'
import type { ScaledFeatures } from '../../modules/signal/types'

export type CalibrationMethod = 'isotonic' | 'platt' | 'none'

export interface HyperGrid {
  readonly windows: readonly number[]
  readonly ridges: readonly number[]
  readonly calibrations: readonly CalibrationMethod[]
}

export const DEFAULT_GRID: HyperGrid = {
  // A quarter, a half-year and a year of trailing bars. 252 is the conventional
  // annual window; the shorter two test whether adaptivity beats precision.
  windows: [63, 126, 252],
  // Four decades of penalty. 1 is a unit-variance Gaussian prior on
  // standardised coefficients; the span brackets it by two orders each way so
  // the search can report a boundary hit rather than silently sitting on one.
  ridges: [0.1, 1, 10, 100],
  calibrations: ['isotonic', 'platt', 'none'],
}

export interface FoldConfig {
  /**
   * First date index the walk-forward may use.
   *
   * DERIVED by the caller, not chosen: observations begin at
   * `lookbackBars - 1`, and a trailing scaler needs a further `window`
   * observations before it emits anything. Starting earlier would fill the
   * first folds with rows whose features are all unavailable, and the model
   * would abstain on them — reporting a fold that measured nothing as a fold
   * that measured no edge.
   */
  readonly firstDate: number
  readonly trainDates: number
  readonly testDates: number
  readonly embargoDates: number
  readonly mode: 'rolling' | 'anchored'
  /** Inner splits used for hyperparameter selection, inside each train block. */
  readonly innerFolds: number
  /**
   * Dates per inner test block. Explicit rather than derived from the train
   * span: a formula that divides the span silently shrinks the inner TRAIN
   * block as folds are added, so asking for more inner folds would quietly
   * degrade every selection they were added to improve.
   */
  readonly innerTestDates: number
  /** Share of a train block reserved, at its END, for fitting the calibrator. */
  readonly calibrationFraction: number
  /** Evaluate every Nth row when searching hyperparameters. 1 uses all. */
  readonly searchStride: number
}

export interface Chosen {
  readonly window: number
  readonly ridge: number
  readonly calibration: CalibrationMethod
  /** Inner out-of-sample Brier that won the selection. */
  readonly innerBrier: number | null
  /** Every combination's inner score, so the choice can be audited. */
  readonly searched: ReadonlyArray<{ window: number; ridge: number; calibration: CalibrationMethod; brier: number | null; covered: number }>
}

export interface FoldResult {
  readonly fold: number
  readonly trainStart: number
  readonly trainEnd: number
  readonly testStart: number
  readonly testEnd: number
  readonly chosen: Chosen
  readonly weights: ModelWeights
  readonly calibratorName: string | null
  readonly trainRows: number
  readonly calibrationRows: number
  readonly testRows: number
}

/** One out-of-sample prediction. The unit every downstream metric consumes. */
export interface OosPrediction {
  readonly row: number
  readonly dateIdx: number
  readonly symbolIdx: number
  readonly fold: number
  /** Linear predictor. null when the model abstained. */
  readonly score: number | null
  /** Calibrated probability. null when the model or the calibrator abstained. */
  readonly probability: number | null
  readonly abstained: string | null
}

export interface WalkForwardResult {
  readonly folds: readonly FoldResult[]
  readonly predictions: readonly OosPrediction[]
  readonly horizon: number
  readonly config: FoldConfig
  readonly grid: HyperGrid
}

// ── Row assembly ──────────────────────────────────────────────────────────────

/** Row indices whose date index lies in [from, to) and whose label exists. */
export function rowsInDateRange(
  corpus: Corpus, horizon: number, from: number, to: number, stride = 1,
): Int32Array {
  const out: number[] = []
  const fwd = corpus.forwardReturn[horizon]
  if (fwd === undefined) throw new Error(`corpus has no horizon ${horizon}`)
  for (let r = 0; r < corpus.rows; r++) {
    const d = corpus.dateIdx[r]
    if (d < from || d >= to) continue
    if (!Number.isFinite(fwd[r])) continue
    out.push(r)
  }
  if (stride <= 1) return Int32Array.from(out)
  const strided: number[] = []
  for (let i = 0; i < out.length; i += stride) strided.push(out[i])
  return Int32Array.from(strided)
}

/**
 * Builds training rows from columnar storage.
 *
 * `NaN` becomes `null`, which is what the model reads as "absent" and imputes
 * to the training mean while widening its interval. Substituting 0 here would
 * silently assert the feature sat at its mean with full confidence.
 */
export function buildRows(
  scaled: ScaledCorpus, corpus: Corpus, rows: Int32Array, horizon: number,
): TrainingRow[] {
  const fwd = corpus.forwardReturn[horizon]
  const out: TrainingRow[] = new Array(rows.length)
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const features: Record<string, number | null> = {}
    for (const name of FEATURE_NAMES) {
      const v = scaled.columns[name][r]
      features[name] = Number.isFinite(v) ? v : null
    }
    const ret = fwd[r]
    out[i] = { features: features as ScaledFeatures, outcome: ret > 0 ? 1 : 0, forwardReturn: ret }
  }
  return out
}

// ── Calibration ───────────────────────────────────────────────────────────────

export function fitCalibrator(
  method: CalibrationMethod, scores: readonly number[], labels: readonly boolean[],
): Calibrator | null {
  if (method === 'none' || scores.length === 0) return null
  return method === 'isotonic' ? fitIsotonic(scores, labels) : fitPlatt(scores, labels)
}

/**
 * Scores rows and, when a calibrator is present, maps them to probabilities.
 *
 * With `calibration: 'none'` the model's own logistic output is used. That is
 * an UNCALIBRATED probability and is included in the search precisely so the
 * study can answer "does calibration help at all?" with a measurement rather
 * than an assumption — the brief requires reporting that neither method helps
 * if that is what the data says.
 */
export function predictRows(
  model: LinearSignalModel, calibrator: Calibrator | null, method: CalibrationMethod,
  rows: TrainingRow[],
): Array<{ score: number | null; probability: number | null; abstained: string | null }> {
  return rows.map(r => {
    const out = model.predict(r.features)
    if (out.linearPredictor === null) {
      return { score: null, probability: null, abstained: out.abstain ?? 'no-model-score' }
    }
    if (method === 'none') {
      return { score: out.linearPredictor, probability: out.probabilityLong, abstained: null }
    }
    if (calibrator === null) {
      return { score: out.linearPredictor, probability: null, abstained: 'uncalibrated' }
    }
    const p = calibrator.probability(out.linearPredictor)
    if (p === null) {
      const outside = out.linearPredictor < calibrator.support.min || out.linearPredictor > calibrator.support.max
      return {
        score: out.linearPredictor,
        probability: null,
        abstained: outside ? 'outside-calibration-support' : 'insufficient-support',
      }
    }
    return { score: out.linearPredictor, probability: p.p, abstained: null }
  })
}

// ── One train block: fit model, then calibrator, on disjoint sub-blocks ───────

export interface FittedBlock {
  readonly model: LinearSignalModel
  readonly weights: ModelWeights
  readonly calibrator: Calibrator | null
  readonly modelRows: number
  readonly calibrationRows: number
}

export function fitBlock(
  corpus: Corpus, scaled: ScaledCorpus, horizon: number,
  from: number, to: number, embargo: number,
  ridge: number, method: CalibrationMethod, stride: number,
): FittedBlock | null {
  const span = to - from
  // The calibration portion is the tail of the block; the model portion is
  // everything before it, minus an embargo so no training label reads into it.
  const calibDates = Math.max(1, Math.round(span * 0.25))
  const modelEnd = to - calibDates - embargo
  if (modelEnd - from < 1) return null

  const modelRows = rowsInDateRange(corpus, horizon, from, modelEnd, stride)
  if (modelRows.length < 100) return null
  const trainRows = buildRows(scaled, corpus, modelRows, horizon)

  let weights: ModelWeights
  try {
    weights = fitLinearSignalModel(trainRows, FEATURE_NAMES, { ridge })
  } catch {
    return null
  }
  const model = new LinearSignalModel(weights)

  if (method === 'none') {
    return { model, weights, calibrator: null, modelRows: modelRows.length, calibrationRows: 0 }
  }

  const calibIdx = rowsInDateRange(corpus, horizon, to - calibDates, to, stride)
  const calibRows = buildRows(scaled, corpus, calibIdx, horizon)
  const scores: number[] = []
  const labels: boolean[] = []
  for (const r of calibRows) {
    const out = model.predict(r.features)
    if (out.linearPredictor === null) continue
    scores.push(out.linearPredictor)
    labels.push(r.outcome === 1)
  }
  if (scores.length < 100) {
    return { model, weights, calibrator: null, modelRows: modelRows.length, calibrationRows: scores.length }
  }
  return {
    model, weights,
    calibrator: fitCalibrator(method, scores, labels),
    modelRows: modelRows.length,
    calibrationRows: scores.length,
  }
}

// ── Hyperparameter selection, strictly inside a train block ──────────────────

function selectHyperparameters(
  corpus: Corpus, scaledByWindow: ReadonlyMap<number, ScaledCorpus>, horizon: number,
  trainStart: number, trainEnd: number, cfg: FoldConfig, grid: HyperGrid,
): Chosen {
  const span = trainEnd - trainStart
  const innerTest = cfg.innerTestDates
  const innerTrain = span - cfg.innerFolds * innerTest - cfg.embargoDates * cfg.innerFolds
  const searched: Array<{ window: number; ridge: number; calibration: CalibrationMethod; brier: number | null; covered: number }> = []

  const inner: Split[] = innerTrain > innerTest
    ? walkForwardSplits(trainStart, trainEnd - 1, {
      trainBars: innerTrain, testBars: innerTest, embargoBars: cfg.embargoDates, mode: 'rolling',
    })
    : []

  let best: { window: number; ridge: number; calibration: CalibrationMethod; brier: number } | null = null

  for (const window of grid.windows) {
    const scaled = scaledByWindow.get(window)
    if (scaled === undefined) throw new Error(`no scaled corpus for window ${window}`)
    for (const ridge of grid.ridges) {
      for (const calibration of grid.calibrations) {
        const ps: number[] = []
        const ys: boolean[] = []
        for (const s of inner) {
          const fitted = fitBlock(
            corpus, scaled, horizon, s.trainStart, s.trainEnd, cfg.embargoDates,
            ridge, calibration, cfg.searchStride,
          )
          if (fitted === null) continue
          const testIdx = rowsInDateRange(corpus, horizon, s.testStart, s.testEnd, cfg.searchStride)
          const testRows = buildRows(scaled, corpus, testIdx, horizon)
          const preds = predictRows(fitted.model, fitted.calibrator, calibration, testRows)
          for (let i = 0; i < preds.length; i++) {
            if (preds[i].probability === null) continue
            ps.push(preds[i].probability!)
            ys.push(testRows[i].outcome === 1)
          }
        }
        const brier = ps.length >= 100 ? brierScore(ps, ys) : null
        searched.push({ window, ridge, calibration, brier, covered: ps.length })
        if (brier !== null && (best === null || brier < best.brier)) {
          best = { window, ridge, calibration, brier }
        }
      }
    }
  }

  if (best === null) {
    // No inner combination produced enough coverage to be scored. Falling back
    // to a fixed choice is reported, not hidden: a fold selected this way has
    // not had its hyperparameters validated and its result is weaker evidence.
    return {
      window: grid.windows[grid.windows.length - 1],
      ridge: 1,
      calibration: 'none',
      innerBrier: null,
      searched,
    }
  }
  return { ...best, innerBrier: best.brier, searched }
}

// ── The driver ────────────────────────────────────────────────────────────────

export interface RunOptions {
  readonly horizon: number
  readonly config: FoldConfig
  readonly grid?: HyperGrid
  readonly onFold?: (fold: number, total: number, chosen: Chosen) => void
  /** Pre-scaled corpora, keyed by window. Computed here when absent. */
  readonly scaledByWindow?: ReadonlyMap<number, ScaledCorpus>
  /**
   * Skip the inner hyperparameter search and use these values for every fold.
   *
   * Used ONLY for ablation, and for a specific reason: the ablation question is
   * "does this feature contribute?", so hyperparameter re-selection must be
   * held constant across the comparison. Letting each ablated run re-search
   * would confound the feature's effect with the search landing somewhere else,
   * and a feature could appear to matter because removing it happened to change
   * the chosen ridge.
   *
   * Never use this for a headline number: hyperparameters fixed from a run over
   * the whole sample have seen the test data.
   */
  readonly fixedHyper?: { readonly window: number; readonly ridge: number; readonly calibration: CalibrationMethod }
}

export function runWalkForward(corpus: Corpus, options: RunOptions): WalkForwardResult {
  const grid = options.grid ?? DEFAULT_GRID
  const cfg = options.config
  const horizon = options.horizon

  const need = defaultEmbargo(corpus.horizons)
  if (cfg.embargoDates < need) {
    throw new Error(
      `embargoDates ${cfg.embargoDates} < max horizon ${need}; a training label would `
      + `be computed from test-period bars`,
    )
  }

  const scaledByWindow = options.scaledByWindow
    ?? new Map(grid.windows.map(w => [w, scaleCorpus(corpus, w)]))

  const splits = walkForwardSplits(cfg.firstDate, corpus.dates.length - 1, {
    trainBars: cfg.trainDates,
    testBars: cfg.testDates,
    embargoBars: cfg.embargoDates,
    mode: cfg.mode,
  })

  const folds: FoldResult[] = []
  const predictions: OosPrediction[] = []

  for (const split of splits) {
    const chosen: Chosen = options.fixedHyper !== undefined
      ? { ...options.fixedHyper, innerBrier: null, searched: [] }
      : selectHyperparameters(
        corpus, scaledByWindow, horizon, split.trainStart, split.trainEnd, cfg, grid,
      )
    const scaled = scaledByWindow.get(chosen.window)!
    const fitted = fitBlock(
      corpus, scaled, horizon, split.trainStart, split.trainEnd, cfg.embargoDates,
      chosen.ridge, chosen.calibration, 1,
    )
    if (fitted === null) continue

    const testIdx = rowsInDateRange(corpus, horizon, split.testStart, split.testEnd, 1)
    const testRows = buildRows(scaled, corpus, testIdx, horizon)
    const preds = predictRows(fitted.model, fitted.calibrator, chosen.calibration, testRows)

    for (let i = 0; i < testIdx.length; i++) {
      const r = testIdx[i]
      predictions.push({
        row: r,
        dateIdx: corpus.dateIdx[r],
        symbolIdx: corpus.symbolIdx[r],
        fold: split.index,
        score: preds[i].score,
        probability: preds[i].probability,
        abstained: preds[i].abstained,
      })
    }

    folds.push({
      fold: split.index,
      trainStart: split.trainStart,
      trainEnd: split.trainEnd,
      testStart: split.testStart,
      testEnd: split.testEnd,
      chosen,
      weights: fitted.weights,
      calibratorName: fitted.calibrator?.name ?? (chosen.calibration === 'none' ? 'none' : null),
      trainRows: fitted.modelRows,
      calibrationRows: fitted.calibrationRows,
      testRows: testIdx.length,
    })
    options.onFold?.(split.index, splits.length, chosen)
  }

  return { folds, predictions, horizon, config: cfg, grid }
}
