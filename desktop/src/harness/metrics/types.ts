/**
 * Metric result shapes.
 *
 * Every metric that can be undefined is typed `number | null`, and null means
 * "not measurable from this sample" — never "zero". The distinction is the
 * whole point: a slice where the engine never predicted a class has no
 * precision for it, and a report that prints 0.00 is asserting a measurement
 * it did not make.
 *
 * Every result carries its own `n`. A metric quoted without its sample size is
 * not a measurement.
 */
import type { Timeframe } from '../../modules/market/types'

// ── Classification ────────────────────────────────────────────────────────────

export interface BinaryClassificationMetrics {
  readonly n: number
  readonly tp: number
  readonly fp: number
  readonly fn: number
  readonly tn: number
  readonly accuracy: number | null
  readonly precision: number | null
  readonly recall: number | null
  readonly specificity: number | null
  readonly f1: number | null
  readonly balancedAccuracy: number | null
  readonly mcc: number | null
  /** Share of samples whose true label is positive. Every claim must beat this. */
  readonly baseRate: number | null
  readonly predictedPositiveRate: number | null
}

export interface ConfusionMatrix {
  readonly labels: readonly string[]
  /** `counts[trueIndex][predictedIndex]`. Row = truth, column = prediction. */
  readonly counts: readonly (readonly number[])[]
  readonly n: number
}

export interface PerClassMetrics {
  readonly label: string
  /** Samples whose TRUE class is this one. */
  readonly support: number
  /** Samples PREDICTED as this class. */
  readonly predicted: number
  readonly precision: number | null
  readonly recall: number | null
  readonly f1: number | null
}

export interface MulticlassMetrics {
  readonly matrix: ConfusionMatrix
  readonly n: number
  readonly accuracy: number | null
  readonly balancedAccuracy: number | null
  readonly macroPrecision: number | null
  readonly macroRecall: number | null
  readonly macroF1: number | null
  readonly weightedPrecision: number | null
  readonly weightedRecall: number | null
  readonly weightedF1: number | null
  readonly mcc: number | null
  readonly classes: readonly PerClassMetrics[]
}

// ── Probability / calibration ─────────────────────────────────────────────────

export type BinningMethod = 'equal-width' | 'quantile'

export interface CalibrationBin {
  readonly lower: number
  readonly upper: number
  readonly n: number
  /** Mean predicted probability in the bin. null when empty. */
  readonly meanPredicted: number | null
  /** Observed frequency of the positive class. null when empty. */
  readonly observedFrequency: number | null
  readonly hits: number
}

export interface CalibrationResult {
  readonly bins: readonly CalibrationBin[]
  readonly ece: number | null
  readonly mce: number | null
  readonly n: number
  readonly method: BinningMethod
  readonly requestedBins: number
  /** Bins below this count are excluded from MCE. Reported, not hidden. */
  readonly minBinCount: number
}

export interface ProbabilityMetrics {
  readonly n: number
  readonly brier: number | null
  /** 1 − Brier / (base·(1−base)). Positive means it beats forecasting the base rate. */
  readonly brierSkillScore: number | null
  readonly logLoss: number | null
  readonly logLossEps: number
  readonly rocAuc: number | null
  readonly calibrationEqualWidth: CalibrationResult
  readonly calibrationQuantile: CalibrationResult
}

// ── Ranking ───────────────────────────────────────────────────────────────────

export interface Bucket {
  readonly label: string
  readonly lower: number
  readonly upper: number
  readonly n: number
  readonly hitRate: number | null
  /** 95% interval for the hit rate, on the log-odds scale. null when degenerate. */
  readonly hitRateCI: { lower: number; upper: number } | null
  readonly averageReturnPct: number | null
  readonly averageR: number | null
  readonly meanScore: number | null
}

