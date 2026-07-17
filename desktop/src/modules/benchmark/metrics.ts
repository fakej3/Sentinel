import type { FieldComparison, BenchmarkMetrics, BenchmarkTimings } from './types'

export function computeMetrics(
  comparisons: FieldComparison[],
  timings: BenchmarkTimings,
): BenchmarkMetrics {
  const passedFields = comparisons.filter(c => c.status === 'PASS').length
  const failedFields = comparisons.filter(c => c.status === 'FAIL').length
  const missingFields = comparisons.filter(c => c.status === 'MISSING').length
  const extraFields = comparisons.filter(c => c.status === 'EXTRA').length
  const totalFields = comparisons.length

  const accuracy = totalFields === 0 ? 100 : (passedFields / totalFields) * 100

  return {
    totalFields,
    passedFields,
    failedFields,
    missingFields,
    extraFields,
    accuracy,
    timings,
  }
}
