import { describe, it, expect } from 'vitest'
import { compareOutputs } from '../compare'
import { computeMetrics } from '../metrics'
import { generateReport } from '../report'
import { runBenchmark, replayDataset } from '../index'
import { ABSENT } from '../types'
import { PipelineError } from '../../pipeline/index'
import {
  makeDataset,
  makeMockResult,
  standardMockResult,
  expectedFromResult,
} from './helpers'

// ── compareOutputs — perfect match ──────────────────────────────────────────

describe('compareOutputs — perfect match', () => {
  it('returns PASS for every field when actual matches expected', () => {
    const actual = standardMockResult()
    const expected = {
      'confidence.grade': 'moderate',
      'confidence.score': 5.2,
      'validation.passed': true,
    }
    const results = compareOutputs(actual, expected)
    expect(results).toHaveLength(3)
    expect(results.every(r => r.status === 'PASS')).toBe(true)
  })

  it('returns empty array when expected is empty', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, {})
    expect(results).toHaveLength(0)
  })

  it('PASS comparisons have severity info', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'confidence.grade': 'moderate' })
    expect(results[0].severity).toBe('info')
  })
})

// ── compareOutputs — single mismatch ────────────────────────────────────────

describe('compareOutputs — single field mismatch', () => {
  it('returns FAIL when string value differs', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'confidence.grade': 'strong' })
    expect(results[0].status).toBe('FAIL')
    expect(results[0].expected).toBe('strong')
    expect(results[0].actual).toBe('moderate')
  })

  it('FAIL has severity error', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'confidence.grade': 'strong' })
    expect(results[0].severity).toBe('error')
  })

  it('FAIL includes a descriptive message', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'confidence.grade': 'strong' })
    expect(results[0].message).toBeDefined()
    expect(results[0].message?.length).toBeGreaterThan(0)
  })

  it('returns FAIL when boolean value differs', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'validation.passed': false })
    expect(results[0].status).toBe('FAIL')
  })
})

// ── compareOutputs — multiple mismatches ────────────────────────────────────

describe('compareOutputs — multiple mismatches', () => {
  it('reports each mismatch individually', () => {
    const actual = standardMockResult()
    const expected = {
      'confidence.grade': 'very_strong',   // FAIL
      'confidence.score': 9.9,             // FAIL
      'validation.passed': true,           // PASS
    }
    const results = compareOutputs(actual, expected)
    expect(results.filter(r => r.status === 'FAIL')).toHaveLength(2)
    expect(results.filter(r => r.status === 'PASS')).toHaveLength(1)
  })

  it('preserves order matching Object.keys(expected)', () => {
    const actual = standardMockResult()
    const expected = { 'confidence.grade': 'moderate', 'confidence.score': 5.2 }
    const results = compareOutputs(actual, expected)
    expect(results[0].field).toBe('confidence.grade')
    expect(results[1].field).toBe('confidence.score')
  })
})

// ── compareOutputs — missing field ──────────────────────────────────────────

describe('compareOutputs — missing field', () => {
  it('returns MISSING when the path does not exist in actual', () => {
    const actual = makeMockResult({ confidence: { grade: 'moderate' } })
    const results = compareOutputs(actual, { 'confidence.nonExistentField': 'x' })
    expect(results[0].status).toBe('MISSING')
    expect(results[0].actual).toBeUndefined()
  })

  it('MISSING has severity error', () => {
    const actual = makeMockResult({})
    const results = compareOutputs(actual, { 'confidence.grade': 'moderate' })
    expect(results[0].severity).toBe('error')
  })

  it('MISSING includes a message describing the absent path', () => {
    const actual = makeMockResult({})
    const results = compareOutputs(actual, { 'some.deep.path': 'value' })
    expect(results[0].message).toContain('some.deep.path')
  })

  it('returns MISSING when intermediate path segment is null', () => {
    const actual = makeMockResult({ analysis: null })
    const results = compareOutputs(actual, { 'analysis.fullTrend.trend': 'bullish' })
    expect(results[0].status).toBe('MISSING')
  })
})

// ── compareOutputs — extra field (ABSENT sentinel) ───────────────────────────

