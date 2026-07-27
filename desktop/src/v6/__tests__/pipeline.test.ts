import { describe, it, expect } from 'vitest'
import { analyseV6 } from '../index'
import { buildContext, baseView, higherViews } from '../context/multi-timeframe'
import { encodeSituation, allSignatureKeys } from '../situation/encoder'
import { retrieve, EMPTY_CORPUS, MIN_SAMPLE_SIZE } from '../analog/engine'
import type { AnalogCorpus } from '../analog/engine'
import { judge } from '../salience/engine'
import { renderSituation, renderVerdict } from '../narrative/renderer'
import { fromPath, scalePrices, randomWalk, input, HOUR, DAY } from './fixtures'

const walk = (seed: number, n = 200) => fromPath(randomWalk(seed, n))

describe('MultiTimeframeContext', () => {
  it('measures coordinates without producing any verdict', () => {
    // Guards the architectural rule that broke V5: 55 modules each holding a
    // private directional opinion. A context view must expose no such field.
    const ctx = buildContext([input(walk(20))])
    expect(ctx.ok).toBe(true)
    const view = baseView(ctx.context!)
    const keys = Object.keys(view)
    for (const forbidden of ['trend', 'bias', 'direction', 'agreement', 'signal', 'score']) {
      expect(keys, `TimeframeView must not expose '${forbidden}'`).not.toContain(forbidden)
    }
    expect(view.range.position).toBeGreaterThanOrEqual(0)
    expect(view.range.position).toBeLessThanOrEqual(1)
    expect(view.volatility.ratio).toBeGreaterThan(0)
  })

  it('is scale-invariant end to end', () => {
    const base = walk(21)
    const a = buildContext([input(base)])
    const b = buildContext([input(scalePrices(base, 5000))])
    expect(a.ok && b.ok).toBe(true)
    expect(baseView(b.context!).range.position).toBeCloseTo(baseView(a.context!).range.position, 12)
    expect(baseView(b.context!).volatility.ratio).toBeCloseTo(baseView(a.context!).volatility.ratio, 12)
    expect(baseView(b.context!).range.widthInAtr).toBeCloseTo(baseView(a.context!).range.widthInAtr, 12)
  })

  it('keeps higher timeframes separate from the base', () => {
    const ctx = buildContext([
      input(walk(22), '1h'),
      input(fromPath(randomWalk(23, 200), HOUR * 4), '4h'),
    ])
    expect(ctx.ok).toBe(true)
    expect(ctx.context!.base).toBe('1h')
    expect(higherViews(ctx.context!).map(v => v.timeframe)).toEqual(['4h'])
  })

  it('refuses when the base timeframe cannot be encoded, even if a higher one can', () => {
    // A higher timeframe must never silently substitute for the one being analysed.
    const ctx = buildContext([
      input(walk(24, 5), '1h'),
      input(fromPath(randomWalk(25, 200), HOUR * 4), '4h'),
    ])
    expect(ctx.ok).toBe(false)
    expect(ctx.unavailable!.detail).toMatch(/base timeframe/)
  })

  it('refuses on empty input', () => {
    expect(buildContext([]).ok).toBe(false)
  })
})

