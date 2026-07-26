import { describe, it, expect } from 'vitest'
import { labelSwings } from '../labels'
import { DEFAULT_CONFIG } from '../config'
import type { SwingPoint } from '../types'

function swing(type: 'high' | 'low', price: number, index = 0): SwingPoint {
  return { index, timestamp: index * 1000, price, type, label: null }
}

const cfg = { ...DEFAULT_CONFIG, equalThreshold: 0.1 }

describe('labelSwings', () => {
  it('returns empty for empty input', () => {
    expect(labelSwings([], cfg)).toHaveLength(0)
  })

  it('first swing of each type has label null', () => {
    const input = [swing('high', 100, 1), swing('low', 90, 2)]
    const result = labelSwings(input, cfg)
    expect(result[0].label).toBeNull()
    expect(result[1].label).toBeNull()
  })

  it('classifies a higher swing high as HH', () => {
    const input = [swing('high', 100, 1), swing('low', 90, 2), swing('high', 110, 3)]
    const result = labelSwings(input, cfg)
    expect(result[2].label).toBe('HH')
  })

  it('classifies a lower swing high as LH', () => {
    const input = [swing('high', 110, 1), swing('low', 90, 2), swing('high', 100, 3)]
    const result = labelSwings(input, cfg)
    expect(result[2].label).toBe('LH')
  })

  it('classifies a higher swing low as HL', () => {
    const input = [swing('high', 100, 1), swing('low', 80, 2), swing('high', 110, 3), swing('low', 90, 4)]
    const result = labelSwings(input, cfg)
    expect(result[3].label).toBe('HL')
  })

  it('classifies a lower swing low as LL', () => {
    const input = [swing('high', 100, 1), swing('low', 90, 2), swing('high', 95, 3), swing('low', 80, 4)]
    const result = labelSwings(input, cfg)
    expect(result[3].label).toBe('LL')
  })

  it('classifies within-threshold swing high as EH', () => {
    // 100 vs 100.05 → 0.05% < 0.1% equalThreshold → EH
    const input = [swing('high', 100, 1), swing('low', 90, 2), swing('high', 100.05, 3)]
    const result = labelSwings(input, cfg)
    expect(result[2].label).toBe('EH')
  })

  it('classifies within-threshold swing low as EL', () => {
    const input = [swing('high', 100, 1), swing('low', 100, 2), swing('high', 105, 3), swing('low', 100.05, 4)]
    const result = labelSwings(input, cfg)
    expect(result[3].label).toBe('EL')
  })

  it('labels a full bullish sequence correctly', () => {
    // H100, L90, H110(HH), L95(HL), H120(HH), L100(HL)
    const input = [
      swing('high', 100, 1),
      swing('low',  90,  2),
      swing('high', 110, 3),
      swing('low',  95,  4),
      swing('high', 120, 5),
      swing('low',  100, 6),
    ]
    const result = labelSwings(input, cfg)
    expect(result[0].label).toBeNull()
    expect(result[1].label).toBeNull()
    expect(result[2].label).toBe('HH')
    expect(result[3].label).toBe('HL')
    expect(result[4].label).toBe('HH')
    expect(result[5].label).toBe('HL')
  })

  it('labels a full bearish sequence correctly', () => {
    // H100, L90, H95(LH), L80(LL), H90(LH), L70(LL)
    const input = [
      swing('high', 100, 1),
      swing('low',  90,  2),
      swing('high', 95,  3),
      swing('low',  80,  4),
      swing('high', 90,  5),
      swing('low',  70,  6),
    ]
    const result = labelSwings(input, cfg)
    expect(result[2].label).toBe('LH')
    expect(result[3].label).toBe('LL')
    expect(result[4].label).toBe('LH')
    expect(result[5].label).toBe('LL')
  })

  it('does not mutate the input objects', () => {
    const input = [swing('high', 100, 1), swing('low', 90, 2), swing('high', 110, 3)]
    labelSwings(input, cfg)
    expect(input[2].label).toBeNull()  // original unchanged
  })
})

