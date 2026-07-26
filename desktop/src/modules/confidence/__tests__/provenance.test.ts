import { describe, it, expect } from 'vitest'
import {
  FACTOR_PROVENANCE, SCALAR_PROVENANCE,
  buildCalibrationInventory, summariseProvenance, isCalibratable,
} from '../provenance'
import { DEFAULT_CONFIDENCE_CONFIG as CFG } from '../config'

describe('weight provenance registry', () => {
  it('declares a provenance for every weight in the config', () => {
    // The `satisfies Record<EvidenceFactor, ...>` annotation enforces this at
    // compile time; this asserts it at runtime too, so a config/registry drift
    // cannot pass unnoticed.
    for (const factor of Object.keys(CFG.factorWeights)) {
      expect(FACTOR_PROVENANCE).toHaveProperty(factor)
    }
  })

  it('declares no provenance for a factor that has no weight', () => {
    for (const factor of Object.keys(FACTOR_PROVENANCE)) {
      expect(CFG.factorWeights).toHaveProperty(factor)
    }
  })

  it('every entry carries a non-empty rationale — no silent numbers', () => {
    for (const [factor, entry] of Object.entries(FACTOR_PROVENANCE)) {
      expect(entry.rationale.length, `${factor} has an empty rationale`).toBeGreaterThan(0)
    }
    for (const [path, entry] of Object.entries(SCALAR_PROVENANCE)) {
      expect(entry.rationale.length, `${path} has an empty rationale`).toBeGreaterThan(0)
    }
  })

  it('records the honest headline: no confidence weight is currently backtested', () => {
    // This test is a tripwire, not an aspiration. If a weight is ever genuinely
    // fitted against resolved outcomes, this assertion SHOULD fail and be
    // updated together with the evidence citation — that is the point.
    const summary = summariseProvenance(CFG)
    expect(summary.backtested).toBe(0)
    expect(summary.heuristic + summary.placeholder).toBeGreaterThan(0)
  })

  it('marks pre-wired factors the engine does not emit as placeholders', () => {
    const placeholders = Object.entries(FACTOR_PROVENANCE)
      .filter(([, e]) => e.provenance === 'placeholder')
      .map(([f]) => f)
    // Deferred factors documented in config.ts: RSI divergences, the pre-wired
    // RSI bands, and weak-volume-on-breakout.
    expect(placeholders.length).toBeGreaterThanOrEqual(5)
  })
})

describe('calibration inventory', () => {
  const inventory = buildCalibrationInventory(CFG)

  it('emits one entry per factor weight plus the resolvable scalars', () => {
    const factorCount = Object.keys(CFG.factorWeights).length
    expect(inventory.length).toBeGreaterThan(factorCount)
    expect(inventory.filter(p => p.path.startsWith('factorWeights.'))).toHaveLength(factorCount)
  })

  it('reports the CURRENT value for every parameter, matching the live config', () => {
    for (const param of inventory) {
      expect(Number.isFinite(param.currentValue), `${param.path} is not finite`).toBe(true)
    }
    const ema200 = inventory.find(p => p.path === 'factorWeights.price_above_ema200')
    expect(ema200?.currentValue).toBe(CFG.factorWeights.price_above_ema200)
  })

  it('resolves nested scalar paths such as grade thresholds', () => {
    const veryStrong = inventory.find(p => p.path === 'gradeThresholds.veryStrong')
    expect(veryStrong?.currentValue).toBe(CFG.gradeThresholds.veryStrong)
  })

  it('flags heuristics and placeholders as free parameters for a future harness', () => {
    expect(isCalibratable('heuristic')).toBe(true)
    expect(isCalibratable('placeholder')).toBe(true)
    expect(isCalibratable('backtested')).toBe(true)
    // Derived values are functions of other values and must be recomputed,
    // never independently fitted, or internal consistency breaks.
    expect(isCalibratable('derived')).toBe(false)
  })

  it('every inventory path is addressable inside ConfidenceConfig', () => {
    for (const param of inventory) {
      const [head, tail] = param.path.split('.')
      const root = (CFG as unknown as Record<string, unknown>)[head]
      expect(root, `${param.path}: '${head}' missing from config`).toBeDefined()
      if (tail !== undefined) {
        expect((root as Record<string, unknown>)[tail], `${param.path} unresolvable`).toBeDefined()
      }
    }
  })

  it('is deterministic', () => {
    expect(buildCalibrationInventory(CFG)).toEqual(buildCalibrationInventory(CFG))
  })
})
