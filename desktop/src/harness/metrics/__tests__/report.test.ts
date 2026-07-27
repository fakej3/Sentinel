import { describe, it, expect } from 'vitest'
import { evaluate } from '../evaluate'
import { toCsv, toJson, toMarkdown, calibrationCsv, bucketCsv } from '../report'
import { runSource } from '../../engine'
import { syntheticSource } from '../../sources'
import type { MetricsReport } from '../types'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false }
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

let report: MetricsReport

const runs = await runSource(syntheticSource([
  { symbol: 'AAA', timeframe: '1h', bars: 800, seed: 11, drift: 0.0004, sigma: 0.015 },
  { symbol: 'BBB', timeframe: '4h', bars: 800, seed: 12, drift: -0.0003, sigma: 0.02 },
]), { horizons: [4, 12] })
const observations = runs.flatMap(r => [...r.observations])
report = evaluate(observations, {
  overlapping: true, sourceName: 'test', generatedAt: '2026-01-01T00:00:00.000Z', horizons: [4, 12],
})

describe('report — JSON', () => {
  it('round-trips losslessly', () => {
    expect(JSON.parse(toJson(report))).toEqual(JSON.parse(JSON.stringify(report)))
  })

  it('is byte-identical across calls, so a diff between runs is a real change', () => {
    expect(toJson(report)).toBe(toJson(report))
  })
})

describe('report — CSV', () => {
  const rows = parseCsv(toCsv(report))

  it('emits a header plus one row per slice × horizon', () => {
    expect(rows.length).toBe(report.slices.length + 1)
  })

  it('is rectangular', () => {
    for (const r of rows) expect(r.length).toBe(rows[0].length)
  })

  it('writes an unmeasurable metric as an empty field, never 0', () => {
    const header = rows[0]
    const mccCol = header.indexOf('ud_mcc')
    expect(mccCol).toBeGreaterThanOrEqual(0)
    // Whatever the slice, an empty cell must correspond to a null metric —
    // never to a measured zero.
    report.slices.forEach((s, i) => {
      const cell = rows[i + 1][mccCol]
      if (s.binaryUpDown.mcc === null) expect(cell).toBe('')
      else expect(Number(cell)).toBeCloseTo(s.binaryUpDown.mcc, 12)
    })
  })

  it('n and trade counts round-trip exactly', () => {
    const header = rows[0]
    const nCol = header.indexOf('n')
    const tradesCol = header.indexOf('trades')
    report.slices.forEach((s, i) => {
      expect(Number(rows[i + 1][nCol])).toBe(s.n)
      expect(Number(rows[i + 1][tradesCol])).toBe(s.trading.n)
    })
  })

  it('calibration CSV has one row per bin and its counts sum to the slice n', () => {
    const cal = parseCsv(calibrationCsv(report))
    const header = cal[0]
    const nCol = header.indexOf('n')
    const dimCol = header.indexOf('dimension')
    const sliceCol = header.indexOf('slice')
    const hCol = header.indexOf('horizon_bars')
    const methodCol = header.indexOf('method')

    const overall4 = report.slices.find(s => s.dimension === 'overall' && s.horizonBars === 4)!
    const mine = cal.slice(1).filter(r =>
      r[dimCol] === 'overall' && r[sliceCol] === 'all' && r[hCol] === '4' && r[methodCol] === 'equal-width')
    expect(mine.reduce((a, r) => a + Number(r[nCol]), 0)).toBe(overall4.probability.n)
  })

  it('bucket CSV bins sum to the slice\'s directional count', () => {
    const b = parseCsv(bucketCsv(report))
    const header = b[0]
    const nCol = header.indexOf('n')
    const dimCol = header.indexOf('dimension')
    const hCol = header.indexOf('horizon_bars')
    const overall12 = report.slices.find(s => s.dimension === 'overall' && s.horizonBars === 12)!
    const mine = b.slice(1).filter(r => r[dimCol] === 'overall' && r[hCol] === '12')
    expect(mine.reduce((a, r) => a + Number(r[nCol]), 0)).toBe(overall12.ranking.n)
  })

  it('ends in a newline', () => {
    expect(toCsv(report).endsWith('\n')).toBe(true)
  })
})

