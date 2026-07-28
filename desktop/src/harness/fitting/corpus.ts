/**
 * Feature extraction over a cross-sectional corpus.
 *
 * ── ONE EXPENSIVE PASS, MANY CHEAP ANALYSES ───────────────────────────────────
 *
 * Extracting the signal layer's RAW features costs ~0.5 ms per bar (indicators,
 * market structure and support/resistance dominate), which is ~5 minutes over
 * the 619,028-bar corpus. Scaling, fitting, calibration, ablation and
 * hyperparameter search all operate on those raw values and cost milliseconds.
 *
 * So the raw features are computed once and cached. Critically, SCALING IS NOT
 * PART OF THIS PASS: the trailing window is a hyperparameter, and baking one
 * choice into the cache would make the hyperparameter search a lie. The cache
 * holds only what is independent of every tuning decision.
 *
 * ── CAUSALITY ─────────────────────────────────────────────────────────────────
 *
 * At decision bar `i` the engine sees `candles.slice(i - lookback + 1, i + 1)`
 * and the outcome reads `candles[i + 1 .. i + h]`. Disjoint by construction,
 * the same invariant `harness/engine.ts` enforces and `no-lookahead.test.ts`
 * verifies empirically. Nothing here accumulates state across bars, so no
 * future value can travel backwards.
 *
 * ── COLUMNAR ──────────────────────────────────────────────────────────────────
 *
 * 619k rows times ~27 columns as objects would be several GB of pointers. As
 * typed-array columns it is ~134 MB and can be memory-mapped from a cache file.
 * `NaN` encodes an unavailable feature — the same meaning `null` carries in the
 * signal layer, in the only representation a Float64Array has.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Timeframe } from '../../modules/market/types'
import { analyseWindow } from '../snapshot'
import { extractCategorical, extractFeatures as oldEngineFeatures } from '../features'
import { computeOutcomes } from '../outcomes'
import { extractFeatures as signalFeatureValues } from '../../modules/signal/features'
import { FEATURE_NAMES } from '../../modules/signal/features'
import type { StockDataset } from './dataset'

/** Horizons in trading days. 5 is the primary; 1 and 20 test horizon sensitivity. */
export const HORIZONS = [1, 5, 20] as const
export const PRIMARY_HORIZON = 5

/**
 * Bars handed to the engine at each decision.
 *
 * PROVENANCE: not chosen here. `harness/types.ts` fixes it at 200 because
 * `DEFAULT_CANDLE_LIMIT = 200` is what the deployed engine actually fetches.
 * Measuring the new layer on a longer window than the old one would make the
 * comparison meaningless.
 */
export const LOOKBACK_BARS = 200

/** Columns carried alongside the signal features, for baselines and comparison. */
export const AUX_COLUMNS = [
  'old_confidence',      // the existing engine's 0-10 score
  'old_direction',       // +1 long, -1 short, 0 none — trade-plan.ts:216
  'dist_ema20',
  'dist_ema50',
  'dist_ema200',
  'rsi',
  'close',
  'atr',
] as const

export interface Corpus {
  readonly rows: number
  readonly symbols: readonly string[]
  readonly dates: readonly number[]
  /** Index into `symbols`, per row. Rows are grouped by symbol, ascending in date within. */
  readonly symbolIdx: Int32Array
  /** Index into `dates`, per row. */
  readonly dateIdx: Int32Array
  /** Raw (unscaled) signal features, keyed by name. NaN = unavailable. */
  readonly features: Readonly<Record<string, Float64Array>>
  readonly aux: Readonly<Record<string, Float64Array>>
  /** Forward simple return per horizon. NaN when the horizon ran past the data. */
  readonly forwardReturn: Readonly<Record<number, Float64Array>>
  readonly lookbackBars: number
  readonly horizons: readonly number[]
  readonly skipped: Readonly<Record<string, number>>
}

export interface ExtractOptions {
  readonly lookbackBars?: number
  readonly horizons?: readonly number[]
  /** Evaluate every Nth bar. 1 evaluates all. */
  readonly stride?: number
  /** Symbols to keep; all when absent. Applied deterministically after sorting. */
  readonly maxSymbols?: number
  readonly onProgress?: (done: number, total: number) => void
}