describe('labelSwings — regime resets at CHoCH boundaries', () => {
  // A downtrend into a V-reversal. Without regime resets, the recovery highs
  // print LH forever because they are compared against the pre-reversal
  // extreme — the exact defect the reset exists to fix.
  const vReversal = [
    swing('high', 200, 1),   // null (first high)
    swing('low',  150, 3),   // null (first low)
    swing('high', 180, 5),   // LH — downtrend
    swing('low',  120, 7),   // LL
    swing('high', 160, 9),   // LH
    swing('low',  100, 11),  // LL — the bottom
    // CHoCH breach at candle 13 → new regime begins
    swing('high', 140, 15),  // recovery high
    swing('low',  115, 17),  // recovery low
    swing('high', 165, 19),  // higher recovery high
    swing('low',  130, 21),  // higher recovery low
  ]

  it('without resets, recovery swings are mislabeled against the old regime (documents the defect)', () => {
    const result = labelSwings(vReversal, cfg)
    expect(result[6].label).toBe('LH')  // 140 < 160 — old-regime comparison
    expect(result[8].label).toBe('HH')  // 165 > 140 (within run) but note [6] was wrong
  })

  it('with a reset at the CHoCH, new-regime swings start fresh and label as an uptrend', () => {
    const result = labelSwings(vReversal, cfg, [13])
    // Old regime untouched
    expect(result[2].label).toBe('LH')
    expect(result[3].label).toBe('LL')
    expect(result[4].label).toBe('LH')
    expect(result[5].label).toBe('LL')
    // First swing of each type in the new regime has no predecessor
    expect(result[6].label).toBeNull()   // high 140 — regime-first high
    expect(result[7].label).toBeNull()   // low 115 — regime-first low
    // Subsequent swings labeled within the new regime only
    expect(result[8].label).toBe('HH')   // 165 > 140
    expect(result[9].label).toBe('HL')   // 130 > 115
  })

  it('a swing exactly at the reset index belongs to the new regime', () => {
    const input = [
      swing('high', 100, 1),
      swing('low',  90,  3),
      swing('high', 95,  5),  // reset lands exactly here
    ]
    const result = labelSwings(input, cfg, [5])
    expect(result[2].label).toBeNull()  // new regime — not LH vs the 100 high
  })

  it('multiple resets each clear the baseline independently', () => {
    const input = [
      swing('high', 100, 1),
      swing('low',  90,  2),
      swing('high', 110, 4),  // HH in regime 1
      // reset at 5
      swing('high', 105, 6),  // regime 2 first high → null
      swing('low',  95,  8),  // regime 2 first low → null
      swing('high', 115, 10), // HH within regime 2
      // reset at 11
      swing('low',  80,  12), // regime 3 first low → null
      swing('high', 90,  14), // regime 3 first high → null
    ]
    const result = labelSwings(input, cfg, [5, 11])
    expect(result[2].label).toBe('HH')
    expect(result[3].label).toBeNull()
    expect(result[4].label).toBeNull()
    expect(result[5].label).toBe('HH')
    expect(result[6].label).toBeNull()
    expect(result[7].label).toBeNull()
  })

  it('an empty resets array is identical to omitting the parameter', () => {
    const a = labelSwings(vReversal, cfg)
    const b = labelSwings(vReversal, cfg, [])
    expect(b).toEqual(a)
  })

  it('unsorted reset indices are handled (sorted internally, deterministic)', () => {
    const sorted   = labelSwings(vReversal, cfg, [13])
    const combined = labelSwings(vReversal, cfg, [20, 13])
    // The extra reset at 20 nulls the swing at index 21 but everything
    // before behaves exactly as with [13] alone.
    expect(combined.slice(0, 9)).toEqual(sorted.slice(0, 9))
    expect(combined[9].label).toBeNull()
  })
})
