import { describe, it, expect } from 'vitest'
import { countStructure, determineTrend } from '../trend'
import { DEFAULT_CONFIG } from '../config'
import type { SwingPoint, SwingLabel } from '../types'

function labeledSwing(
  type: 'high' | 'low',
  label: SwingLabel | null,
  index = 0,
): SwingPoint {
  return { index, timestamp: 0, price: 100, type, label }
}

const cfg = { ...DEFAULT_CONFIG, minSwingsForTrend: 4 }

describe('countStructure', () => {
  it('returns all zeros for empty input', () => {
    const result = countStructure([])
    expect(result).toEqual({
      higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0,
      equalHighs: 0, equalLows: 0,
    })
  })

  it('counts each label type correctly', () => {
    const swings = [
      labeledSwing('high', 'HH', 1),
      labeledSwing('low',  'HL', 2),
      labeledSwing('high', 'HH', 3),
      labeledSwing('low',  'LL', 4),
      labeledSwing('high', 'LH', 5),
      labeledSwing('low',  'EL', 6),
      labeledSwing('high', 'EH', 7),
    ]
    const result = countStructure(swings)
    expect(result.higherHighs).toBe(2)
    expect(result.higherLows).toBe(1)
    expect(result.lowerHighs).toBe(1)
    expect(result.lowerLows).toBe(1)
    expect(result.equalHighs).toBe(1)
    expect(result.equalLows).toBe(1)
  })

  it('ignores swings with label null', () => {
    const swings = [
      labeledSwing('high', null, 1),
      labeledSwing('low',  null, 2),
    ]
    const result = countStructure(swings)
    expect(result).toEqual({
      higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0,
      equalHighs: 0, equalLows: 0,
    })
  })
})

describe('determineTrend', () => {
  it('returns ranging/weak for empty input', () => {
    const result = determineTrend([], cfg)
    expect(result.direction).toBe('ranging')
    expect(result.strength).toBe('weak')
  })

  it('returns ranging/weak for fewer than 2 labeled swings', () => {
    const result = determineTrend([labeledSwing('high', null, 1)], cfg)
    expect(result.direction).toBe('ranging')
  })

  it('returns bullish for pure HH+HL sequence', () => {
    const swings = [
      labeledSwing('high', null, 1),
      labeledSwing('low',  null, 2),
      labeledSwing('high', 'HH', 3),
      labeledSwing('low',  'HL', 4),
      labeledSwing('high', 'HH', 5),
      labeledSwing('low',  'HL', 6),
    ]
    const result = determineTrend(swings, cfg)
    expect(result.direction).toBe('bullish')
  })

  it('returns strong bullish for 3+ HH and 3+ HL', () => {
    const swings = [
      labeledSwing('high', null, 1),
      labeledSwing('low',  null, 2),
      labeledSwing('high', 'HH', 3),
      labeledSwing('low',  'HL', 4),
      labeledSwing('high', 'HH', 5),
      labeledSwing('low',  'HL', 6),
      labeledSwing('high', 'HH', 7),
      labeledSwing('low',  'HL', 8),
    ]
    const result = determineTrend(swings, cfg)
    expect(result.direction).toBe('bullish')
    expect(result.strength).toBe('strong')
  })

  it('returns moderate bullish for exactly 2 HH and 2 HL', () => {
    const swings = [
      labeledSwing('high', null, 1),
      labeledSwing('low',  null, 2),
      labeledSwing('high', 'HH', 3),
      labeledSwing('low',  'HL', 4),
      labeledSwing('high', 'HH', 5),
      labeledSwing('low',  'HL', 6),
    ]
    const result = determineTrend(swings, cfg)
    expect(result.direction).toBe('bullish')
    expect(result.strength).toBe('moderate')
  })

  it('returns bearish for pure LH+LL sequence', () => {
    const swings = [
      labeledSwing('high', null, 1),
      labeledSwing('low',  null, 2),
      labeledSwing('high', 'LH', 3),
      labeledSwing('low',  'LL', 4),
      labeledSwing('high', 'LH', 5),
      labeledSwing('low',  'LL', 6),
    ]
    const result = determineTrend(swings, cfg)
    expect(result.direction).toBe('bearish')
  })

  it('returns ranging for mixed HH+LL sequence', () => {
    const swings = [
      labeledSwing('high', null,  1),
      labeledSwing('low',  null,  2),
      labeledSwing('high', 'HH',  3),
      labeledSwing('low',  'LL',  4),
      labeledSwing('high', 'LH',  5),
      labeledSwing('low',  'HL',  6),
    ]
    const result = determineTrend(swings, cfg)
    expect(result.direction).toBe('ranging')
  })

  it('uses only the recent window (minSwingsForTrend × 2) for classification', () => {
    // Old swings are all HH+HL, but recent window is all LH+LL → bearish
    const old = [
      labeledSwing('high', 'HH', 1),
      labeledSwing('low',  'HL', 2),
      labeledSwing('high', 'HH', 3),
      labeledSwing('low',  'HL', 4),
      labeledSwing('high', 'HH', 5),
      labeledSwing('low',  'HL', 6),
    ]
    const recent = [
      labeledSwing('high', 'LH', 7),
      labeledSwing('low',  'LL', 8),
      labeledSwing('high', 'LH', 9),
      labeledSwing('low',  'LL', 10),
      labeledSwing('high', 'LH', 11),
      labeledSwing('low',  'LL', 12),
      labeledSwing('high', 'LH', 13),
      labeledSwing('low',  'LL', 14),
    ]
    // minSwingsForTrend=4 → window = last 8 labeled swings → all LH+LL
    const result = determineTrend([...old, ...recent], cfg)
    expect(result.direction).toBe('bearish')
  })
})