describe('compareOutputs — ABSENT sentinel', () => {
  it('returns EXTRA when field is present but expected absent', () => {
    const actual = makeMockResult({ confidence: { grade: 'moderate' } })
    const results = compareOutputs(actual, { 'confidence.grade': ABSENT })
    expect(results[0].status).toBe('EXTRA')
    expect(results[0].actual).toBe('moderate')
  })

  it('returns PASS when field is genuinely absent as expected', () => {
    const actual = makeMockResult({ confidence: {} })
    const results = compareOutputs(actual, { 'confidence.nonexistent': ABSENT })
    expect(results[0].status).toBe('PASS')
  })

  it('EXTRA has severity info', () => {
    const actual = makeMockResult({ x: 1 })
    const results = compareOutputs(actual, { x: ABSENT })
    expect(results[0].severity).toBe('info')
  })

  it('EXTRA includes a message explaining the unexpected presence', () => {
    const actual = makeMockResult({ x: 'unexpected' })
    const results = compareOutputs(actual, { x: ABSENT })
    expect(results[0].message).toBeDefined()
    expect(results[0].message?.length).toBeGreaterThan(0)
  })
})

// ── compareOutputs — nested paths ────────────────────────────────────────────

describe('compareOutputs — nested path resolution', () => {
  it('resolves three-level-deep paths', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'analysis.fullTrend.trend': 'strong bullish' })
    expect(results[0].status).toBe('PASS')
  })

  it('resolves confidence.grade at two levels', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'confidence.grade': 'moderate' })
    expect(results[0].status).toBe('PASS')
  })

  it('resolves array-length via .length property', () => {
    const actual = makeMockResult({ analysis: { evidence: [1, 2, 3] } })
    const results = compareOutputs(actual, { 'analysis.evidence.length': 3 })
    expect(results[0].status).toBe('PASS')
  })
})

// ── compareOutputs — arrays ───────────────────────────────────────────────────

describe('compareOutputs — arrays', () => {
  it('PASS when arrays are equal', () => {
    const actual = makeMockResult({ tags: ['a', 'b', 'c'] })
    const results = compareOutputs(actual, { tags: ['a', 'b', 'c'] })
    expect(results[0].status).toBe('PASS')
  })

  it('FAIL when arrays have different lengths', () => {
    const actual = makeMockResult({ tags: ['a', 'b'] })
    const results = compareOutputs(actual, { tags: ['a', 'b', 'c'] })
    expect(results[0].status).toBe('FAIL')
  })

  it('FAIL when array element values differ', () => {
    const actual = makeMockResult({ tags: ['a', 'X', 'c'] })
    const results = compareOutputs(actual, { tags: ['a', 'b', 'c'] })
    expect(results[0].status).toBe('FAIL')
  })
})

// ── compareOutputs — floating-point tolerance ─────────────────────────────────

describe('compareOutputs — floating-point tolerance', () => {
  it('PASS when numeric difference is within default tolerance (0.001)', () => {
    const actual = makeMockResult({ score: 5.2001 })
    const results = compareOutputs(actual, { score: 5.2 })
    expect(results[0].status).toBe('PASS')
  })

  it('FAIL when numeric difference exceeds default tolerance', () => {
    const actual = makeMockResult({ score: 5.3 })
    const results = compareOutputs(actual, { score: 5.2 })
    expect(results[0].status).toBe('FAIL')
  })

  it('respects custom numericTolerance', () => {
    const actual = makeMockResult({ score: 5.5 })
    const results = compareOutputs(actual, { score: 5.2 }, { numericTolerance: 1.0 })
    expect(results[0].status).toBe('PASS')
  })

  it('exact numeric match is always PASS regardless of tolerance', () => {
    const actual = makeMockResult({ score: 5.2 })
    const results = compareOutputs(actual, { score: 5.2 }, { numericTolerance: 0 })
    expect(results[0].status).toBe('PASS')
  })
})

// ── compareOutputs — ignored paths ────────────────────────────────────────────

