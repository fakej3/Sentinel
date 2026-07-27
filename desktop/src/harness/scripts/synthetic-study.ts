/**
 * The synthetic study: what can be measured about Sentinel without market data.
 *
 * WHAT THIS IS NOT. It is not a measurement of Sentinel's edge on real markets.
 * This environment has no route to any exchange — the network policy answers
 * 403 to CONNECT for every one tried (Binance, Binance Vision, CoinGecko,
 * Kraken) — so no real prices exist here to measure against. Anything below
 * describes the engine's behaviour under KNOWN generating processes, and that
 * is the whole of what it can support.
 *
 * WHAT IT IS. Three questions that a known process can answer and real data
 * cannot answer better:
 *
 *   NULL      On a martingale there is nothing to find. Every metric must say
 *             so. A framework that reports edge here is broken, and no result
 *             from it means anything.
 *
 *   DETECTION On a path that trends by construction, direction IS predictable.
 *             If the engine cannot beat the base rate where the answer exists
 *             and is simple, that is a definitive negative result — it does not
 *             need real data to be believed.
 *
 *   REGIME    Trend and mean-reverting range are the two regimes the engine
 *             claims to distinguish. Where does it work, and where does it
 *             lose? A mean-reverting range is where a momentum engine loses
 *             money rather than merely failing to make it.
 *
 * Run: npx tsx src/harness/scripts/synthetic-study.ts <outputDir>
 */
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { runSource } from '../engine'
import { regimeSource, type RegimeSpec, type RegimeSegment } from '../sources'
import { writeRun } from '../export'
import { evaluate, toCsv, toJson, toMarkdown, calibrationCsv, bucketCsv } from '../metrics/index'
import type { Observation } from '../types'

/**
 * Per-bar log-return volatility, by timeframe.
 *
 * PROVENANCE: scaled by sqrt(time), the standard diffusion scaling. Anchored at
 * σ = 0.01 per 1h bar, which corresponds to roughly 30% annualised at 24×365
 * bars — the right order of magnitude for a major crypto pair. The absolute
 * level does not affect any reported metric: every feature is scale-free and
 * every outcome is expressed in ATR units, so σ sets the units, not the answer.
 */
const SIGMA_1H = 0.01
const BARS_PER_HOUR: Record<string, number> = { '15m': 0.25, '1h': 1, '4h': 4, '1d': 24 }
function sigmaFor(tf: string): number {
  return SIGMA_1H * Math.sqrt(BARS_PER_HOUR[tf])
}

/**
 * Trend drift, set so a trend segment moves a fixed number of standard
 * deviations over its length rather than a fixed percentage.
 *
 * PROVENANCE: derived, not chosen for effect. A trend of `k` sigma over `n`
 * bars has drift = k·σ/√n. At k = 3 the segment's total move is 3 standard
 * deviations of its own noise — unambiguously a trend to any observer, but not
 * so large that detecting it is trivial. The point is to test whether the
 * engine finds a trend that is genuinely there, so the trend must be genuinely
 * there and genuinely detectable.
 */
const TREND_SIGMAS = 3
function driftFor(sigma: number, bars: number, direction: number): number {
  return (direction * TREND_SIGMAS * sigma) / Math.sqrt(bars)
}

/**
 * Reversion speed for a range segment.
 *
 * PROVENANCE: derived from the horizon set. The longest horizon measured is 48
 * bars; a range whose deviations decay with a half-life of 24 bars — half the
 * longest horizon — is one where a trade held to any measured horizon is more
 * likely than not to have seen its move retraced. θ = ln(2)/24.
 */
const REVERT_THETA = Math.LN2 / 24

const SEGMENT_BARS = 400

function segments(kind: 'up' | 'down' | 'walk' | 'range' | 'switch', sigma: number): RegimeSegment[] {
  const drift = (d: number): RegimeSegment => ({ kind: 'drift', bars: SEGMENT_BARS, drift: driftFor(sigma, SEGMENT_BARS, d), sigma })
  const range = (): RegimeSegment => ({ kind: 'revert', bars: SEGMENT_BARS, theta: REVERT_THETA, sigma })
  const walk = (): RegimeSegment => ({ kind: 'drift', bars: SEGMENT_BARS, drift: 0, sigma })
  switch (kind) {
    case 'up': return [drift(1), drift(1), drift(1)]
    case 'down': return [drift(-1), drift(-1), drift(-1)]
    case 'walk': return [walk(), walk(), walk()]
    case 'range': return [range(), range(), range()]
    // The market-like case: trend, range, opposite trend. The engine must both
    // find the trends and survive the range between them.
    case 'switch': return [drift(1), range(), drift(-1)]
  }
}

