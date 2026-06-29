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
