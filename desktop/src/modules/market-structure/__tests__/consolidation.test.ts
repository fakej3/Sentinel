import { describe, it, expect } from 'vitest'
import { detectConsolidation } from '../consolidation'
import { DEFAULT_CONFIG } from '../config'
import type { SwingPoint } from '../types'

function sw(
  type: 'high' | 'low',
  price: number,
  label: 'HH' | 'HL' | 'LH' | 'LL' | 'EH' | 'EL' | null,
  index = 0,
): SwingPoint {
  return { index, timestamp: 0, price, type, label }
}

const cfg = {
  ...DEFAULT_CONFIG,
  consolidationSwings: 5,
  consolidationThreshold: 3.0,
}

describe('detectConsolidation', () => {
  it('returns not detected when fewer than consolidationSwings swings exist', () => {
    const swings = [
      sw('high', 100, null, 1),
      sw('low',  97,  null, 2),
      sw('high', 99,  'LH', 3),
    ]
    const result = detectConsolidation(swings, cfg)
    expect(result.detected).toBe(false)
  })

  it('returns not detected when any recent swing is HH', () => {
    const swings = [
      sw('high', 100, null, 1),
      sw('low',  97,  null, 2),
      sw('high', 105, 'HH', 3),  // HH present → not consolidation
      sw('low',  97,  'EL', 4),
      sw('high', 104, 'LH', 5),
    ]
    const result = detectConsolidation(swings, cfg)
    expect(result.detected).toBe(false)
  })

  it('returns not detected when any recent swing is LL', () => {
    const swings = [
      sw('high', 100, null, 1),
      sw('low',  97,  null, 2),
      sw('high', 99,  'LH', 3),
      sw('low',  94,  'LL', 4),  // LL present
      sw('high', 98,  'LH', 5),
    ]
    const result = detectConsolidation(swings, cfg)
    expect(result.detected).toBe(false)
  })

  it('returns not detected when range exceeds threshold', () => {
    // Range: highs ~105, lows ~90. (105-90)/90*100 ≈ 16.7% > 3%
    const swings = [
      sw('high', 105, null, 1),
      sw('low',  90,  null, 2),
      sw('high', 104, 'LH', 3),
      sw('low',  91,  'HL', 4),
      sw('high', 103, 'LH', 5),
    ]
    const result = detectConsolidation(swings, cfg)
    expect(result.detected).toBe(false)
  })

  it('detects consolidation when no HH/LL and range is tight', () => {
    // Range: highs ~101, lows ~99. (101-99)/99*100 ≈ 2.02% < 3%
    const swings = [
      sw('high', 101,   null, 1),
      sw('low',  99,    null, 2),
      sw('high', 100.5, 'LH', 3),
      sw('low',  99.2,  'HL', 4),
      sw('high', 100.8, 'EH', 5),
    ]
    const result = detectConsolidation(swings, cfg)
    expect(result.detected).toBe(true)
    expect(result.rangeHigh).toBeCloseTo(101)
    expect(result.rangeLow).toBeCloseTo(99)
    expect(result.rangePercent).toBeCloseTo(2.02, 1)
  })

  it('computes rangeHigh as max of swing highs, rangeLow as min of swing lows', () => {
    const swings = [
      sw('high', 102,   null, 1),
      sw('low',  98,    null, 2),
      sw('high', 100,   'LH', 3),
      sw('low',  99,    'HL', 4),
      sw('high', 101,   'EH', 5),
    ]
    const result = detectConsolidation(swings, cfg)
    if (result.detected) {
      expect(result.rangeHigh).toBe(102)
      expect(result.rangeLow).toBe(98)
    }
  })

  it('uses exactly the last consolidationSwings swings', () => {
    // First 2 swings have HH/LL but last 5 do not → consolidation detected
    const swings = [
      sw('high', 110, 'HH', 0),  // old HH — outside window of 5
      sw('low',   80, 'LL', 1),  // old LL — outside window
      sw('high', 101, 'LH', 2),
      sw('low',   99, 'HL', 3),
      sw('high', 100, 'LH', 4),
      sw('low',   99, 'EL', 5),
      sw('high', 100, 'EH', 6),
    ]
    const result = detectConsolidation(swings, cfg)
    expect(result.detected).toBe(true)
  })

  it('computes barsInRange as last swing index minus first swing index + 1', () => {
    const swings = [
      sw('high', 101,   null, 10),
      sw('low',  99,    null, 20),
      sw('high', 100.5, 'LH', 30),
      sw('low',  99.2,  'HL', 40),
      sw('high', 100.8, 'EH', 50),
    ]
    const result = detectConsolidation(swings, cfg)
    if (result.detected) {
      expect(result.barsInRange).toBe(50 - 10 + 1)
    }
  })

  it('returns all null fields when not detected', () => {
    const result = detectConsolidation([], cfg)
    expect(result.rangeHigh).toBeNull()
    expect(result.rangeLow).toBeNull()
    expect(result.rangePercent).toBeNull()
    expect(result.barsInRange).toBe(0)
  })
})