export const REGIMES = ['walk', 'up', 'down', 'range', 'switch'] as const
export type RegimeKind = typeof REGIMES[number]

export const TIMEFRAMES = ['15m', '1h', '4h'] as const
const SERIES_PER_CELL = 12

/** The corpus: every regime × timeframe, twelve independently seeded paths each. */
export function buildSpecs(): RegimeSpec[] {
  const out: RegimeSpec[] = []
  let seed = 100_000
  for (const regime of REGIMES) {
    for (const tf of TIMEFRAMES) {
      for (let i = 0; i < SERIES_PER_CELL; i++) {
        out.push({
          symbol: `${regime.toUpperCase()}${String(i).padStart(2, '0')}`,
          timeframe: tf,
          seed: seed++,
          segments: segments(regime, sigmaFor(tf)),
        })
      }
    }
  }
  return out
}

/** Which regime a symbol belongs to — encoded in the name, so it survives export. */
export function regimeOf(symbol: string): RegimeKind {
  for (const r of REGIMES) if (symbol.startsWith(r.toUpperCase())) return r
  throw new Error(`cannot infer regime from symbol "${symbol}"`)
}

/**
 * STRIDE. Set to the longest horizon, so forward windows do not overlap and
 * every reported standard error is honest. The alternative — stride 1, for
 * ~48× more rows — would inflate the apparent sample size by the same factor
 * and make every interval in the report too narrow to believe.
 */
export const STRIDE = 48
export const HORIZONS = [4, 12, 24, 48]

export async function runStudy(outDir: string, generatedAt: string): Promise<{
  observations: Observation[]
  byRegime: Map<RegimeKind, Observation[]>
}> {
  const specs = buildSpecs()
  const source = regimeSource(specs, `synthetic-regimes(${REGIMES.join(',')} x ${TIMEFRAMES.join(',')} x ${SERIES_PER_CELL} seeds)`)
  const runs = await runSource(source, { stride: STRIDE, horizons: HORIZONS })
  const observations = runs.flatMap(r => [...r.observations])

  await mkdir(outDir, { recursive: true })
  await writeRun(path.join(outDir, 'observations'), source.name, runs, generatedAt)

  const byRegime = new Map<RegimeKind, Observation[]>()
  for (const o of observations) {
    const k = regimeOf(o.symbol)
    const bucket = byRegime.get(k)
    if (bucket === undefined) byRegime.set(k, [o]); else bucket.push(o)
  }

  // One report per regime, because pooling regimes would average a trend result
  // with a range result and describe neither — the exact mistake this study
  // exists to avoid.
  for (const [regime, obs] of byRegime) {
    const report = evaluate(obs, {
      overlapping: false,     // stride == max(horizon)
      horizons: HORIZONS,
      sourceName: `${source.name} [regime=${regime}]`,
      generatedAt,
    })
    const dir = path.join(outDir, regime)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'metrics.json'), toJson(report), 'utf8')
    await writeFile(path.join(dir, 'metrics.csv'), toCsv(report), 'utf8')
    await writeFile(path.join(dir, 'calibration.csv'), calibrationCsv(report), 'utf8')
    await writeFile(path.join(dir, 'buckets.csv'), bucketCsv(report), 'utf8')
    await writeFile(path.join(dir, 'REPORT.md'), toMarkdown(report), 'utf8')
  }

  return { observations, byRegime }
}

// Entry point. Guarded so the module can also be imported by tests.
if (process.argv[1] !== undefined && process.argv[1].endsWith('synthetic-study.ts')) {
  const outDir = process.argv[2] ?? 'harness-output'
  const t0 = Date.now()
  const { observations, byRegime } = await runStudy(outDir, '1970-01-01T00:00:00.000Z')
  console.log(`${observations.length} observations in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  for (const [k, v] of byRegime) console.log(`  ${k}: ${v.length}`)
  console.log(`written to ${outDir}`)
}
