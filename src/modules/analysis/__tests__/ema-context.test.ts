import { describe, it, expect } from 'vitest'
import { computeEMAContext } from '../compute/ema-context'
import { DEFAULT_ANALYSIS_CONFIG } from '../config'
import { indicators } from './helpers'

const cfg = DEFAULT_ANALYSIS_CONFIG

describe('computeEMAContext', () => {
  it('returns all unavailable when no EMAs are set', () => {
    const result = computeEMAContext(100, indicators(), cfg)
    expect(result.priceVsEMA20).toBe('unavailable')
    expect(result.priceVsEMA50).toBe('unavailable')
    expect(result.priceVsEMA100).toBe('unavailable')
    expect(result.priceVsEMA200).toBe('unavailable')
    expect(result.emaAlignment).toBe('unavailable')
  })

  it('returns above when price is above each EMA', () => {
    const ind = indicators({ ema20: 95, ema50: 90, ema100: 85, ema200: 80 })
    const result = computeEMAContext(100, ind, cfg)
    expect(result.priceVsEMA20).toBe('above')
    expect(result.priceVsEMA50).toBe('above')
    expect(result.priceVsEMA100).toBe('above')
    expect(result.priceVsEMA200).toBe('above')
  })

  it('returns below when price is below each EMA', () => {
    const ind = indicators({ ema20: 105, ema50: 110, ema100: 115, ema200: 120 })
    const result = computeEMAContext(100, ind, cfg)
    expect(result.priceVsEMA20).toBe('below')
    expect(result.priceVsEMA50).toBe('below')
    expect(result.priceVsEMA100).toBe('below')
    expect(result.priceVsEMA200).toBe('below')
  })

  it('returns bullish_stack when EMA20 > EMA50 > EMA100 > EMA200', () => {
    const ind = indicators({ ema20: 95, ema50: 90, ema100: 85, ema200: 80 })
    const result = computeEMAContext(100, ind, cfg)
    expect(result.emaAlignment).toBe('bullish_stack')
  })

  it('returns bearish_stack when EMA20 < EMA50 < EMA100 < EMA200', () => {
    const ind = indicators({ ema20: 105, ema50: 110, ema100: 115, ema200: 120 })
    const result = computeEMAContext(100, ind, cfg)
    expect(result.emaAlignment).toBe('bearish_stack')
  })

  it('returns mixed when EMAs are not in either stack order', () => {
    const ind = indicators({ ema20: 95, ema50: 92, ema100: 94, ema200: 80 })
    const result = computeEMAContext(100, ind, cfg)
    expect(result.emaAlignment).toBe('mixed')
  })

  it('returns mixed when only partial EMAs are available', () => {
    const ind = indicators({ ema20: 95, ema50: 90 })  // no ema100/200
    const result = computeEMAContext(100, ind, cfg)
    expect(result.emaAlignment).toBe('mixed')
  })

  it('detects a confluence zone when two EMAs are within emaConfluencePercent', () => {
    // ema50=100, ema100=100.3 → 0.3% apart, within 0.5%
    const ind = indicators({ ema20: 95, ema50: 100, ema100: 100.3, ema200: 80 })
    const result = computeEMAContext(101, ind, cfg)
    expect(result.confluenceZones.length).toBeGreaterThan(0)
    const zone = result.confluenceZones[0]
    expect(zone.emaPeriods).toContain(50)
    expect(zone.emaPeriods).toContain(100)
  })

  it('returns no confluence zones when EMAs are spread more than emaConfluencePercent apart', () => {
    const ind = indicators({ ema20: 95, ema50: 90, ema100: 85, ema200: 80 })
    const result = computeEMAContext(100, ind, cfg)
    // Each EMA is ~5.5% apart — no confluence
    expect(result.confluenceZones).toHaveLength(0)
  })

  it('returns no confluence zones when fewer than 2 EMAs are available', () => {
    const result = computeEMAContext(100, indicators({ ema20: 98 }), cfg)
    expect(result.confluenceZones).toHaveLength(0)
  })

  it('confluence zone centerPrice is midpoint of clustered EMAs', () => {
    const ind = indicators({ ema50: 100, ema100: 100.4, ema20: null, ema200: null })
    const result = computeEMAContext(101, ind, cfg)
    expect(result.confluenceZones).toHaveLength(1)
    expect(result.confluenceZones[0].centerPrice).toBeCloseTo(100.2, 5)
  })

  it('produces deterministic output for same inputs', () => {
    const ind = indicators({ ema20: 95, ema50: 90, ema100: 85, ema200: 80 })
    const r1 = computeEMAContext(100, ind, cfg)
    const r2 = computeEMAContext(100, ind, cfg)
    expect(r1).toEqual(r2)
  })
})
