/**
 * The Phase 4 corpus.
 *
 * Extends the Phase 2 regime set with the three things the Phase 2 study was
 * missing, each of which was identified as a falsification risk against its own
 * conclusions:
 *
 *   MOMENTUM   AR(1) log returns with phi > 0. The process a trend-following
 *              engine exists for, and the one Phase 2 never contained: GBM with
 *              drift has ZERO return autocorrelation, so "trend" there was a
 *              deterministic mean shift rather than persistence. Without this,
 *              "the engine fails in trends" was a claim about the wrong process.
 *
 *   REVERSION  OU at several reversion speeds rather than one. Phase 2 used a
 *              half-life of 24 bars, derived as half the longest horizon —
 *              defensible, and also close to maximally adverse to momentum at
 *              those horizons. Sweeping it tests whether the headline loss was
 *              a property of the engine or of that choice.
 *
 *   SHOCK      Jump-diffusion. The only heavy-tailed process here; every other
 *              one has Gaussian returns, which remains a standing limitation.
 *
 * STRIDE = 48 = max(horizon), so forward windows do not overlap and every
 * standard error is honest.
 */
import type { Timeframe } from '../../modules/market/types'
import type { RegimeSegment, RegimeSpec } from '../sources'
import { syntheticRegimeSeries } from '../sources'
import { runSeries } from '../engine'
import type { EngineOverrides } from '../snapshot'
import type { Observation } from '../types'

export const HORIZONS = [4, 12, 24, 48] as const
export const STRIDE = 48
export const SEGMENT_BARS = 400
export const SERIES_PER_REGIME = 20

/** σ per bar, scaled by √time from 0.01 at 1h — sets units, not answers. */
const BARS_PER_HOUR: Record<string, number> = { '15m': 0.25, '1h': 1, '4h': 4 }
export function sigmaFor(tf: Timeframe): number {
  return 0.01 * Math.sqrt(BARS_PER_HOUR[tf] ?? 1)
}

/** Drift giving a `k`-sigma total move over `bars`. Derived, not chosen for effect. */
export function driftFor(sigma: number, bars: number, k: number): number {
  return (k * sigma) / Math.sqrt(bars)
}

export interface RegimeDef {
  readonly name: string
  readonly family: string
  readonly description: string
  readonly segments: (sigma: number) => RegimeSegment[]
}

const seg = {
  drift: (sigma: number, k: number): RegimeSegment =>
    ({ kind: 'drift', bars: SEGMENT_BARS, drift: driftFor(sigma, SEGMENT_BARS, k), sigma }),
  revert: (sigma: number, halfLife: number): RegimeSegment =>
    ({ kind: 'revert', bars: SEGMENT_BARS, theta: Math.LN2 / halfLife, sigma }),
  momentum: (sigma: number, phi: number): RegimeSegment =>
    ({ kind: 'momentum', bars: SEGMENT_BARS, phi, sigma }),
  shock: (sigma: number, rate: number, jumpSigmas: number): RegimeSegment =>
    ({ kind: 'shock', bars: SEGMENT_BARS, rate, jumpSigmas, sigma }),
}

const triple = (f: (s: number) => RegimeSegment) => (s: number): RegimeSegment[] => [f(s), f(s), f(s)]