/**
 * Runs the extraction.
 *
 * Both engines are evaluated from the SAME window slice and the same
 * `analyseWindow` call, so the old engine's score and the new layer's features
 * describe an identical information set. Running them in separate passes would
 * leave open the possibility that they saw different data.
 */
export function extractCorpus(dataset: StockDataset, options: ExtractOptions = {}): Corpus {
  const lookbackBars = options.lookbackBars ?? LOOKBACK_BARS
  const horizons = options.horizons ?? [...HORIZONS]
  const stride = options.stride ?? 1
  if (!Number.isInteger(lookbackBars) || lookbackBars < 2) throw new Error('lookbackBars must be an integer >= 2')
  if (!Number.isInteger(stride) || stride < 1) throw new Error('stride must be a positive integer')
  if (horizons.length === 0) throw new Error('horizons must not be empty')

  const series = options.maxSymbols === undefined
    ? dataset.series
    : dataset.series.slice(0, options.maxSymbols)
  const symbols = series.map(s => s.symbol)
  const dateToIdx = new Map<number, number>()
  for (let i = 0; i < dataset.dates.length; i++) dateToIdx.set(dataset.dates[i], i)

  const maxH = Math.max(...horizons)
  const minH = Math.min(...horizons)

  // Upper bound on rows, so the typed arrays are allocated once.
  let capacity = 0
  for (const s of series) {
    const first = lookbackBars - 1
    const last = s.candles.length - minH - 1
    if (last >= first) capacity += Math.floor((last - first) / stride) + 1
  }

  const symbolIdx = new Int32Array(capacity)
  const dateIdx = new Int32Array(capacity)
  const features: Record<string, Float64Array> = {}
  for (const n of FEATURE_NAMES) features[n] = new Float64Array(capacity)
  const aux: Record<string, Float64Array> = {}
  for (const n of AUX_COLUMNS) aux[n] = new Float64Array(capacity)
  const forwardReturn: Record<number, Float64Array> = {}
  for (const h of horizons) forwardReturn[h] = new Float64Array(capacity)

  const skipped: Record<string, number> = {}
  const skip = (r: string): void => { skipped[r] = (skipped[r] ?? 0) + 1 }

  let n = 0
  const timeframe: Timeframe = series[0]?.timeframe ?? '1d'

  for (let si = 0; si < series.length; si++) {
    const s = series[si]
    const candles = s.candles
    const first = lookbackBars - 1
    const last = candles.length - minH - 1

    for (let i = first; i <= last; i += stride) {
      const di = dateToIdx.get(candles[i].openTime)
      if (di === undefined) { skip('date-not-on-axis'); continue }

      const window = candles.slice(i - lookbackBars + 1, i + 1)
      let snap
      try {
        snap = analyseWindow(s.symbol, timeframe, window)
      } catch {
        skip('analyse-threw')
        continue
      }
      const atr = snap.indicators.atr
      if (atr === null || !(atr > 0)) { skip('no-atr'); continue }

      const fv = signalFeatureValues({
        candles: window,
        timeframe,
        indicators: snap.indicators,
        marketStructure: snap.marketStructure,
        supportResistance: snap.supportResistance,
        higherTimeframes: new Map(),
      })

      const outcomes = computeOutcomes(candles, i, horizons, atr)
      // A row with no outcome at ANY horizon carries no label and would only
      // inflate the apparent sample size.
      let anyOutcome = false
      for (const h of horizons) if (outcomes[h] !== null) { anyOutcome = true; break }
      if (!anyOutcome) { skip('no-outcome-at-any-horizon'); continue }

      const cat = extractCategorical(snap)
      const of = oldEngineFeatures(snap, candles[i].close)

      symbolIdx[n] = si
      dateIdx[n] = di
      for (const name of FEATURE_NAMES) {
        const v = fv[name]
        features[name][n] = v.validity === 'ok' && v.value !== null ? v.value : NaN
      }
      aux['old_confidence'][n] = snap.confidence.score
      aux['old_direction'][n] = cat.direction === 'long' ? 1 : cat.direction === 'short' ? -1 : 0
      aux['dist_ema20'][n] = num(of['dist_ema20'])
      aux['dist_ema50'][n] = num(of['dist_ema50'])
      aux['dist_ema200'][n] = num(of['dist_ema200'])
      aux['rsi'][n] = num(of['rsi'])
      aux['close'][n] = candles[i].close
      aux['atr'][n] = atr
      for (const h of horizons) {
        const o = outcomes[h]
        forwardReturn[h][n] = o === null ? NaN : o.forwardReturn
      }
      n++
    }
    options.onProgress?.(si + 1, series.length)
  }
  void maxH

  const trim = <T extends Int32Array | Float64Array>(a: T): T => a.slice(0, n) as T
  const outFeatures: Record<string, Float64Array> = {}
  for (const k of FEATURE_NAMES) outFeatures[k] = trim(features[k])
  const outAux: Record<string, Float64Array> = {}
  for (const k of AUX_COLUMNS) outAux[k] = trim(aux[k])
  const outFwd: Record<number, Float64Array> = {}
  for (const h of horizons) outFwd[h] = trim(forwardReturn[h])

  return {
    rows: n,
    symbols,
    dates: dataset.dates,
    symbolIdx: trim(symbolIdx),
    dateIdx: trim(dateIdx),
    features: outFeatures,
    aux: outAux,
    forwardReturn: outFwd,
    lookbackBars,
    horizons,
    skipped,
  }
}

