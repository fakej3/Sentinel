/**
 * Sentinel metrics — the measurement layer over Phase 1 observations.
 *
 * Answers "does Sentinel have edge?" with numbers rather than opinions. It
 * computes; it does not tune, filter, or select. Nothing here can change the
 * engine's output, by construction — it only reads recorded observations.
 *
 * See `README.md` for the definitions, their sources, and the limitations that
 * change how every figure should be read.
 */
export * from './types'
export {
  sum, mean, variance, stdev, quantile, median, rank, pearson, spearman, proportionCI, finite,
} from './stats'
export { binaryMetrics, binaryFromLabels, confusionMatrix, multiclassMetrics } from './classification'
export { brierScore, brierSkillScore, logLoss, binEdges, calibration, rocAuc } from './probability'
export { rankingMetrics, GRADE_BUCKETS } from './ranking'
export type { ScoredOutcome } from './ranking'
export {
  buildTrades, tradingMetrics, maxDrawdown, downsideDeviation, annualisedSharpe,
} from './trading'
export {
  DEFAULT_PREDICTION_CONFIG, SIGNALS, predictedSignal, realisedSignal, predictedUp,
  hasDirection, directionSign, directionalProbability, directionalCorrect,
} from './predictions'
export type { PredictionConfig, Signal } from './predictions'
export { buildSlices, ADX_TREND_THRESHOLD } from './slices'
export type { Slice, SliceOptions } from './slices'
export { evaluate, evaluateSlice, inferHorizons } from './evaluate'
export type { EvaluateOptions } from './evaluate'
export {
  toJson, toCsv, calibrationCsv, bucketCsv, toMarkdown, MIN_TRADES_FOR_RANKING,
} from './report'