describe('SituationEncoder', () => {
  it('produces a key drawn from the declared 81-signature space', () => {
    const all = new Set(allSignatureKeys())
    expect(all.size).toBe(81)
    for (let seed = 30; seed < 60; seed++) {
      const ctx = buildContext([input(walk(seed))])
      if (!ctx.ok) continue
      const s = encodeSituation(ctx.context!)
      if (!s.ok) continue
      expect(all.has(s.situation!.signature.key)).toBe(true)
    }
  })

  it('is scale-invariant', () => {
    const base = walk(61)
    const a = encodeSituation(buildContext([input(base)]).context!)
    const b = encodeSituation(buildContext([input(scalePrices(base, 1e5))]).context!)
    expect(a.ok && b.ok).toBe(true)
    // The SIGNATURE is categorical and must be exactly invariant. The
    // MEASUREMENTS are floats and are invariant only to float precision —
    // see the caveat in trajectory/encoder.ts.
    expect(b.situation!.signature).toEqual(a.situation!.signature)
    for (const f of ['upShare', 'netDisplacement', 'volatilityRatio', 'rangePosition', 'rangeWidthInAtr'] as const) {
      expect(Math.abs(b.situation!.measurements[f] - a.situation!.measurements[f]), f).toBeLessThan(1e-9)
    }
  })

  it('carries no numeric value on the signature — it is a key, not a score', () => {
    // Structural guard against V6 decaying into V5: a signature that cannot be
    // added to anything cannot become a weighted sum.
    const s = encodeSituation(buildContext([input(walk(62))]).context!)
    for (const v of Object.values(s.situation!.signature)) {
      expect(typeof v).toBe('string')
    }
  })

  it('classifies a monotonic rise as upward drift, and a fall as downward', () => {
    const up = fromPath(Array.from({ length: 200 }, (_, i) => 100 + i))
    const down = fromPath(Array.from({ length: 200 }, (_, i) => 1000 - i * 2))
    expect(encodeSituation(buildContext([input(up)]).context!).situation!.signature.drift).toBe('up')
    expect(encodeSituation(buildContext([input(down)]).context!).situation!.signature.drift).toBe('down')
  })

  it('reports participation as normal — not thin — when volume has no dispersion', () => {
    // An absent measurement must never become a directional claim. This is the
    // V5 zero-VWAP defect (which made every price "above VWAP") guarded at its
    // V6 equivalent.
    const flatVolume = fromPath(randomWalk(63, 200), HOUR, () => 1000)
    const s = encodeSituation(buildContext([input(flatVolume)]).context!)
    expect(s.ok).toBe(true)
    expect(s.situation!.signature.participation).toBe('normal')
  })

  it('refuses when the trajectory is shorter than the situation window', () => {
    const ctx = buildContext([input(walk(64, 25))])
    if (ctx.ok) {
      const s = encodeSituation(ctx.context!)
      if (!s.ok) expect(s.unavailable!.code).toBe('insufficient-history')
    }
  })
})

describe('AnalogEngine — Phase 1 skeleton', () => {
  const ctx = buildContext([input(walk(70))]).context!
  const situation = encodeSituation(ctx).situation!
  const query = { situation, shape: [], horizons: [4, 12] }

  it('reports insufficient history against an empty corpus rather than guessing', () => {
    const r = retrieve(query, EMPTY_CORPUS)
    expect(r.ok).toBe(false)
    expect(r.unavailable.code).toBe('insufficient-history')
    expect(r.matches).toHaveLength(0)
    expect(r.estimates).toHaveLength(0)
  })

  it('refuses a class with fewer than MIN_SAMPLE_SIZE members', () => {
    const sparse: AnalogCorpus = { size: () => 5000, countForKey: () => MIN_SAMPLE_SIZE - 1 }
    const r = retrieve(query, sparse)
    expect(r.ok).toBe(false)
    expect(r.unavailable.detail).toMatch(new RegExp(`${MIN_SAMPLE_SIZE} are required`))
  })

  it('does not fabricate estimates even when the corpus is populated', () => {
    const populated: AnalogCorpus = { size: () => 1e6, countForKey: () => 5000 }
    const r = retrieve(query, populated)
    expect(r.ok).toBe(false)
    expect(r.unavailable.code).toBe('not-applicable')
    expect(r.estimates).toHaveLength(0)
  })
})

describe('SalienceEngine — silence is the default', () => {
  const ctx = buildContext([input(walk(80))]).context!
  const situation = encodeSituation(ctx).situation!

  it('stays silent when there is no evidence', () => {
    const v = judge(retrieve({ situation, shape: [], horizons: [4] }, EMPTY_CORPUS), situation)
    expect(v.speak).toBe(false)
    expect(v.silence!.reason).toBe('insufficient-evidence')
  })

  it('distinguishes "not implemented" from "no evidence"', () => {
    const populated: AnalogCorpus = { size: () => 1e6, countForKey: () => 5000 }
    const v = judge(retrieve({ situation, shape: [], horizons: [4] }, populated), situation)
    expect(v.speak).toBe(false)
    expect(v.silence!.reason).toBe('not-implemented')
  })

  it('never speaks in Phase 1, across many markets', () => {
    for (let seed = 90; seed < 140; seed++) {
      const c = buildContext([input(walk(seed))])
      if (!c.ok) continue
      const s = encodeSituation(c.context!)
      if (!s.ok) continue
      const v = judge(retrieve({ situation: s.situation!, shape: [], horizons: [4] }, EMPTY_CORPUS), s.situation!)
      expect(v.speak, 'Phase 1 has no corpus and must never make a claim').toBe(false)
    }
  })
})