function num(v: number | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheManifest {
  readonly version: number
  readonly rows: number
  readonly symbols: readonly string[]
  readonly dates: readonly number[]
  readonly featureNames: readonly string[]
  readonly auxNames: readonly string[]
  readonly horizons: readonly number[]
  readonly lookbackBars: number
  readonly skipped: Readonly<Record<string, number>>
}

const CACHE_VERSION = 1

/**
 * Writes the corpus as a manifest plus one flat binary blob.
 *
 * The blob's column order is fixed by the manifest, so a reader never guesses.
 * Versioned because a change to `FEATURE_NAMES` silently invalidates the
 * layout, and reading a stale cache would produce a study of the wrong
 * features with no error at all.
 */
export async function writeCorpus(corpus: Corpus, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  const featureNames = Object.keys(corpus.features)
  const auxNames = Object.keys(corpus.aux)
  const manifest: CacheManifest = {
    version: CACHE_VERSION,
    rows: corpus.rows,
    symbols: corpus.symbols,
    dates: corpus.dates,
    featureNames,
    auxNames,
    horizons: corpus.horizons,
    lookbackBars: corpus.lookbackBars,
    skipped: corpus.skipped,
  }
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest))

  const n = corpus.rows
  const columns: Float64Array[] = [
    Float64Array.from(corpus.symbolIdx),
    Float64Array.from(corpus.dateIdx),
    ...featureNames.map(k => corpus.features[k]),
    ...auxNames.map(k => corpus.aux[k]),
    ...corpus.horizons.map(h => corpus.forwardReturn[h]),
  ]
  const blob = new Float64Array(columns.length * n)
  for (let c = 0; c < columns.length; c++) blob.set(columns[c], c * n)
  await writeFile(path.join(dir, 'columns.f64'), Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength))
}

export async function readCorpus(dir: string): Promise<Corpus> {
  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as CacheManifest
  if (manifest.version !== CACHE_VERSION) {
    throw new Error(`corpus cache version ${manifest.version} != ${CACHE_VERSION}; re-extract`)
  }
  const missing = FEATURE_NAMES.filter(f => !manifest.featureNames.includes(f))
  if (missing.length > 0) {
    throw new Error(`corpus cache predates features [${missing.join(', ')}]; re-extract`)
  }
  const buf = await readFile(path.join(dir, 'columns.f64'))
  const blob = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8)
  const n = manifest.rows
  let c = 0
  const take = (): Float64Array => blob.slice(c * n, ++c * n)

  const symbolIdx = Int32Array.from(take())
  const dateIdx = Int32Array.from(take())
  const features: Record<string, Float64Array> = {}
  for (const k of manifest.featureNames) features[k] = take()
  const aux: Record<string, Float64Array> = {}
  for (const k of manifest.auxNames) aux[k] = take()
  const forwardReturn: Record<number, Float64Array> = {}
  for (const h of manifest.horizons) forwardReturn[h] = take()

  return {
    rows: n,
    symbols: manifest.symbols,
    dates: manifest.dates,
    symbolIdx, dateIdx, features, aux, forwardReturn,
    lookbackBars: manifest.lookbackBars,
    horizons: manifest.horizons,
    skipped: manifest.skipped,
  }
}
