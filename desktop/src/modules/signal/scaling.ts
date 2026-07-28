/**
 * Causal feature scaling.
 *
 * Every scaler here reads a TRAILING window only. That is the whole contract:
 * scaling a feature by statistics computed over the full sample is the most
 * common silent look-ahead in quantitative work, because it leaks the future
 * distribution into the present observation without touching the future value.
 *
 * Two scalers, chosen for a measured reason:
 *
 *   zscore  (x − μ) / σ over the trailing window. Natural for roughly symmetric
 *           unbounded quantities.
 *
 *   rank    the value's trailing empirical percentile, centred to [-0.5, 0.5].
 *           Bounded, so a single outlier cannot dominate a linear combination.
 *           This matters on real data specifically: the synthetic corpus had
 *           Gaussian returns, real equities do not, and a z-score of a fat-
 *           tailed feature hands most of the weight to its tail.
 *
 * Neither imputes. `null` in, `null` out.
 */

/**
 * Minimum trailing observations before a scaler will emit a value.
 *
 * PROVENANCE: derived from the estimator, not chosen. A standard deviation
 * needs n ≥ 2 to exist at all, but its own relative standard error is
 * ≈ 1/√(2(n−1)); at n = 30 that is 13%, which is the conventional point at
 * which a sample sd is treated as usable. Below it the scaler abstains rather
 * than dividing by a number it cannot estimate.
 */
export const MIN_SCALING_WINDOW = 30

export interface ScalerState {
  /** Trailing raw values, oldest first. Bounded to `windowSize`. */
  readonly history: readonly number[]
  readonly windowSize: number
}

export function createScalerState(windowSize: number): ScalerState {
  if (!Number.isInteger(windowSize) || windowSize < MIN_SCALING_WINDOW) {
    throw new Error(`windowSize must be an integer >= ${MIN_SCALING_WINDOW}, got ${windowSize}`)
  }
  return { history: [], windowSize }
}

/**
 * Appends a value, dropping the oldest beyond `windowSize`.
 *
 * `null` is NOT appended: an unavailable observation must not shrink the
 * effective window of the values that are available, and it must not be
 * counted toward `MIN_SCALING_WINDOW`.
 */
export function pushValue(state: ScalerState, v: number | null): ScalerState {
  if (v === null || !Number.isFinite(v)) return state
  const next = [...state.history, v]
  return {
    windowSize: state.windowSize,
    history: next.length > state.windowSize ? next.slice(next.length - state.windowSize) : next,
  }
}

/**
 * Trailing z-score of `v`.
 *
 * `v` is scored against the history NOT including itself — the caller pushes
 * after scaling. Including the current value would shrink its own deviation
 * and, over a long run, systematically compress the extremes that carry the
 * information.
 *
 * Returns null when the window is short or degenerate (σ = 0). A constant
 * feature has no z-score, and returning 0 would claim it sits at its own mean,
 * which is true but useless and indistinguishable from a real zero deviation.
 */
export function zscore(state: ScalerState, v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null
  if (state.history.length < MIN_SCALING_WINDOW) return null
  const n = state.history.length
  let sum = 0
  for (const x of state.history) sum += x
  const mean = sum / n
  let ss = 0
  for (const x of state.history) ss += (x - mean) ** 2
  const sd = Math.sqrt(ss / (n - 1))
  if (!(sd > 0)) return null
  return (v - mean) / sd
}

/**
 * Trailing rank of `v`, centred to [-0.5, 0.5].
 *
 * Uses the midrank of `v` within the history: (below + 0.5·equal) / n, minus
 * 0.5. Ties get half credit, which keeps the transform monotone and unbiased
 * for discrete features — and Sentinel's features include several that take
 * few distinct values.
 */
export function rankScale(state: ScalerState, v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null
  if (state.history.length < MIN_SCALING_WINDOW) return null
  let below = 0
  let equal = 0
  for (const x of state.history) {
    if (x < v) below++
    else if (x === v) equal++
  }
  return (below + 0.5 * equal) / state.history.length - 0.5
}

/** Applies the scaling declared by a feature spec. */
export function applyScaling(
  method: 'zscore' | 'rank' | 'none',
  state: ScalerState,
  v: number | null,
): number | null {
  if (v === null || !Number.isFinite(v)) return null
  switch (method) {
    case 'zscore': return zscore(state, v)
    case 'rank': return rankScale(state, v)
    case 'none': return v
  }
}

/**
 * Rolling scaler over a whole feature set.
 *
 * Holds one `ScalerState` per feature name. Callers drive it one observation at
 * a time, in chronological order — which is what makes the trailing window
 * trailing. Feeding observations out of order silently produces a
 * forward-looking scale, so `scaleNext` records the last timestamp it saw and
 * refuses to go backwards.
 */
export class RollingScaler {
  private readonly states = new Map<string, ScalerState>()
  private lastAt: number | null = null

  constructor(
    private readonly specs: ReadonlyArray<{ name: string; scaling: 'zscore' | 'rank' | 'none' }>,
    windowSize: number,
  ) {
    // createScalerState validates; a second check here would be a second place
    // for the bound to drift.
    for (const s of specs) this.states.set(s.name, createScalerState(windowSize))
  }

  /**
   * Scales one observation and folds it into the trailing history.
   *
   * `at` must be non-decreasing. Out-of-order input would scale a value against
   * a window containing its own future, which is look-ahead by any definition.
   */
  scaleNext(raw: Readonly<Record<string, number | null>>, at: number): Record<string, number | null> {
    if (this.lastAt !== null && at < this.lastAt) {
      throw new Error(`RollingScaler: observations must be chronological; got ${at} after ${this.lastAt}`)
    }
    this.lastAt = at

    const out: Record<string, number | null> = {}
    for (const spec of this.specs) {
      const state = this.states.get(spec.name)!
      const v = raw[spec.name] ?? null
      out[spec.name] = applyScaling(spec.scaling, state, v)
      this.states.set(spec.name, pushValue(state, v))
    }
    return out
  }

  /** Trailing observations held for a feature — the support behind its scaling. */
  historySize(name: string): number {
    return this.states.get(name)?.history.length ?? 0
  }

  /** True once every feature has enough history to scale. */
  get warm(): boolean {
    for (const s of this.specs) {
      if (s.scaling === 'none') continue
      if ((this.states.get(s.name)?.history.length ?? 0) < MIN_SCALING_WINDOW) return false
    }
    return true
  }
}
