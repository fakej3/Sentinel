import { replayDataset } from './replay'
import { compareOutputs } from './compare'
import { computeMetrics } from './metrics'
import { DEFAULT_COMPARISON_CONFIG } from './config'
import type {
  BenchmarkOptions,
  BenchmarkResult,
  BenchmarkMetrics,
  BenchmarkTimings,
} from './types'

export type {
  BenchmarkDataset,
  ExpectedOutput,
  FieldComparison,
  DiffStatus,
  DiffSeverity,
  BenchmarkMetrics,
  BenchmarkTimings,
  BenchmarkResult,
  ComparisonConfig,
  BenchmarkOptions,
} from './types'
export { ABSENT } from './types'
export { DEFAULT_COMPARISON_CONFIG } from './config'
export { compareOutputs } from './compare'
export { computeMetrics } from './metrics'
export { replayDataset } from './replay'
export { generateReport } from './report'

function buildSummary(passed: boolean, metrics: BenchmarkMetrics): string {
  if (passed) {
    return `All ${metrics.totalFields} field(s) match expected output (accuracy: ${metrics.accuracy.toFixed(1)}%)`
  }
  const issues: string[] = []
  if (metrics.failedFields > 0) issues.push(`${metrics.failedFields} field(s) failed`)
  if (metrics.missingFields > 0) issues.push(`${metrics.missingFields} field(s) missing`)
  if (metrics.extraFields > 0) issues.push(`${metrics.extraFields} field(s) extra`)
  return `Benchmark failed: ${issues.join(', ')} (accuracy: ${metrics.accuracy.toFixed(1)}%)`
}

export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkResult> {
  const { dataset, expected, pipelineConfig, comparisonConfig } = options
  const cfg = { ...DEFAULT_COMPARISON_CONFIG, ...comparisonConfig }

  const totalStart = Date.now()

  const replayStart = Date.now()
  const analysis = await replayDataset(dataset, pipelineConfig)
  const replayTime = Date.now() - replayStart

  const compareStart = Date.now()
  const comparisons = compareOutputs(analysis, expected, cfg)
  const compareTime = Date.now() - compareStart

  const totalTime = Date.now() - totalStart

  const timings: BenchmarkTimings = { replayTime, compareTime, totalTime }
  const metrics = computeMetrics(comparisons, timings)

  const passed = metrics.failedFields === 0 && metrics.missingFields === 0 && metrics.extraFields === 0
  const score = metrics.accuracy

  return {
    symbol: dataset.symbol,
    interval: dataset.interval,
    datasetMetadata: dataset.metadata ?? {},
    analysis,
    expected,
    comparisons,
    metrics,
    passed,
    score,
    summary: buildSummary(passed, metrics),
  }
}
