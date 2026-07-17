import type { PipelineResult } from '../pipeline/types'
import type { ExpectedOutput, FieldComparison, DiffStatus, DiffSeverity, ComparisonConfig } from './types'
import { ABSENT } from './types'
import { DEFAULT_COMPARISON_CONFIG } from './config'

function resolvePath(obj: unknown, path: string): { found: true; value: unknown } | { found: false } {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { found: false }
    }
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return { found: false }
    }
    current = (current as Record<string, unknown>)[part]
  }
  return { found: true, value: current }
}

function valuesEqual(expected: unknown, actual: unknown, tolerance: number): boolean {
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) <= tolerance
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return false
    return expected.every((v, i) => valuesEqual(v, actual[i], tolerance))
  }
  return expected === actual
}

function diffSeverity(status: DiffStatus): DiffSeverity {
  if (status === 'PASS') return 'info'
  if (status === 'FAIL' || status === 'MISSING') return 'error'
  return 'info' // EXTRA
}

/**
 * Compare every key in `expected` against the corresponding dot-notation path
 * in `actual`. Keys listed in `config.ignoredPaths` are skipped.
 *
 * Special sentinel: when `expected[field] === ABSENT ('$absent')`, the field
 * must NOT exist in actual — producing EXTRA if it does, PASS if it does not.
 */
export function compareOutputs(
  actual: PipelineResult,
  expected: ExpectedOutput,
  config: Partial<ComparisonConfig> = {},
): FieldComparison[] {
  const cfg: ComparisonConfig = {
    numericTolerance: config.numericTolerance ?? DEFAULT_COMPARISON_CONFIG.numericTolerance,
    ignoredPaths: config.ignoredPaths ?? DEFAULT_COMPARISON_CONFIG.ignoredPaths,
  }

  const comparisons: FieldComparison[] = []

  for (const [field, expectedValue] of Object.entries(expected)) {
    if (cfg.ignoredPaths.includes(field)) continue

    const resolved = resolvePath(actual, field)

    const resolvedValue = resolved.found ? resolved.value : undefined

    // Absence assertion
    if (expectedValue === ABSENT) {
      const status: DiffStatus = resolved.found ? 'EXTRA' : 'PASS'
      comparisons.push({
        field,
        status,
        expected: ABSENT,
        actual: resolvedValue,
        severity: diffSeverity(status),
        message: status === 'EXTRA'
          ? `Field "${field}" was expected to be absent but has value ${JSON.stringify(resolvedValue)}`
          : undefined,
      })
      continue
    }

    let status: DiffStatus
    if (!resolved.found) {
      status = 'MISSING'
    } else if (valuesEqual(expectedValue, resolvedValue, cfg.numericTolerance)) {
      status = 'PASS'
    } else {
      status = 'FAIL'
    }

    comparisons.push({
      field,
      status,
      expected: expectedValue,
      actual: resolvedValue,
      severity: diffSeverity(status),
      message: status === 'FAIL'
        ? `Expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(resolvedValue)}`
        : status === 'MISSING'
        ? `Path "${field}" not found in pipeline output`
        : undefined,
    })
  }

  return comparisons
}