describe('compareOutputs — ignored paths', () => {
  it('skips fields listed in ignoredPaths', () => {
    const actual = standardMockResult()
    const expected = {
      'metadata.timestamp': 99999,      // should be ignored
      'metadata.executionTime': 99999,  // should be ignored
      'confidence.grade': 'moderate',  // should be compared
    }
    const results = compareOutputs(actual, expected)
    expect(results.every(r => !r.field.startsWith('metadata.timestamp'))).toBe(true)
    expect(results.every(r => !r.field.startsWith('metadata.executionTime'))).toBe(true)
    expect(results).toHaveLength(1)
    expect(results[0].field).toBe('confidence.grade')
  })

  it('respects custom ignoredPaths override', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'confidence.grade': 'wrong' }, {
      ignoredPaths: ['confidence.grade'],
    })
    expect(results).toHaveLength(0)
  })

  it('timing fields are ignored by default', () => {
    const actual = standardMockResult()
    const results = compareOutputs(actual, { 'metadata.timings.total': 99999 })
    expect(results).toHaveLength(0)
  })
})

// ── computeMetrics ────────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  const timings = { replayTime: 10, compareTime: 1, totalTime: 11 }

  it('accuracy is 100 when all fields pass', () => {
    const comparisons = [
      { field: 'a', status: 'PASS' as const, expected: 1, actual: 1, severity: 'info' as const },
      { field: 'b', status: 'PASS' as const, expected: 2, actual: 2, severity: 'info' as const },
    ]
    const metrics = computeMetrics(comparisons, timings)
    expect(metrics.accuracy).toBe(100)
    expect(metrics.passedFields).toBe(2)
    expect(metrics.failedFields).toBe(0)
  })

  it('accuracy is 0 when all fields fail', () => {
    const comparisons = [
      { field: 'a', status: 'FAIL' as const, expected: 1, actual: 2, severity: 'error' as const },
    ]
    const metrics = computeMetrics(comparisons, timings)
    expect(metrics.accuracy).toBe(0)
    expect(metrics.failedFields).toBe(1)
  })

  it('accuracy is 50 when half pass', () => {
    const comparisons = [
      { field: 'a', status: 'PASS' as const, expected: 1, actual: 1, severity: 'info' as const },
      { field: 'b', status: 'FAIL' as const, expected: 2, actual: 3, severity: 'error' as const },
    ]
    const metrics = computeMetrics(comparisons, timings)
    expect(metrics.accuracy).toBe(50)
  })

  it('accuracy is 100 when comparisons array is empty', () => {
    const metrics = computeMetrics([], timings)
    expect(metrics.accuracy).toBe(100)
    expect(metrics.totalFields).toBe(0)
  })

  it('counts each status correctly', () => {
    const comparisons = [
      { field: 'a', status: 'PASS' as const, expected: 1, actual: 1, severity: 'info' as const },
      { field: 'b', status: 'FAIL' as const, expected: 2, actual: 3, severity: 'error' as const },
      { field: 'c', status: 'MISSING' as const, expected: 4, actual: undefined, severity: 'error' as const },
      { field: 'd', status: 'EXTRA' as const, expected: '$absent' as const, actual: 5, severity: 'info' as const },
    ]
    const metrics = computeMetrics(comparisons, timings)
    expect(metrics.passedFields).toBe(1)
    expect(metrics.failedFields).toBe(1)
    expect(metrics.missingFields).toBe(1)
    expect(metrics.extraFields).toBe(1)
    expect(metrics.totalFields).toBe(4)
  })

  it('timings are passed through unchanged', () => {
    const metrics = computeMetrics([], timings)
    expect(metrics.timings).toEqual(timings)
  })
})

// ── generateReport ────────────────────────────────────────────────────────────

