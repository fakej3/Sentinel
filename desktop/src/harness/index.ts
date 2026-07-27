/**
 * Sentinel evaluation harness.
 *
 * Answers one question and refuses to answer any other: given what Sentinel
 * said at a moment, what did the market then do? It records; it does not
 * judge. Turning records into verdicts belongs to the metrics layer, where the
 * assumptions can be stated and varied.
 *
 * See `README.md` for the leak argument and the null-calibration result.
 */
export type {
  HorizonOutcome, Observation, Series, CandleSource, RunConfig, RunResult, Split,
} from './types'
export { DEFAULT_HORIZONS, DEFAULT_RUN_CONFIG } from './types'

export { computeOutcome, computeOutcomes, baseRates } from './outcomes'
export { extractFeatures, extractCategorical, featureNames } from './features'
export type { PipelineSnapshot } from './features'
export { analyseWindow, reconstructTicker, windowMarketData, inferBarMs } from './snapshot'
export { runSeries, runSource, totalObservations } from './engine'
export type { SkipReason } from './engine'
export { walkForwardSplits, defaultEmbargo, validateSplit, trainSet, testSet } from './splits'
export type { SplitConfig } from './splits'
export {
  syntheticSource, syntheticSeries, inMemorySource, jsonFileSource, parseSeriesFile, rng,
} from './sources'
export type { SyntheticSpec, RegimeSpec, RegimeSegment } from './sources'
export { syntheticRegimeSeries, regimeSource } from './sources'
export { assertWellFormedSeries } from './validate'
export { toCsv, toJsonl, buildManifest, writeRun } from './export'
export type { RunManifest } from './export'