describe('NarrativeRenderer — pure', () => {
  const ctx = buildContext([input(walk(150))]).context!
  const situation = encodeSituation(ctx).situation!
  const verdict = judge(retrieve({ situation, shape: [], horizons: [4] }, EMPTY_CORPUS), situation)

  it('is deterministic', () => {
    expect(renderVerdict(ctx, situation, verdict)).toBe(renderVerdict(ctx, situation, verdict))
  })

  it('states only measured quantities — no direction call, no rating', () => {
    const text = renderSituation(ctx, situation)
    for (const forbidden of ['buy', 'sell', 'long', 'short', 'bullish', 'bearish', 'strong setup', '/10']) {
      expect(text.toLowerCase(), `renderer must not emit '${forbidden}'`).not.toContain(forbidden)
    }
  })

  it('reports the share of the direction it names, not always the up-share', () => {
    // REGRESSION. The renderer printed upShare regardless of the named
    // direction, so a downward drift rendered as "drifting down (0% of the
    // last 20 bars closed down)". A renderer that contradicts its own subject
    // is the V5 writer defect reappearing in V6.
    const down = fromPath(Array.from({ length: 200 }, (_, i) => 1000 - i * 2))
    const dctx = buildContext([input(down)]).context!
    const dsit = encodeSituation(dctx).situation!
    expect(dsit.signature.drift).toBe('down')
    const text = renderSituation(dctx, dsit)
    expect(text).toMatch(/drifting down \(100% of the last \d+ bars closed down\)/)

    const up = fromPath(Array.from({ length: 200 }, (_, i) => 100 + i))
    const uctx = buildContext([input(up)]).context!
    const usit = encodeSituation(uctx).situation!
    expect(renderSituation(uctx, usit)).toMatch(/drifting up \(100% of the last \d+ bars closed up\)/)
  })

  it('explains a refusal instead of going blank', () => {
    const text = renderVerdict(ctx, situation, verdict)
    expect(text).toMatch(/No call:/)
    expect(text.length).toBeGreaterThan(60)
  })
})

describe('analyseV6 — end to end', () => {
  it('produces a description and a refusal, never a prediction', () => {
    const r = analyseV6([input(walk(200))])
    expect(r.ok).toBe(true)
    expect(r.analysis!.verdict.speak).toBe(false)
    expect(r.analysis!.narrative).toContain('No call:')
  })

  it('is deterministic and scale-invariant end to end', () => {
    const base = walk(201)
    const a = analyseV6([input(base)])
    const b = analyseV6([input(base.map(c => ({ ...c })))])
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    const scaled = analyseV6([input(scalePrices(base, 7777))])
    expect(scaled.analysis!.situation.signature).toEqual(a.analysis!.situation.signature)
  })

  it('surfaces a structured reason instead of throwing on unusable input', () => {
    for (const candles of [[], walk(202, 3), walk(203, 20)]) {
      const r = analyseV6([input(candles)])
      if (!r.ok) {
        expect(r.analysis).toBeNull()
        expect(r.unavailable.detail.length).toBeGreaterThan(0)
      }
    }
  })

  it('emits no NaN or Infinity anywhere in its output', () => {
    const scan = (v: unknown, path = ''): void => {
      if (typeof v === 'number') expect(Number.isFinite(v), `${path}=${v}`).toBe(true)
      else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`))
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, path ? `${path}.${k}` : k)
    }
    for (let seed = 300; seed < 340; seed++) {
      const r = analyseV6([input(walk(seed))])
      if (r.ok) scan(r.analysis)
    }
  })

  it('does not import or mutate V5 state — V5 remains the only UI path', () => {
    // Structural: analyseV6 takes candles and returns a value. Running it many
    // times with interleaved inputs must not change any earlier result.
    const a1 = JSON.stringify(analyseV6([input(walk(400))]))
    analyseV6([input(walk(401))])
    analyseV6([input(fromPath(randomWalk(402, 300), DAY))])
    expect(JSON.stringify(analyseV6([input(walk(400))]))).toBe(a1)
  })
})