describe('generateReport', () => {
  function makeResult(overrides: Partial<Parameters<typeof generateReport>[0]> = {}): Parameters<typeof generateReport>[0] {
    const base = standardMockResult()
    const comparisons = [
      { field: 'confidence.grade', status: 'PASS' as const, expected: 'moderate', actual: 'moderate', severity: 'info' as const },
    ]
    const timings = { replayTime: 10, compareTime: 1, totalTime: 11 }
    const metrics = computeMetrics(comparisons, timings)
    return {
      symbol: 'BTCUSDT',
      interval: '1h' as const,
      datasetMetadata: {},
      analysis: base,
      expected: { 'confidence.grade': 'moderate' },
      comparisons,
      metrics,
      passed: true,
      score: 100,
      summary: 'All fields match',
      ...overrides,
    }
  }

  it('returns a non-empty string', () => {
    const report = generateReport(makeResult())
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
  })

  it('includes the symbol and interval in the header', () => {
    const report = generateReport(makeResult())
    expect(report).toContain('BTCUSDT')
    expect(report).toContain('1h')
  })

  it('shows PASS when benchmark passed', () => {
    const report = generateReport(makeResult({ passed: true }))
    expect(report).toContain('PASS')
  })

  it('shows FAIL when benchmark failed', () => {
    const comparisons = [
      { field: 'confidence.grade', status: 'FAIL' as const, expected: 'strong', actual: 'moderate', severity: 'error' as const, message: 'mismatch' },
    ]
    const timings = { replayTime: 5, compareTime: 1, totalTime: 6 }
    const report = generateReport(makeResult({
      passed: false,
      comparisons,
      metrics: computeMetrics(comparisons, timings),
    }))
    expect(report).toContain('FAIL')
  })

  it('lists differences section when mismatches exist', () => {
    const comparisons = [
      { field: 'confidence.grade', status: 'FAIL' as const, expected: 'strong', actual: 'moderate', severity: 'error' as const, message: 'Expected "strong", got "moderate"' },
    ]
    const timings = { replayTime: 5, compareTime: 1, totalTime: 6 }
    const report = generateReport(makeResult({
      passed: false,
      comparisons,
      metrics: computeMetrics(comparisons, timings),
    }))
    expect(report).toContain('Differences')
    expect(report).toContain('confidence.grade')
  })

  it('shows all-match message when no failures', () => {
    const report = generateReport(makeResult())
    expect(report).toContain('All compared fields match')
  })

  it('includes accuracy percentage', () => {
    const report = generateReport(makeResult())
    expect(report).toContain('100.0%')
  })

  it('includes timing information', () => {
    const report = generateReport(makeResult())
    expect(report).toContain('Replay time')
    expect(report).toContain('Total time')
  })
})

// ── runBenchmark — integration ────────────────────────────────────────────────

describe('runBenchmark — integration', () => {
  it('returns a BenchmarkResult with all required fields', async () => {
    const dataset = makeDataset(100)
    const result = await runBenchmark({ dataset, expected: {} })
    expect(result.symbol).toBe('BTCUSDT')
    expect(result.interval).toBe('1h')
    expect(result.analysis).toBeDefined()
    expect(result.comparisons).toBeDefined()
    expect(result.metrics).toBeDefined()
    expect(typeof result.passed).toBe('boolean')
    expect(typeof result.score).toBe('number')
    expect(typeof result.summary).toBe('string')
  })

  it('passes when expected is empty', async () => {
    const dataset = makeDataset(100)
    const result = await runBenchmark({ dataset, expected: {} })
    expect(result.passed).toBe(true)
    expect(result.metrics.totalFields).toBe(0)
    expect(result.score).toBe(100)
  })

  it('perfect match: captures actual output and re-asserts it', async () => {
    const dataset = makeDataset(100)
    const first = await runBenchmark({ dataset, expected: {} })
    const expected = expectedFromResult(first.analysis)
    const second = await runBenchmark({ dataset, expected })
    expect(second.passed).toBe(true)
    expect(second.metrics.failedFields).toBe(0)
    expect(second.score).toBe(100)
  })

  it('detects a regression when a field no longer matches', async () => {
    const dataset = makeDataset(100)
    const result = await runBenchmark({
      dataset,
      expected: { 'confidence.grade': 'this_grade_does_not_exist' },
    })
    expect(result.passed).toBe(false)
    expect(result.metrics.failedFields).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
  })

  it('metadata.version is present in analysis output', async () => {
    const dataset = makeDataset(100)
    const result = await runBenchmark({ dataset, expected: {} })
    expect(result.analysis.metadata.version).toBeDefined()
  })

  it('datasetMetadata passes through from dataset', async () => {
    const dataset = makeDataset(100)
    const result = await runBenchmark({ dataset, expected: {} })
    expect(result.datasetMetadata).toMatchObject({ description: 'test dataset' })
  })
})

// ── runBenchmark — timing presence ────────────────────────────────────────────

