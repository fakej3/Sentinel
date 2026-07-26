import { describe, it, expect } from 'vitest'
import { applyCeilingPenalty } from '../compute/ceiling'
import { DEFAULT_CONFIDENCE_CONFIG as CFG } from '../config'

const T = CFG.overconfidenceThreshold   // 8.0
const LOW = CFG.trustPenaltyLow         // 1.6
const CEIL = T - LOW                    // 6.4

describe('applyCeilingPenalty — the defect it repairs', () => {
  it('is continuous across the old discontinuity (8.00 vs 8.01)', () => {
    // The original rule `if (score > 8.0) score -= 1.6` produced
    // f(8.00) = 8.00 and f(8.01) = 6.41 — a jump of −1.59 at an interior
    // point, meaning more evidence yielded LOWER confidence.
    const at   = applyCeilingPenalty(8.00, T, LOW)
    const just = applyCeilingPenalty(8.01, T, LOW)
    expect(Math.abs(just - at)).toBeLessThan(0.02)
  })

  it('is monotone non-decreasing across the whole range', () => {
    let prev = -Infinity
    for (let s = 0; s <= 10.0001; s += 0.01) {
      const v = applyCeilingPenalty(s, T, LOW)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })

  it('is continuous across the whole range (no jump exceeds the step size)', () => {
    const step = 0.01
    let prev = applyCeilingPenalty(0, T, LOW)
    for (let s = step; s <= 10.0001; s += step) {
      const v = applyCeilingPenalty(s, T, LOW)
      expect(Math.abs(v - prev)).toBeLessThan(step + 1e-9)
      prev = v
    }
  })
})

describe('applyCeilingPenalty — segment behaviour', () => {
  it('leaves scores at or below the ceiling untouched (no double-penalising)', () => {
    // Preserves the original design intent: already-low scores signal
    // uncertainty on their own and must not be penalised again.
    for (const s of [0, 1, 3.5, 5, 6.39, CEIL]) {
      expect(applyCeilingPenalty(s, T, LOW)).toBeCloseTo(s, 9)
    }
  })

  it('flattens the band between ceiling and threshold', () => {
    for (const s of [6.5, 7.0, 7.5, 7.99]) {
      expect(applyCeilingPenalty(s, T, LOW)).toBeCloseTo(CEIL, 9)
    }
  })

  it('reproduces the ORIGINAL subtraction at and above the threshold', () => {
    // This is why no previously-calibrated high-score outcome changes.
    for (const s of [8.0, 8.5, 9.25, 10]) {
      expect(applyCeilingPenalty(s, T, LOW)).toBeCloseTo(s - LOW, 9)
    }
  })

  it('never returns a negative score even when penalty exceeds threshold', () => {
    expect(applyCeilingPenalty(0.5, 1.0, 5.0)).toBeGreaterThanOrEqual(0)
    expect(applyCeilingPenalty(0, 1.0, 5.0)).toBeGreaterThanOrEqual(0)
  })

  it('a zero penalty is the identity function', () => {
    for (const s of [0, 3, 6.4, 8, 10]) {
      expect(applyCeilingPenalty(s, T, 0)).toBeCloseTo(s, 9)
    }
  })

  it('holds the same invariants for the medium-trust penalty', () => {
    const MED = CFG.trustPenaltyMedium
    const medCeil = T - MED
    expect(applyCeilingPenalty(medCeil, T, MED)).toBeCloseTo(medCeil, 9)
    expect(applyCeilingPenalty(7.5, T, MED)).toBeCloseTo(medCeil, 9)
    expect(applyCeilingPenalty(10, T, MED)).toBeCloseTo(10 - MED, 9)
  })

  it('is deterministic', () => {
    expect(applyCeilingPenalty(7.3, T, LOW)).toBe(applyCeilingPenalty(7.3, T, LOW))
  })
})