export const REGIMES: readonly RegimeDef[] = [
  // ── Null ──────────────────────────────────────────────────────────────────
  { name: 'walk', family: 'null', description: 'Driftless GBM. No signal exists.', segments: triple(s => seg.drift(s, 0)) },

  // ── Drift (deterministic mean shift, zero autocorrelation) ────────────────
  // BALANCED IN SIGN. An earlier version had +1, +3, +5 and −3, giving the
  // pooled corpus a net +6σ bullish tilt — which handed `always_long` a free
  // +0.211 R and made every pooled expectancy uninterpretable. Paired
  // comparisons survived that (both strategies faced the same corpus) but
  // absolute levels did not. Every drift magnitude now appears in both
  // directions.
  { name: 'drift_up_weak', family: 'drift', description: 'GBM, +1σ over 400 bars.', segments: triple(s => seg.drift(s, 1)) },
  { name: 'drift_dn_weak', family: 'drift', description: 'GBM, −1σ over 400 bars.', segments: triple(s => seg.drift(s, -1)) },
  { name: 'drift_up_mid', family: 'drift', description: 'GBM, +3σ over 400 bars.', segments: triple(s => seg.drift(s, 3)) },
  { name: 'drift_dn_mid', family: 'drift', description: 'GBM, −3σ over 400 bars.', segments: triple(s => seg.drift(s, -3)) },
  { name: 'drift_up_strong', family: 'drift', description: 'GBM, +5σ over 400 bars.', segments: triple(s => seg.drift(s, 5)) },
  { name: 'drift_dn_strong', family: 'drift', description: 'GBM, −5σ over 400 bars.', segments: triple(s => seg.drift(s, -5)) },

  // ── Momentum (genuine return persistence) ─────────────────────────────────
  { name: 'mom_weak', family: 'momentum', description: 'AR(1) phi = 0.1. Realistic upper bound for a liquid market.', segments: triple(s => seg.momentum(s, 0.1)) },
  { name: 'mom_mid', family: 'momentum', description: 'AR(1) phi = 0.3. Implausibly strong.', segments: triple(s => seg.momentum(s, 0.3)) },
  { name: 'mom_strong', family: 'momentum', description: 'AR(1) phi = 0.5. Far beyond anything real.', segments: triple(s => seg.momentum(s, 0.5)) },

  // ── Reversion ─────────────────────────────────────────────────────────────
  { name: 'revert_fast', family: 'reversion', description: 'OU, 12-bar half-life.', segments: triple(s => seg.revert(s, 12)) },
  { name: 'revert_mid', family: 'reversion', description: 'OU, 24-bar half-life. The Phase 2 setting.', segments: triple(s => seg.revert(s, 24)) },
  { name: 'revert_slow', family: 'reversion', description: 'OU, 96-bar half-life.', segments: triple(s => seg.revert(s, 96)) },
  { name: 'revert_bar', family: 'reversion', description: 'AR(1) phi = −0.3. Bar-to-bar reversion, not level reversion.', segments: triple(s => seg.momentum(s, -0.3)) },

  // ── Volatility / shocks ───────────────────────────────────────────────────
  { name: 'shock_rare', family: 'shock', description: 'Jump-diffusion, 1% of bars, 5σ jumps.', segments: triple(s => seg.shock(s, 0.01, 5)) },
  { name: 'shock_frequent', family: 'shock', description: 'Jump-diffusion, 5% of bars, 4σ jumps.', segments: triple(s => seg.shock(s, 0.05, 4)) },
  { name: 'vol_low', family: 'volatility', description: 'Driftless GBM at 1/3 sigma.', segments: (s) => triple(x => seg.drift(x, 0))(s / 3) },
  { name: 'vol_high', family: 'volatility', description: 'Driftless GBM at 3x sigma.', segments: (s) => triple(x => seg.drift(x, 0))(s * 3) },

  // ── Transitions ───────────────────────────────────────────────────────────
  {
    name: 'transition', family: 'transition',
    description: 'Up-trend → range → down-trend. Regime change mid-series; net drift zero.',
    segments: (s) => [seg.drift(s, 3), seg.revert(s, 24), seg.drift(s, -3)],
  },
  {
    name: 'transition_rev', family: 'transition',
    description: 'Down-trend → range → up-trend. The mirror, so the family carries no net tilt.',
    segments: (s) => [seg.drift(s, -3), seg.revert(s, 24), seg.drift(s, 3)],
  },
  {
    name: 'transition_mom', family: 'transition',
    description: 'Momentum → reversion → momentum. Persistence that switches off and back on.',
    segments: (s) => [seg.momentum(s, 0.3), seg.momentum(s, -0.3), seg.momentum(s, 0.3)],
  },
]

export const TIMEFRAMES: readonly Timeframe[] = ['15m', '1h', '4h']

export function regimeOf(symbol: string): string {
  const i = symbol.lastIndexOf('_')
  if (i < 0) throw new Error(`cannot infer regime from symbol "${symbol}"`)
  return symbol.slice(0, i)
}

export function familyOf(regimeName: string): string {
  const r = REGIMES.find(x => x.name === regimeName)
  if (r === undefined) throw new Error(`unknown regime "${regimeName}"`)
  return r.family
}

export function buildSpecs(): RegimeSpec[] {
  const out: RegimeSpec[] = []
  let seed = 500_000
  for (const regime of REGIMES) {
    for (const tf of TIMEFRAMES) {
      for (let i = 0; i < SERIES_PER_REGIME; i++) {
        out.push({
          symbol: `${regime.name}_${tf}${String(i).padStart(2, '0')}`,
          timeframe: tf,
          seed: seed++,
          segments: regime.segments(sigmaFor(tf)),
        })
      }
    }
  }
  return out
}

/** Runs the whole corpus. `overrides` is how an ablation is applied. */
export function runCorpus(
  specs: readonly RegimeSpec[],
  overrides?: EngineOverrides,
  lookbackBars = 200,
): Observation[] {
  const out: Observation[] = []
  for (const spec of specs) {
    out.push(...runSeries(
      syntheticRegimeSeries(spec),
      { stride: STRIDE, horizons: [...HORIZONS], lookbackBars },
      overrides,
    ).observations)
  }
  return out
}

/** Groups observations by regime name. */
export function byRegime(observations: readonly Observation[]): Map<string, Observation[]> {
  const m = new Map<string, Observation[]>()
  for (const o of observations) {
    const k = regimeOf(o.symbol)
    const b = m.get(k)
    if (b === undefined) m.set(k, [o]); else b.push(o)
  }
  return m
}

/** Groups observations by regime FAMILY. */
export function byFamily(observations: readonly Observation[]): Map<string, Observation[]> {
  const m = new Map<string, Observation[]>()
  for (const o of observations) {
    const k = familyOf(regimeOf(o.symbol))
    const b = m.get(k)
    if (b === undefined) m.set(k, [o]); else b.push(o)
  }
  return m
}

/** R multiple for an observation under a supplied direction. null when not computable. */
export function rFor(o: Observation, horizonBars: number, direction: number): number | null {
  if (direction === 0) return null
  const outcome = o.outcomes[horizonBars]
  if (outcome === null || outcome === undefined) return null
  const stop = o.features.stop_distance_atr
  if (typeof stop !== 'number' || !Number.isFinite(stop) || stop <= 0) return null
  return (direction * outcome.forwardReturnAtr) / stop
}