describe('runBenchmark — timings', () => {
  it('metrics.timings has replayTime, compareTime, totalTime', async () => {
    const result = await runBenchmark({ dataset: makeDataset(100), expected: {} })
    expect(result.metrics.timings.replayTime).toBeGreaterThanOrEqual(0)
    expect(result.metrics.timings.compareTime).toBeGreaterThanOrEqual(0)
    expect(result.metrics.timings.totalTime).toBeGreaterThanOrEqual(0)
  })

  it('totalTime >= replayTime + compareTime', async () => {
    const result = await runBenchmark({ dataset: makeDataset(100), expected: {} })
    const { replayTime, compareTime, totalTime } = result.metrics.timings
    expect(totalTime).toBeGreaterThanOrEqual(replayTime + compareTime)
  })
})

// ── runBenchmark — determinism ─────────────────────────────────────────────────

describe('runBenchmark — determinism', () => {
  it('produces identical non-timing comparisons for identical inputs', async () => {
    const dataset = makeDataset(100)
    const expected = { 'confidence.grade': 'moderate', 'validation.passed': true }

    const r1 = await runBenchmark({ dataset, expected })
    const r2 = await runBenchmark({ dataset, expected })

    const stableComparisons = (r: typeof r1) =>
      r.comparisons.map(c => ({ field: c.field, status: c.status, expected: c.expected, actual: c.actual }))

    expect(stableComparisons(r1)).toEqual(stableComparisons(r2))
  })
})

// ── runBenchmark — invalid / edge cases ────────────────────────────────────────

describe('runBenchmark — edge cases', () => {
  it('throws PipelineError when dataset has no candles', async () => {
    const dataset = makeDataset(0)
    await expect(runBenchmark({ dataset, expected: {} })).rejects.toThrow(PipelineError)
  })

  it('throws insufficient_candles for datasets below minCandleCount', async () => {
    const dataset = makeDataset(5)
    try {
      await runBenchmark({ dataset, expected: {} })
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as PipelineError).code).toBe('insufficient_candles')
    }
  })

  it('allows small datasets when minCandleCount override is used', async () => {
    const dataset = makeDataset(10)
    const result = await runBenchmark({
      dataset,
      expected: {},
      pipelineConfig: { minCandleCount: 5 },
    })
    expect(result.passed).toBe(true)
  })

  it('MISSING fields cause passed to be false', async () => {
    const dataset = makeDataset(100)
    const result = await runBenchmark({
      dataset,
      expected: { 'this.path.does.not.exist': 'anything' },
    })
    expect(result.passed).toBe(false)
    expect(result.metrics.missingFields).toBe(1)
  })
})

// ── replayDataset ─────────────────────────────────────────────────────────────

describe('replayDataset', () => {
  it('returns a PipelineResult with candles from the dataset', async () => {
    const dataset = makeDataset(100)
    const result = await replayDataset(dataset)
    expect(result.candles).toHaveLength(100)
    expect(result.candles).toBe(dataset.candles)
  })

  it('symbol in output matches dataset symbol (uppercased)', async () => {
    const dataset = makeDataset(100, { symbol: 'ethusdt' })
    const result = await replayDataset(dataset)
    expect(result.metadata.symbol).toBe('ETHUSDT')
  })

  it('interval in output matches dataset interval', async () => {
    const dataset = makeDataset(100, { interval: '4h' })
    const result = await replayDataset(dataset)
    expect(result.metadata.interval).toBe('4h')
  })

  it('is deterministic: two replays of the same dataset produce identical analysis', async () => {
    const dataset = makeDataset(100)
    const r1 = await replayDataset(dataset)
    const r2 = await replayDataset(dataset)
    expect(r1.confidence.score).toBe(r2.confidence.score)
    expect(r1.confidence.grade).toBe(r2.confidence.grade)
    expect(r1.validation.passed).toBe(r2.validation.passed)
    expect(r1.generatedAnalysis.headline).toBe(r2.generatedAnalysis.headline)
  })

  it('fetches timestamp from dataset.metadata.fetchedAt', async () => {
    const dataset = makeDataset(100, { fetchedAt: 12345 })
    const result = await replayDataset(dataset)
    expect(result.metadata.timestamp).toBe(12345)
  })
})
