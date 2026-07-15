import type { Candle, Timeframe } from '../market/types'
import type { PipelineResult, PipelineConfig } from '../pipeline/types'

export interface BenchmarkDataset {
  symbol: string
  interval: Timeframe
  candles: Candle[]
  metadata?: Record<string, unknown>
}

/**
 * Keys are dot-notation paths into PipelineResult (e.g. "confidence.grade").
 * Use ABSENT as the value to assert a path must NOT exist in the actual output.
 */
export type ExpectedOutput = Record<string, unknown>

/** Sentinel: assert this path must not be present in the actual output. */
export const ABSENT = '$absent' as const

export type DiffStatus = 'PASS' | 'FAIL' | 'MISSING' | 'EXTRA'
export type DiffSeverity = 'error' | 'warning' | 'info'

export interface FieldComparison {
  field: string
  status: DiffStatus
  expected: unknown
  actual: unknown
  severity: DiffSeverity
  message?: string
}

export interface BenchmarkTimings {
  replayTime: number
  compareTime: number
  totalTime: number
}

export interface BenchmarkMetrics {
  totalFields: number
  passedFields: number
  failedFields: number
  missingFields: number
  extraFields: number
  accuracy: number
  timings: BenchmarkTimings
}

export interface BenchmarkResult {
  symbol: string
  interval: Timeframe
  datasetMetadata: Record<string, unknown>
  analysis: PipelineResult
  expected: ExpectedOutput
  comparisons: FieldComparison[]
  metrics: BenchmarkMetrics
  passed: boolean
  score: number
  summary: string
}

export interface ComparisonConfig {
  numericTolerance: number
  ignoredPaths: string[]
}

export interface BenchmarkOptions {
  dataset: BenchmarkDataset
  expected: ExpectedOutput
  pipelineConfig?: Partial<PipelineConfig>
  comparisonConfig?: Partial<ComparisonConfig>
}
