import { describe, it, expect } from 'vitest'
import { computeMTFAgreement } from '../compute/mtf-agreement'
import type { MTFTimeframeInput } from '../types'

function tf(
  label: string,
  direction: MTFTimeframeInput['direction'],
  grade: MTFTimeframeInput['grade'] = 'strong',
  score = 7.5,
): MTFTimeframeInput {
  return { label, direction, grade, score }
}

describe('computeMTFAgreement', () => {
  // ── Agreement classification ───────────────────────────────────────────────

  it('4/4 bullish → aligned', () => {
    const result = computeMTFAgreement([
      tf('15m', 'bullish'), tf('1h', 'bullish'),
      tf('4h', 'bullish'), tf('1d', 'bullish'),
    ])
    expect(result.agreement).toBe('aligned')
    expect(result.dominantDirection).toBe('bullish')
    expect(result.conflictingCount).toBe(0)
  })

  it('4/4 bearish → aligned', () => {
    const result = computeMTFAgreement([
      tf('15m', 'bearish'), tf('1h', 'bearish'),
      tf('4h', 'bearish'), tf('1d', 'bearish'),
    ])
    expect(result.agreement).toBe('aligned')
    expect(result.dominantDirection).toBe('bearish')
    expect(result.conflictingCount).toBe(0)
  })

  it('3/4 bullish → mostly_aligned', () => {
    const result = computeMTFAgreement([
      tf('15m', 'bullish'), tf('1h', 'bullish'),
      tf('4h', 'bullish'), tf('1d', 'neutral'),
    ])
    expect(result.agreement).toBe('mostly_aligned')
    expect(result.dominantDirection).toBe('bullish')
  })

  it('2 bullish + 2 bearish → strong_conflict', () => {
    const result = computeMTFAgreement([
      tf('15m', 'bullish'), tf('1h', 'bullish'),
      tf('4h', 'bearish'), tf('1d', 'bearish'),
    ])
    expect(result.agreement).toBe('strong_conflict')
    expect(result.conflictingCount).toBe(2)
  })

  it('2 bullish + 1 bearish + 1 neutral → mixed', () => {
    const result = computeMTFAgreement([
      tf('15m', 'bullish'), tf('1h', 'bullish'),
      tf('4h', 'bearish'), tf('1d', 'neutral'),
    ])
    expect(result.agreement).toBe('mixed')
  })

  it('empty input → mixed with zero score', () => {
    const result = computeMTFAgreement([])
    expect(result.agreement).toBe('mixed')
    expect(result.agreementScore).toBe(0)
    expect(result.timeframes).toHaveLength(0)
  })

  // ── agreementScore range ──────────────────────────────────────────────────

  it('agreementScore is always in [0, 10]', () => {
    const cases = [
      [tf('15m', 'bullish'), tf('1h', 'bullish'), tf('4h', 'bullish'), tf('1d', 'bullish')],
      [tf('15m', 'bullish'), tf('1h', 'bearish'), tf('4h', 'bearish'), tf('1d', 'bearish')],
      [tf('15m', 'neutral'), tf('1h', 'neutral'), tf('4h', 'neutral')],
      [],
    ]
    for (const input of cases) {
      const result = computeMTFAgreement(input)
      expect(result.agreementScore).toBeGreaterThanOrEqual(0)
      expect(result.agreementScore).toBeLessThanOrEqual(10)
    }
  })

  it('aligned produces higher agreementScore than strong_conflict', () => {
    const aligned = computeMTFAgreement([
      tf('15m', 'bullish'), tf('1h', 'bullish'),
      tf('4h', 'bullish'), tf('1d', 'bullish'),
    ])
    const conflict = computeMTFAgreement([
      tf('15m', 'bullish'), tf('1h', 'bullish'),
      tf('4h', 'bearish'), tf('1d', 'bearish'),
    ])
    expect(aligned.agreementScore).toBeGreaterThan(conflict.agreementScore)
  })

  // ── Dominant direction detection ──────────────────────────────────────────

  it('determines dominant direction by count, not score', () => {
    // 3 bearish with weak grade vs 1 bullish with very_strong grade
    // Direction count dominates — grade only affects agreementScore
    const result = computeMTFAgreement([
      tf('15m', 'bearish', 'weak', 1.0),
      tf('1h', 'bearish', 'weak', 1.5),
      tf('4h', 'bearish', 'weak', 2.0),
      tf('1d', 'bullish', 'very_strong', 10.0),
    ])
    expect(result.dominantDirection).toBe('bearish')
    expect(result.conflictingCount).toBe(1)
  })

  // ── Input pass-through ────────────────────────────────────────────────────

  it('timeframes field contains the original input unchanged', () => {
    const inputs = [
      tf('15m', 'bullish', 'very_strong', 9.5),
      tf('4h', 'bearish', 'moderate', 5.5),
    ]
    const result = computeMTFAgreement(inputs)
    expect(result.timeframes).toHaveLength(2)
    expect(result.timeframes[0].label).toBe('15m')
    expect(result.timeframes[1].label).toBe('4h')
    expect(result.timeframes[0].score).toBe(9.5)
    expect(result.timeframes[1].score).toBe(5.5)
  })
})