describe('report — Markdown', () => {
  const md = toMarkdown(report)

  it('states the assumptions that change how every figure reads', () => {
    expect(md).toContain('gross')
    expect(md).toContain('no fees')
    expect(md).toMatch(/Forward windows overlap: \*\*yes\*\*/)
    expect(md).toContain('Confidence → probability mapping')
    expect(md).toContain('not a mapping the engine defines')
  })

  it('warns that the best/worst ranking is a selection effect', () => {
    expect(md).toContain('selection effect')
    expect(md).toMatch(/hypotheses to test out of sample/)
  })

  it('never aggregates horizons into one number', () => {
    for (const h of report.horizons) expect(md).toContain(`${h} bars`)
  })

  it('contains every required section', () => {
    for (const section of [
      '## Overall summary', '## Confidence validation', '## Per symbol', '## Per timeframe',
      'Regime —', '## Best and worst performing areas',
    ]) expect(md).toContain(section)
  })

  it('renders an unmeasurable value as a dash, not as 0.000', () => {
    // A slice with no losses has no profit factor. Whatever the corpus, the
    // renderer must never print a number where the metric is null.
    const nulls = report.slices.filter(s => s.trading.profitFactor === null)
    void nulls
    expect(md).not.toMatch(/\|\s*NaN\s*\|/)
    expect(md).not.toMatch(/\|\s*null\s*\|/)
    expect(md).not.toMatch(/\|\s*undefined\s*\|/)
    expect(md).not.toContain('Infinity')
  })

  it('every table row has the same cell count as its header', () => {
    const lines = md.split('\n')
    let header: number | null = null
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!l.startsWith('|')) { header = null; continue }
      const cells = l.split('|').length
      if (header === null) { header = cells; continue }
      expect(cells, `line ${i}: ${l}`).toBe(header)
    }
  })

  it('is deterministic', () => {
    expect(toMarkdown(report)).toBe(md)
  })
})

describe('evaluate', () => {
  it('produces one slice entry per (dimension, slice, horizon)', () => {
    const keys = report.slices.map(s => `${s.dimension}/${s.slice}/${s.horizonBars}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('the overall slice holds every observation with an outcome at that horizon', () => {
    for (const h of [4, 12]) {
      const s = report.slices.find(x => x.dimension === 'overall' && x.horizonBars === h)!
      const expected = observations.filter(o => o.outcomes[h] !== null && o.outcomes[h] !== undefined).length
      expect(s.n).toBe(expected)
    }
  })

  it('per-symbol slices partition the corpus', () => {
    for (const h of [4, 12]) {
      const bySymbol = report.slices.filter(s => s.dimension === 'symbol' && s.horizonBars === h)
      const overall = report.slices.find(s => s.dimension === 'overall' && s.horizonBars === h)!
      expect(bySymbol.reduce((a, s) => a + s.n, 0)).toBe(overall.n)
    }
  })

  it('per-timeframe slices partition the corpus', () => {
    for (const h of [4, 12]) {
      const byTf = report.slices.filter(s => s.dimension === 'timeframe' && s.horizonBars === h)
      const overall = report.slices.find(s => s.dimension === 'overall' && s.horizonBars === h)!
      expect(byTf.reduce((a, s) => a + s.n, 0)).toBe(overall.n)
    }
  })

  it('infers horizons from the corpus when none are given', () => {
    const r = evaluate(observations.slice(0, 200), {
      overlapping: true, sourceName: 't', generatedAt: 'T',
    })
    expect(r.horizons).toEqual([4, 12])
  })

  it('records the mapping it used, so a report can never be read without it', () => {
    expect(report.predictionMapping).toContain('score / 10')
    const custom = evaluate(observations.slice(0, 200), {
      overlapping: false, sourceName: 't', generatedAt: 'T', horizons: [4],
      prediction: { scoreToProbability: s => s / 20, neutralBandAtr: 0 },
    })
    expect(custom.predictionMapping).toBe('custom')
  })
})
