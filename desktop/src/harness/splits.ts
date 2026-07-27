/**
 * Walk-forward splits.
 *
 * A split is a contiguous train block, an embargo gap, and a contiguous test
 * block, all in bar indices of the source series. Splits never overlap in
 * test, and train always precedes test in time.
 *
 * WHY THE EMBARGO EXISTS
 *
 * An observation at train bar `t` carries a label computed from bars up to
 * `t + h`. If `t + h` reaches into the test block, the training set contains a
 * label determined by test-period price action. A model fitted on it has, in a
 * literal sense, been shown the answers. The gap must therefore be at least
 * the longest horizon in use:
 *
 *     embargoBars >= max(horizons)
 *
 * This is not a tunable. `defaultEmbargo` derives it, and `validateSplit`
 * refuses a split that violates it.
 *
 * A purge on the other side is unnecessary here: no test observation's window
 * can reach a train bar's label, because features look only backwards and
 * labels only forwards. It WOULD be necessary if features were ever built from
 * centred windows, which is one more reason the harness forbids them.
 */
import type { Observation, Split } from './types'

export interface SplitConfig {
  /** Bars in each training block. */
  readonly trainBars: number
  /** Bars in each test block. */
  readonly testBars: number
  /** Bars discarded between train and test. Must be >= max(horizons). */
  readonly embargoBars: number
  /**
   * `rolling` keeps the train block a fixed width and slides it forward.
   * `anchored` keeps the train start pinned and grows the block.
   *
   * Rolling measures an engine that adapts; anchored measures one that
   * accumulates. Neither is "correct" — Sentinel fits no parameters at
   * runtime, so for V5 the distinction only affects which observations a
   * calibrator (Phase 4) is allowed to see.
   */
  readonly mode: 'rolling' | 'anchored'
}

/**
 * The smallest embargo that cannot leak, given the horizons in use.
 *
 * PROVENANCE: derived, not chosen. A label at train bar `t` reads bars through
 * `t + max(h)`; the first test bar must therefore be at least `max(h) + 1`
 * bars after the last train bar. Expressed as a gap width, that is `max(h)`.
 */
export function defaultEmbargo(horizons: readonly number[]): number {
  if (horizons.length === 0) throw new Error('horizons must not be empty')
  return Math.max(...horizons)
}

/**
 * Splits covering `[firstBar, lastBar]`.
 *
 * Test blocks tile the range without gaps or overlap, so every observation
 * after the first train block is tested exactly once. A trailing remainder
 * shorter than `testBars` is dropped rather than evaluated as a short block:
 * a fold with a quarter of the sample would be pooled with full folds and
 * would distort any per-fold dispersion statistic.
 */
export function walkForwardSplits(
  firstBar: number,
  lastBar: number,
  config: SplitConfig,
): Split[] {
  const { trainBars, testBars, embargoBars, mode } = config
  if (!Number.isInteger(trainBars) || trainBars < 1) throw new Error(`trainBars must be a positive integer, got ${trainBars}`)
  if (!Number.isInteger(testBars) || testBars < 1) throw new Error(`testBars must be a positive integer, got ${testBars}`)
  if (!Number.isInteger(embargoBars) || embargoBars < 0) throw new Error(`embargoBars must be a non-negative integer, got ${embargoBars}`)

  const splits: Split[] = []
  const anchor = firstBar
  let trainStart = firstBar

  for (;;) {
    const trainEnd = trainStart + trainBars           // exclusive
    const testStart = trainEnd + embargoBars
    const testEnd = testStart + testBars              // exclusive
    if (testEnd > lastBar + 1) break

    splits.push({
      index: splits.length,
      trainStart: mode === 'anchored' ? anchor : trainStart,
      trainEnd,
      embargoBars,
      testStart,
      testEnd,
    })
    trainStart += testBars
  }
  return splits
}

/** Throws if a split could leak. Called by the tests; cheap enough to call anywhere. */
export function validateSplit(split: Split, horizons: readonly number[]): void {
  const need = defaultEmbargo(horizons)
  if (split.embargoBars < need) {
    throw new Error(
      `split ${split.index}: embargo ${split.embargoBars} < max horizon ${need}; `
      + `a training label would be computed from test-period bars`,
    )
  }
  if (split.trainEnd <= split.trainStart) throw new Error(`split ${split.index}: empty train block`)
  if (split.testEnd <= split.testStart) throw new Error(`split ${split.index}: empty test block`)
  if (split.testStart - split.trainEnd !== split.embargoBars) {
    throw new Error(`split ${split.index}: gap ${split.testStart - split.trainEnd} != embargo ${split.embargoBars}`)
  }
}

/** Observations of one series whose decision bar falls in the train block. */
export function trainSet(observations: readonly Observation[], split: Split): Observation[] {
  return observations.filter(o => o.barIndex >= split.trainStart && o.barIndex < split.trainEnd)
}

/** Observations of one series whose decision bar falls in the test block. */
export function testSet(observations: readonly Observation[], split: Split): Observation[] {
  return observations.filter(o => o.barIndex >= split.testStart && o.barIndex < split.testEnd)
}
