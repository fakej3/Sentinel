/**
 * Causal scaling over a whole corpus.
 *
 * ── WHY THIS IS NOT JUST `RollingScaler` IN A LOOP ────────────────────────────
 *
 * `modules/signal/scaling.ts` holds its trailing window in an immutable array
 * and rebuilds it on every push. That is the right shape for a live engine
 * seeing one bar at a time. Here there are ~534,000 rows times 15 features, and
 * rebuilding a 252-element array eight million times copies two billion
 * elements before any statistic is computed.
 *
 * So this file keeps the same window in a ring buffer. That is a performance
 * change and nothing else, and it is not taken on trust: `__tests__/scaling`
 * asserts the two produce BIT-IDENTICAL output on random input, including the
 * null-handling and warm-up boundaries. The iteration order over the window is
 * oldest-to-newest in both, which is what makes bit-identity achievable rather
 * than merely approximate — floating-point addition is not associative, so a
 * different traversal order would silently give different last digits.
 *
 * ── SCALING IS COMPUTED ONCE OVER THE FULL TIMELINE, NOT PER FOLD ─────────────
 *
 * This looks like leakage and is not. A trailing scaler at row t reads only
 * rows before t within the same symbol, so its output at t is identical whether
 * it was computed in one pass over the whole history or restarted at the fold
 * boundary — except that restarting would DISCARD legitimate history the live
 * engine would have had, making the measurement pessimistic rather than
 * optimistic. The fold boundary controls what the MODEL may be fitted on; it
 * does not control what the market had already printed.
 */
import type { Corpus } from './corpus'
import { FEATURE_NAMES, DEFAULT_FEATURES } from '../../modules/signal/features'
import { MIN_SCALING_WINDOW } from '../../modules/signal/scaling'

export interface ScaledCorpus {
  readonly window: number
  /** Scaled columns keyed by feature name. NaN = unavailable, exactly as in `Corpus`. */
  readonly columns: Readonly<Record<string, Float64Array>>
  /** Rows for which every feature scaled successfully. */
  readonly fullyScaledRows: number
}

/** Fixed ring buffer holding the trailing non-null values of one feature. */
class Window {
  private readonly buf: Float64Array
  private start = 0
  private count = 0

  constructor(readonly size: number) {
    this.buf = new Float64Array(size)
  }

  get length(): number { return this.count }

  /** Value at logical position i, oldest first. */
  at(i: number): number {
    return this.buf[(this.start + i) % this.size]
  }

  /** Appends, dropping the oldest once full. `null` and non-finite are NOT appended. */
  push(v: number): void {
    if (!Number.isFinite(v)) return
    if (this.count < this.size) {
      this.buf[(this.start + this.count) % this.size] = v
      this.count++
    } else {
      this.buf[this.start] = v
      this.start = (this.start + 1) % this.size
    }
  }
}

/** Trailing z-score of `v` against the window, EXCLUDING `v` itself. */
function zscoreOf(w: Window, v: number): number {
  if (w.length < MIN_SCALING_WINDOW) return NaN
  const n = w.length
  let sum = 0
  for (let i = 0; i < n; i++) sum += w.at(i)
  const mean = sum / n
  let ss = 0
  for (let i = 0; i < n; i++) ss += (w.at(i) - mean) ** 2
  const sd = Math.sqrt(ss / (n - 1))
  if (!(sd > 0)) return NaN
  return (v - mean) / sd
}

/** Trailing midrank of `v`, centred to [-0.5, 0.5]. Ties get half credit. */
function rankOf(w: Window, v: number): number {
  if (w.length < MIN_SCALING_WINDOW) return NaN
  let below = 0
  let equal = 0
  for (let i = 0; i < w.length; i++) {
    const x = w.at(i)
    if (x < v) below++
    else if (x === v) equal++
  }
  return (below + 0.5 * equal) / w.length - 0.5
}

/**
 * Scales every feature causally, per symbol, in chronological order.
 *
 * REQUIRES rows grouped by symbol and ascending in date within each group,
 * which is how `extractCorpus` emits them. The requirement is checked rather
 * than assumed: out-of-order rows would scale a value against a window
 * containing its own future and the result would look entirely ordinary.
 */
export function scaleCorpus(corpus: Corpus, window: number): ScaledCorpus {
  if (!Number.isInteger(window) || window < MIN_SCALING_WINDOW) {
    throw new Error(`window must be an integer >= ${MIN_SCALING_WINDOW}, got ${window}`)
  }
  const n = corpus.rows
  const methods = new Map(DEFAULT_FEATURES.map(f => [f.name, f.scaling]))

  const columns: Record<string, Float64Array> = {}
  for (const name of FEATURE_NAMES) columns[name] = new Float64Array(n)

  const windows = new Map<string, Window>()
  let currentSymbol = -1

  for (let r = 0; r < n; r++) {
    const sym = corpus.symbolIdx[r]
    if (sym !== currentSymbol) {
      if (sym < currentSymbol) {
        throw new Error(`scaleCorpus: rows must be grouped by symbol; symbol index went ${currentSymbol} -> ${sym} at row ${r}`)
      }
      currentSymbol = sym
      windows.clear()
      for (const name of FEATURE_NAMES) windows.set(name, new Window(window))
    } else if (r > 0 && corpus.dateIdx[r] <= corpus.dateIdx[r - 1]) {
      throw new Error(
        `scaleCorpus: rows must ascend in date within a symbol; `
        + `date index ${corpus.dateIdx[r - 1]} -> ${corpus.dateIdx[r]} at row ${r}`,
      )
    }

    for (const name of FEATURE_NAMES) {
      const raw = corpus.features[name][r]
      const w = windows.get(name)!
      const method = methods.get(name)!
      let scaled: number
      if (!Number.isFinite(raw)) {
        scaled = NaN
      } else if (method === 'none') {
        scaled = raw
      } else if (method === 'zscore') {
        scaled = zscoreOf(w, raw)
      } else {
        scaled = rankOf(w, raw)
      }
      columns[name][r] = scaled
      // Push AFTER scaling: the value is scored against its own past only.
      w.push(raw)
    }
  }

  let fullyScaled = 0
  outer: for (let r = 0; r < n; r++) {
    for (const name of FEATURE_NAMES) if (!Number.isFinite(columns[name][r])) continue outer
    fullyScaled++
  }

  return { window, columns, fullyScaledRows: fullyScaled }
}
