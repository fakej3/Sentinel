import { describe, it, expect } from 'vitest'
import { toCsv, toJsonl, buildManifest } from '../export'
import { runSeries } from '../engine'
import { syntheticSeries } from '../sources'
import type { HorizonOutcome, Observation } from '../types'

/**
 * A minimal RFC 4180 reader, used to check the writer.
 *
 * Splitting on `,` would be wrong — a quoted field may contain one, which is
 * the entire point of quoting — and a test that split naively would report a
 * row-width failure that is its own fault. Parsing properly is also the only
 * way to assert the writer's quoting actually round-trips.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function outcome(up: boolean): HorizonOutcome {
  return { horizonBars: 4, forwardReturn: up ? 0.02 : -0.02, forwardReturnAtr: up ? 1 : -1, mfeAtr: 1.5, maeAtr: -0.5, up }
}

const OBS: Observation[] = [
  {
    symbol: 'AAA', timeframe: '1h', barIndex: 10, asOf: 1000,
    features: { rsi: 55, adx: 20 },
    categorical: { trend: 'ranging' },
    outcomes: { 4: outcome(true), 12: null },
  },
  {
    // Deliberately missing `adx`, and carrying a value that needs CSV quoting.
    symbol: 'BBB', timeframe: '4h', barIndex: 11, asOf: 2000,
    features: { rsi: 45 },
    categorical: { trend: 'weak, bullish' },
    outcomes: { 4: outcome(false), 12: null },
  },
]

describe('toCsv', () => {
  const csv = toCsv(OBS, [4, 12])
  const rows = parseCsv(csv)
  const header = rows[0]
  const cell = (row: number, col: string): string => rows[row][header.indexOf(col)]

  it('emits a header plus one row per observation', () => {
    expect(rows.length).toBe(3)
  })

  it('columns are the union across the corpus, so rows stay aligned', () => {
    expect(header.slice(0, 6)).toEqual(['symbol', 'timeframe', 'bar_index', 'as_of', 'f_adx', 'f_rsi'])
  })

  it('writes an absent feature as an EMPTY field, never 0', () => {
    expect(cell(1, 'f_adx')).toBe('20')
    expect(cell(2, 'f_adx')).toBe('')
  })

  it('writes an absent horizon as empty fields across all five outcome columns', () => {
    for (const c of ['y12_up', 'y12_return', 'y12_return_atr', 'y12_mfe_atr', 'y12_mae_atr']) {
      expect(header).toContain(c)
      expect(cell(1, c)).toBe('')
    }
  })

  it('encodes the boolean label as 1/0 so numeric readers do not choke', () => {
    expect(cell(1, 'y4_up')).toBe('1')
    expect(cell(2, 'y4_up')).toBe('0')
  })

  it('round-trips a field containing a comma', () => {
    expect(cell(2, 'c_trend')).toBe('weak, bullish')
    expect(csv).toContain('"weak, bullish"')
  })

  it('doubles an embedded quote rather than truncating the field', () => {
    const parsed = parseCsv(toCsv([{ ...OBS[0], categorical: { trend: 'a "b" c' } }], [4]))
    expect(parsed[1][parsed[0].indexOf('c_trend')]).toBe('a "b" c')
  })

  it('ends in a newline, so line counts are not short by one', () => {
    expect(csv.endsWith('\n')).toBe(true)
  })

  it('every row has exactly as many cells as the header', () => {
    for (const r of rows) expect(r.length).toBe(header.length)
  })
})

describe('toJsonl', () => {
  it('round-trips every observation losslessly', () => {
    const parsed = toJsonl(OBS).trimEnd().split('\n').map(l => JSON.parse(l))
    expect(parsed).toEqual(JSON.parse(JSON.stringify(OBS)))
  })

  it('emits one line per observation with no embedded newlines', () => {
    expect(toJsonl(OBS).trimEnd().split('\n').length).toBe(OBS.length)
  })
})

describe('buildManifest', () => {
  it('records enough to reproduce the run', () => {
    const runs = [runSeries(syntheticSeries({ symbol: 'M', timeframe: '1h', bars: 200, seed: 8 }), { lookbackBars: 60, horizons: [4] })]
    const m = buildManifest('synthetic(seed8)', runs, '2026-01-01T00:00:00.000Z')
    expect(m.sourceName).toBe('synthetic(seed8)')
    expect(m.generatedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(m.config.lookbackBars).toBe(60)
    expect(m.totalObservations).toBe(runs[0].observations.length)
    expect(m.series[0]).toMatchObject({ symbol: 'M', timeframe: '1h' })
  })

  it('takes its timestamp from the caller — a clock would break reproducibility', () => {
    const runs = [runSeries(syntheticSeries({ symbol: 'M', timeframe: '1h', bars: 200, seed: 8 }), { lookbackBars: 60, horizons: [4] })]
    const a = buildManifest('s', runs, 'T')
    const b = buildManifest('s', runs, 'T')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('export round-trip on a real run', () => {
  it('produces a rectangular CSV from a full corpus with heterogeneous features', () => {
    const runs = [
      runSeries(syntheticSeries({ symbol: 'AAA', timeframe: '1h', bars: 300, seed: 1 }), { lookbackBars: 60, horizons: [4, 12] }),
      runSeries(syntheticSeries({ symbol: 'BBB', timeframe: '1h', bars: 300, seed: 2 }), { lookbackBars: 60, horizons: [4, 12] }),
    ]
    const obs = runs.flatMap(r => [...r.observations])
    const rows = parseCsv(toCsv(obs, [4, 12]))
    expect(rows.length).toBe(obs.length + 1)
    for (const r of rows) expect(r.length).toBe(rows[0].length)
  })
})