export interface RankingMetrics {
  readonly n: number
  readonly buckets: readonly Bucket[]
  readonly deciles: readonly Bucket[]
  /** Spearman rank correlation between score and the binary outcome. */
  readonly spearmanScoreOutcome: number | null
  /** Pearson correlation between score and the binary outcome (point-biserial). */
  readonly pearsonScoreOutcome: number | null
  /** Spearman between score and the continuous return, a stronger test than the binary one. */
  readonly spearmanScoreReturn: number | null
  /**
   * Whether hit rate is non-decreasing across buckets with n >= minBucketCount.
   * The direct answer to "does confidence monotonically increase with accuracy".
   */
  readonly monotonic: boolean | null
  /** Buckets where the hit rate fell relative to the previous eligible bucket. */
  readonly monotonicityBreaks: readonly { from: string; to: string; drop: number }[]
  readonly minBucketCount: number
}

// ── Trading ───────────────────────────────────────────────────────────────────

export interface Trade {
  readonly symbol: string
  readonly timeframe: Timeframe
  readonly asOf: number
  readonly barIndex: number
  readonly horizonBars: number
  readonly direction: 'long' | 'short'
  readonly confidenceScore: number | null
  /** Directional return over the holding period, as a fraction. */
  readonly returnPct: number
  readonly returnAtr: number
  readonly stopDistanceAtr: number
  /** Return in units of the plan's own risk. */
  readonly r: number
  /** Adverse excursion reached the stop at some point. Order vs target unknowable. */
  readonly stopTouched: boolean
  /** Favourable excursion reached the target. null when the plan had no target. */
  readonly targetTouched: boolean | null
  readonly maxFavourableR: number
  readonly maxAdverseR: number
}

export interface TradingMetrics {
  readonly n: number
  /** True when forward windows overlap; dispersion statistics are then dependent. */
  readonly overlapping: boolean
  readonly excludedNoStop: number
  readonly excludedNoOutcome: number
  readonly excludedNoDirection: number

  readonly winRate: number | null
  readonly lossRate: number | null
  /** Exactly-zero R. Kept separate so win + loss need not sum to 1. */
  readonly scratchRate: number | null
  readonly wins: number
  readonly losses: number

  readonly averageWinR: number | null
  readonly averageLossR: number | null
  readonly payoffRatio: number | null
  readonly profitFactor: number | null

  readonly expectancyR: number | null
  /** winRate·avgWin + lossRate·avgLoss. Must equal expectancyR. */
  readonly expectancyDecomposed: number | null

  readonly averageR: number | null
  readonly medianR: number | null
  readonly totalR: number
  readonly stdevR: number | null

  readonly sharpePerTrade: number | null
  readonly sortinoPerTrade: number | null

  readonly maxDrawdownR: number
  readonly recoveryFactor: number | null

  readonly averageReturnPct: number | null
  readonly medianReturnPct: number | null

  readonly stopTouchedRate: number | null
  readonly targetTouchedRate: number | null
  readonly averageMaxFavourableR: number | null
  readonly averageMaxAdverseR: number | null
}

// ── Composite ─────────────────────────────────────────────────────────────────

/** Everything measured for one slice at one horizon. */
export interface SliceMetrics {
  readonly slice: string
  readonly dimension: string
  readonly horizonBars: number
  readonly n: number
  /** Up/down call forced on every observation. */
  readonly binaryUpDown: BinaryClassificationMetrics
  /** Buy/sell/neutral, scoring what the engine actually said. */
  readonly threeWay: MulticlassMetrics
  /** Was the named direction right? Only observations with a direction. */
  readonly directional: BinaryClassificationMetrics
  readonly probability: ProbabilityMetrics
  readonly ranking: RankingMetrics
  readonly trading: TradingMetrics
}

export interface MetricsReport {
  readonly generatedAt: string
  readonly sourceName: string
  readonly totalObservations: number
  readonly horizons: readonly number[]
  readonly predictionMapping: string
  readonly overlapping: boolean
  readonly slices: readonly SliceMetrics[]
}
