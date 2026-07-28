/**
 * Milestone 3 study driver.
 *
 *   npx tsx src/harness/fitting/run.ts <cacheDir> <outDir> [--smoke] [--no-ablation]
 *
 * Reads the cached raw-feature corpus, runs the nested walk-forward, evaluates
 * the fitted model against every comparator, and writes the reports.
 *
 * Nothing here decides anything. Every threshold that could flatter a result —
 * which hyperparameter, which calibrator, which features — is chosen inside the
 * walk-forward on inner validation blocks. This file only sequences the work
 * and prints what came out.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readCorpus, PRIMARY_HORIZON } from './corpus'
import type { Corpus } from './corpus'
import { scaleCorpus } from './scaling'
import type { ScaledCorpus } from './scaling'
import { DEFAULT_GRID, runWalkForward, fitBlock } from './pipeline'
import type { FoldConfig, HyperGrid, WalkForwardResult } from './pipeline'
import { evaluateScores } from './evaluate'
import type { EvaluationResult, ScoredRow } from './evaluate'
import { buildComparators } from './baselines'
import { ablate, coefficientStability, forwardSelect, innerValidationBrier } from './analysis'
import type { AblationReport, FeatureStability, ForwardSelectionReport } from './analysis'
import { renderReport } from './report'

const args = process.argv.slice(2)
const [cacheDir, outDir] = args.filter(a => !a.startsWith('--'))
const SMOKE = args.includes('--smoke')
const NO_ABLATION = args.includes('--no-ablation')
if (cacheDir === undefined || outDir === undefined) {
  throw new Error('usage: run.ts <cacheDir> <outDir> [--smoke] [--no-ablation]')
}

const log = (m: string): void => { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`) }

const t0 = Date.now()
log(`reading corpus from ${cacheDir}`)
const corpus: Corpus = await readCorpus(cacheDir)
log(`corpus: ${corpus.rows} rows, ${corpus.symbols.length} symbols, ${corpus.dates.length} dates, `
  + `lookback ${corpus.lookbackBars}, horizons [${corpus.horizons.join(', ')}]`)

const grid: HyperGrid = SMOKE
  ? { windows: [63], ridges: [1, 10], calibrations: ['isotonic', 'none'] }
  : DEFAULT_GRID

// ── Scaling, once per candidate window ────────────────────────────────────────
const scaledByWindow = new Map<number, ScaledCorpus>()
for (const w of grid.windows) {
  const t = Date.now()
  const sc = scaleCorpus(corpus, w)
  scaledByWindow.set(w, sc)
  log(`scaled window=${w}: ${sc.fullyScaledRows}/${corpus.rows} rows fully scaled (${Date.now() - t}ms)`)
}

// ── Walk-forward geometry ─────────────────────────────────────────────────────
// firstDate is DERIVED: the first date carrying an observation, plus the widest
// trailing window, so every candidate scaler is warm before the first fold.
let firstObservationDate = Number.POSITIVE_INFINITY
for (let r = 0; r < corpus.rows; r++) firstObservationDate = Math.min(firstObservationDate, corpus.dateIdx[r])
const maxWindow = Math.max(...grid.windows)
const firstDate = firstObservationDate + maxWindow

const config: FoldConfig = {
  firstDate,
  trainDates: SMOKE ? 189 : 252,
  testDates: SMOKE ? 63 : 63,
  // Derived, not chosen: the longest horizon in the corpus. A label at date t
  // reads prices through t + h, so the gap must be at least h.
  embargoDates: Math.max(...corpus.horizons),
  mode: 'rolling',
  innerFolds: 2,
  innerTestDates: SMOKE ? 30 : 50,
  calibrationFraction: 0.25,
  searchStride: SMOKE ? 8 : 2,
}
log(`walk-forward: firstDate=${firstDate} (obs from ${firstObservationDate} + window ${maxWindow}), `
  + `train=${config.trainDates} test=${config.testDates} embargo=${config.embargoDates}`)

// ── The fit ───────────────────────────────────────────────────────────────────
const tFit = Date.now()
const result: WalkForwardResult = runWalkForward(corpus, {
  horizon: PRIMARY_HORIZON,
  config,
  grid,
  scaledByWindow,
  onFold: (fold, total, chosen) => {
    log(`  fold ${fold + 1}/${total}: window=${chosen.window} ridge=${chosen.ridge} `
      + `calib=${chosen.calibration} innerBrier=${chosen.innerBrier?.toFixed(5) ?? 'n/a'}`)
  },
})
log(`walk-forward complete: ${result.folds.length} folds, ${result.predictions.length} out-of-sample `
  + `predictions (${((Date.now() - tFit) / 1000).toFixed(0)}s)`)

const answered = result.predictions.filter(p => p.probability !== null).length
const scoredCount = result.predictions.filter(p => p.score !== null).length
log(`  scored ${scoredCount}, probability emitted ${answered}`)

// ── Evaluation ────────────────────────────────────────────────────────────────
const referenceWindow = grid.windows[grid.windows.length - 1]
const comparators = buildComparators(corpus, result.predictions, {
  horizon: PRIMARY_HORIZON,
  scaled: scaledByWindow.get(referenceWindow)!,
})

log(`evaluating ${comparators.length} comparators`)
const evaluations: EvaluationResult[] = []
for (const c of comparators) {
  evaluations.push(evaluateScores(c.rows as ScoredRow[], result.predictions.length, {
    name: c.name, horizon: PRIMARY_HORIZON,
  }))
}

// ── Coefficient stability ─────────────────────────────────────────────────────
const stability: FeatureStability[] = coefficientStability(result.folds)
const flips = stability.filter(s => s.signFlips).length
log(`coefficient stability: ${flips}/${stability.length} features flip sign across folds`)

// ── Controlled-comparison hyperparameters ─────────────────────────────────────
// Ablation and forward selection both hold hyperparameters at the main run's
// MODAL selection, so their comparisons differ only in which features are
// present. Re-searching per comparison would confound a feature's contribution
// with the search landing somewhere else.
const modal = <T extends string | number>(pick: (f: typeof result.folds[number]) => T): T => {
  const counts = new Map<T, number>()
  for (const f of result.folds) counts.set(pick(f), (counts.get(pick(f)) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}
const fixedHyper = {
  window: modal(f => f.chosen.window),
  ridge: modal(f => f.chosen.ridge),
  calibration: modal(f => f.chosen.calibration),
}

// ── Forward selection ─────────────────────────────────────────────────────────
// Scored on INNER validation blocks only — every block lies strictly inside an
// outer train block, so no candidate is ever ranked using data the headline
// evaluation scores against.
log(`forward selection: greedy, inner validation at window=${fixedHyper.window} ridge=${fixedHyper.ridge}`)
const tSel = Date.now()
// Forward selection evaluates ~120 feature subsets, each requiring a fit per
// inner block. It therefore subsamples rows more aggressively than the headline
// run. This costs PRECISION in the selection, not validity: the blocks scored
// are still inner-validation only, so nothing leaks — a subset that looks best
// here is simply chosen on a noisier estimate.
const SELECTION_STRIDE = 8
const selectionConfig = { ...config, searchStride: SELECTION_STRIDE }
const selection: ForwardSelectionReport = forwardSelect(
  subset => innerValidationBrier(corpus, scaledByWindow, selectionConfig, PRIMARY_HORIZON, fixedHyper, subset),
  undefined,
  (step, added, brier) => log(`  step ${step}: +${added} (inner Brier ${brier.toFixed(5)})`),
)
log(`forward selection stopped at step ${selection.stoppedAt} with ${selection.selected.length} features `
  + `(${((Date.now() - tSel) / 1000).toFixed(0)}s)`)

// ── Ablation ──────────────────────────────────────────────────────────────────
let ablation: AblationReport | null = null
if (!NO_ABLATION) {
  log(`ablation: refitting once per removed feature at fixed window=${fixedHyper.window} `
    + `ridge=${fixedHyper.ridge} calib=${fixedHyper.calibration} (the main run's modal choice)`)
  const tAbl = Date.now()
  ablation = ablate(
    corpus, scaledByWindow,
    { horizon: PRIMARY_HORIZON, config, grid, fixedHyper },
    result,
    (done, total, name) => log(`  ablation ${done}/${total}: removed ${name}`),
  )
  log(`ablation complete (${((Date.now() - tAbl) / 1000).toFixed(0)}s)`)
}

// ── Output ────────────────────────────────────────────────────────────────────
await mkdir(outDir, { recursive: true })

const markdown = renderReport({
  corpus, result, evaluations, stability, ablation, selection, fixedHyper,
  comparatorDescriptions: Object.fromEntries(comparators.map(c => [c.name, c.description])),
  grid, config,
})
await writeFile(path.join(outDir, 'REPORT.md'), markdown)

await writeFile(path.join(outDir, 'evaluations.json'), JSON.stringify(evaluations, null, 2))
await writeFile(path.join(outDir, 'stability.json'), JSON.stringify(stability, null, 2))
await writeFile(path.join(outDir, 'folds.json'), JSON.stringify(
  result.folds.map(f => ({
    fold: f.fold,
    trainStart: f.trainStart, trainEnd: f.trainEnd, testStart: f.testStart, testEnd: f.testEnd,
    chosen: { window: f.chosen.window, ridge: f.chosen.ridge, calibration: f.chosen.calibration, innerBrier: f.chosen.innerBrier },
    searched: f.chosen.searched,
    trainRows: f.trainRows, calibrationRows: f.calibrationRows, testRows: f.testRows,
    calibratorName: f.calibratorName,
    intercept: f.weights.intercept,
    coefficients: Object.fromEntries(f.weights.features.map((n, i) => [n, f.weights.coefficients[i]])),
    dropped: f.weights.dropped,
    converged: f.weights.converged,
    eventsPerVariable: f.weights.eventsPerVariable,
  })), null, 2))
if (ablation !== null) {
  await writeFile(path.join(outDir, 'ablation.json'), JSON.stringify(ablation, null, 2))
}
await writeFile(path.join(outDir, 'selection.json'), JSON.stringify(selection, null, 2))

// ── Deliverable: the fitted model and its calibration object ──────────────────
// Refitted on the LAST fold's train block, which is the most recent data any
// deployable model could have used. Serialised in full — coefficients, training
// moments, covariance and the calibrator's bins — so it can be loaded and
// scored without re-running the study.
const last = result.folds[result.folds.length - 1]
if (last !== undefined) {
  const deployable = fitBlock(
    corpus, scaledByWindow.get(last.chosen.window)!, PRIMARY_HORIZON,
    last.trainStart, last.trainEnd, config.embargoDates,
    last.chosen.ridge, last.chosen.calibration, 1,
  )
  if (deployable !== null) {
    await writeFile(path.join(outDir, 'model.json'), JSON.stringify({
      note: 'Fitted on the final training block. NOT endorsed for use: the study '
        + 'it comes from measured no out-of-sample edge. Persisted so the numbers '
        + 'in REPORT.md can be reproduced and audited.',
      trainDates: [last.trainStart, last.trainEnd],
      horizon: PRIMARY_HORIZON,
      scalingWindow: last.chosen.window,
      ridge: last.chosen.ridge,
      calibration: last.chosen.calibration,
      weights: deployable.weights,
      calibrator: deployable.calibrator === null ? null : {
        name: deployable.calibrator.name,
        support: deployable.calibrator.support,
        bins: deployable.calibrator.bins,
      },
    }, null, 2))
  }
}

log(`written to ${outDir} (total ${((Date.now() - t0) / 1000).toFixed(0)}s)`)
