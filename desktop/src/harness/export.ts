/**
 * Serialisation of a run.
 *
 * Two formats, for two consumers:
 *
 *   - JSONL keeps the full nested observation, one per line. It is the archive
 *     format: lossless, streamable, and diffable between runs.
 *   - CSV flattens to a rectangular design matrix. It is the analysis format,
 *     for Phase 3 and for anything outside this codebase.
 *
 * The CSV needs a decision the JSONL does not: what to write where a feature
 * is absent. It writes an EMPTY FIELD, not 0 and not NaN. Empty is the only
 * encoding every reader agrees means "missing"; zero would silently merge
 * "EMA200 unavailable" with "price exactly at EMA200", which is the defect
 * `features.ts` exists to avoid and would be reintroduced here.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Observation, RunResult } from './types'
import { featureNames } from './features'

/** RFC 4180 quoting: quote when the value contains a comma, quote, CR or LF. */
function csvField(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function num(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return ''
  return String(v)
}

/**
 * One row per observation; one column per feature, categorical, and outcome
 * field. Columns are the union across the whole corpus so rows align even when
 * different series had different indicators available.
 */
export function toCsv(observations: readonly Observation[], horizons: readonly number[]): string {
  const feats = featureNames(observations)
  const cats = [...new Set(observations.flatMap(o => Object.keys(o.categorical)))].sort()

  const header = [
    'symbol', 'timeframe', 'bar_index', 'as_of',
    ...feats.map(f => `f_${f}`),
    ...cats.map(c => `c_${c}`),
    ...horizons.flatMap(h => [
      `y${h}_up`, `y${h}_return`, `y${h}_return_atr`, `y${h}_mfe_atr`, `y${h}_mae_atr`,
    ]),
  ]

  const lines = [header.map(csvField).join(',')]
  for (const o of observations) {
    const row: string[] = [o.symbol, o.timeframe, String(o.barIndex), String(o.asOf)]
    for (const f of feats) row.push(num(o.features[f]))
    for (const c of cats) row.push(o.categorical[c] ?? '')
    for (const h of horizons) {
      const r = o.outcomes[h]
      if (r === null || r === undefined) {
        row.push('', '', '', '', '')
      } else {
        row.push(r.up ? '1' : '0', num(r.forwardReturn), num(r.forwardReturnAtr), num(r.mfeAtr), num(r.maeAtr))
      }
    }
    lines.push(row.map(csvField).join(','))
  }
  // Trailing newline: a POSIX text file ends in one, and its absence makes
  // `wc -l` under-report by exactly one row.
  return lines.join('\n') + '\n'
}

export function toJsonl(observations: readonly Observation[]): string {
  return observations.map(o => JSON.stringify(o)).join('\n') + '\n'
}

/**
 * The run's provenance, without the rows.
 *
 * A measurement that cannot be traced to the exact inputs that produced it is
 * an anecdote. This is written beside the data so a number in a later report
 * can always be resolved back to a source, a config and a sample size.
 */
export interface RunManifest {
  readonly sourceName: string
  readonly generatedAt: string
  readonly series: ReadonlyArray<{
    readonly symbol: string
    readonly timeframe: string
    readonly observations: number
    readonly skipped: Readonly<Record<string, number>>
  }>
  readonly config: RunResult['config']
  readonly totalObservations: number
}

export function buildManifest(
  sourceName: string,
  runs: readonly RunResult[],
  generatedAt: string,
): RunManifest {
  return {
    sourceName,
    generatedAt,
    series: runs.map(r => ({
      symbol: r.symbol,
      timeframe: r.timeframe,
      observations: r.observations.length,
      skipped: r.skipped,
    })),
    config: runs[0]?.config ?? { lookbackBars: 0, stride: 0, horizons: [], progressEvery: 0 },
    totalObservations: runs.reduce((n, r) => n + r.observations.length, 0),
  }
}

/**
 * Writes `observations.csv`, `observations.jsonl` and `manifest.json` to `dir`.
 *
 * `generatedAt` is a parameter rather than `new Date()` so that a run can be
 * byte-reproduced. Determinism ends where a clock begins.
 */
export async function writeRun(
  dir: string,
  sourceName: string,
  runs: readonly RunResult[],
  generatedAt: string,
): Promise<void> {
  await mkdir(dir, { recursive: true })
  const observations = runs.flatMap(r => [...r.observations])
  const horizons = runs[0]?.config.horizons ?? []
  await writeFile(path.join(dir, 'observations.csv'), toCsv(observations, horizons), 'utf8')
  await writeFile(path.join(dir, 'observations.jsonl'), toJsonl(observations), 'utf8')
  await writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify(buildManifest(sourceName, runs, generatedAt), null, 2) + '\n',
    'utf8',
  )
}
