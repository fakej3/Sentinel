import { describe, it, expect } from 'vitest'
import { collectEvidence } from '../compute/evidence'
import { DEFAULT_ANALYSIS_CONFIG } from '../config'
import { synthesizeFullTrend } from '../compute/full-trend'
import { computeEMAContext } from '../compute/ema-context'
import { interpretIndicators } from '../compute/indicators'
import { deriveSRContext } from '../compute/sr-context'
import { buildVolumeContext } from '../compute/volume-context'
import {
  indicators,
  bullishIndicators,
  bearishIndicators,
  bullishStructure,
  bearishStructure,
  emptyStructure,
  emptySupportResistance,
  emptyVolumeAnalysis,
  priceZone,
  macd,
} from './helpers'

const cfg = DEFAULT_ANALYSIS_CONFIG

function getEvidence(
  price: number,
  ind = indicators(),
  structure = emptyStructure(),
  sr = emptySupportResistance(),
  vol = emptyVolumeAnalysis(),
) {
  const fullTrend = synthesizeFullTrend(price, ind, structure, cfg)
  const emaContext = computeEMAContext(price, ind, cfg)
  const indicatorSummary = interpretIndicators(price, ind, cfg)
  const srContext = deriveSRContext(price, sr, cfg)
  const volumeContext = buildVolumeContext(vol)
  return collectEvidence(fullTrend, emaContext, indicatorSummary, structure, srContext, volumeContext, ind, cfg)
}

describe('collectEvidence', () => {
  it('returns an array of EvidenceItem objects', () => {
    const items = getEvidence(100)
    expect(Array.isArray(items)).toBe(true)
  })

  it('includes "Price above EMA200" when price > EMA200', () => {
    const ind = indicators({ ema200: 80 })
    const items = getEvidence(100, ind)
    const found = items.find((e) => e.factor === 'Price above EMA200')
    expect(found).toBeDefined()
    expect(found?.source).toBe('indicators')
    expect(found?.impact).toBe('high')
  })

  it('includes "Price below EMA200" when price < EMA200', () => {
    const ind = indicators({ ema200: 120 })
    const items = getEvidence(100, ind)
    expect(items.find((e) => e.factor === 'Price below EMA200')).toBeDefined()
  })

  it('includes "EMA bullish alignment" when EMAs in bullish stack', () => {
    const ind = indicators({ ema20: 95, ema50: 90, ema100: 85, ema200: 80 })
    const items = getEvidence(100, ind)
    expect(items.find((e) => e.factor === 'EMA bullish alignment')).toBeDefined()
  })

  it('includes "EMA bearish alignment" when EMAs in bearish stack', () => {
    const ind = indicators({ ema20: 105, ema50: 110, ema100: 115, ema200: 120 })
    const items = getEvidence(100, ind)
    expect(items.find((e) => e.factor === 'EMA bearish alignment')).toBeDefined()
  })

  it('includes HH and HL evidence when bullish structure present', () => {
    const items = getEvidence(100, indicators(), bullishStructure())
    expect(items.find((e) => e.factor === 'Higher High confirmed')).toBeDefined()
    expect(items.find((e) => e.factor === 'Higher Low confirmed')).toBeDefined()
  })

  it('includes LH and LL evidence when bearish structure present', () => {
    const items = getEvidence(100, indicators(), bearishStructure())
    expect(items.find((e) => e.factor === 'Lower High confirmed')).toBeDefined()
    expect(items.find((e) => e.factor === 'Lower Low confirmed')).toBeDefined()
  })

  it('includes "MACD bullish bias" when MACD histogram is positive', () => {
    const ind = indicators({ macd: macd(10, 5) })
    const items = getEvidence(100, ind)
    expect(items.find((e) => e.factor === 'MACD bullish bias')).toBeDefined()
  })

  it('includes "MACD bearish bias" when MACD histogram is negative', () => {
    const ind = indicators({ macd: macd(5, 10) })
    const items = getEvidence(100, ind)
    expect(items.find((e) => e.factor === 'MACD bearish bias')).toBeDefined()
  })

  it('includes "Price at active support" when inside a support zone', () => {
    const zone = priceZone('support', 100)
    const sr = { ...emptySupportResistance(), currentZone: zone, activeSupport: [zone] }
    const items = getEvidence(100, indicators(), emptyStructure(), sr)
    expect(items.find((e) => e.factor === 'Price at active support')).toBeDefined()
  })

  it('includes "Strong volume confirmation" when volume confirms move', () => {
    const vol = {
      ...emptyVolumeAnalysis(),
      volumeConfirmation: {
        confirmed: true,
        reason: 'High vol',
        supportsTrend: true,
        supportsBreakout: false,
        supportsBOS: false,
        supportsCHOCH: false,
      },
    }
    const items = getEvidence(100, indicators(), emptyStructure(), emptySupportResistance(), vol)
    expect(items.find((e) => e.factor === 'Strong volume confirmation')).toBeDefined()
  })

  it('includes "Accumulation detected" when accDist state is accumulation', () => {
    const vol = {
      ...emptyVolumeAnalysis(),
      accumulationDistribution: { state: 'accumulation' as const, score: 5 },
    }
    const items = getEvidence(100, indicators(), emptyStructure(), emptySupportResistance(), vol)
    expect(items.find((e) => e.factor === 'Accumulation detected')).toBeDefined()
  })

  it('items are sorted high impact first', () => {
    const ind = bullishIndicators()
    const items = getEvidence(100, ind, bullishStructure())
    const impactOrder = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < items.length; i++) {
      expect(impactOrder[items[i].impact]).toBeGreaterThanOrEqual(impactOrder[items[i - 1].impact])
    }
  })

  it('all items have required fields', () => {
    const items = getEvidence(100, bullishIndicators(), bullishStructure())
    for (const it of items) {
      expect(typeof it.factor).toBe('string')
      expect(it.factor.length).toBeGreaterThan(0)
      expect(['high', 'medium', 'low']).toContain(it.impact)
      expect(typeof it.description).toBe('string')
      expect(['indicators', 'market_structure', 'support_resistance', 'volume']).toContain(it.source)
      expect(['bullish', 'bearish', 'neutral']).toContain(it.direction)
    }
  })

  // ── MED-02 regression: every evidence item carries an explicit direction ──

  it('all items have a direction field (regression: MED-02)', () => {
    const bearishInd = bearishIndicators()
    const bearishStr = bearishStructure()
    const allItems = [
      ...getEvidence(100, bullishIndicators(), bullishStructure()),
      ...getEvidence(100, bearishInd, bearishStr),
      ...getEvidence(100),
    ]
    for (const it of allItems) {
      expect(it.direction, `item "${it.factor}" is missing direction`).toBeDefined()
      expect(['bullish', 'bearish', 'neutral']).toContain(it.direction)
    }
  })

  it('produces deterministic output for same inputs', () => {
    const ind = bullishIndicators()
    const s = bullishStructure()
    const items1 = getEvidence(100, ind, s)
    const items2 = getEvidence(100, ind, s)
    expect(items1).toEqual(items2)
  })

  // ── Regression: CRIT-001 — breakout.detected did not exist on BreakoutResult;
  // accessing it returned undefined (falsy), silently suppressing these items.

  it('emits "Bullish breakout confirmed" when breakout.confirmed is true and direction is bullish (regression: CRIT-001)', () => {
    const structure = {
      ...emptyStructure(),
      breakout: { confirmed: true, failed: false, level: 105, direction: 'bullish' as const },
    }
    const items = getEvidence(100, indicators(), structure)
    const found = items.find(e => e.factor === 'Bullish breakout confirmed')
    expect(found).toBeDefined()
    expect(found?.direction).toBe('bullish')
    expect(found?.impact).toBe('high')
  })

  it('emits "Bearish breakout confirmed" when breakout.confirmed is true and direction is bearish', () => {
    const structure = {
      ...emptyStructure(),
      breakout: { confirmed: true, failed: false, level: 95, direction: 'bearish' as const },
    }
    const items = getEvidence(100, indicators(), structure)
    const found = items.find(e => e.factor === 'Bearish breakout confirmed')
    expect(found).toBeDefined()
    expect(found?.direction).toBe('bearish')
    expect(found?.impact).toBe('high')
  })

  it('emits "Failed breakout" when breakout.failed is true (regression: CRIT-001)', () => {
    const structure = {
      ...emptyStructure(),
      breakout: { confirmed: false, failed: true, level: 105, direction: null },
    }
    const items = getEvidence(100, indicators(), structure)
    const found = items.find(e => e.factor === 'Failed breakout')
    expect(found).toBeDefined()
    expect(found?.impact).toBe('medium')
  })

  // ── Regression: CRIT-002 — pullback.active did not exist on PullbackResult;
  // the correct field is pullback.detected.

  it('emits "Active pullback" when pullback.detected is true (regression: CRIT-002)', () => {
    const structure = {
      ...emptyStructure(),
      pullback: { detected: true, depth: 0.38 },
    }
    const items = getEvidence(100, indicators(), structure)
    const found = items.find(e => e.factor === 'Active pullback')
    expect(found).toBeDefined()
    expect(found?.impact).toBe('medium')
  })

  // ── Regression: neutral OBV direction must NOT emit F_BULLISH_OBV
  // When OBV has no directional trend ('neutral') but price confirmation flag is
  // true, the previous else-branch incorrectly emitted F_BULLISH_OBV (+6).

  it('does not emit "Bullish OBV trend" when OBV direction is neutral (regression: OBV-neutral)', () => {
    const vol = emptyVolumeAnalysis()
    vol.obvAnalysis = { direction: 'neutral', confirmingPrice: true, diverging: false }
    const items = getEvidence(100, indicators(), undefined, undefined, vol)
    const found = items.find(e => e.factor === 'Bullish OBV trend')
    expect(found).toBeUndefined()
  })

  it('still emits "Bullish OBV trend" when OBV direction is bullish and confirming', () => {
    const vol = emptyVolumeAnalysis()
    vol.obvAnalysis = { direction: 'bullish', confirmingPrice: true, diverging: false }
    const items = getEvidence(100, indicators(), undefined, undefined, vol)
    const found = items.find(e => e.factor === 'Bullish OBV trend')
    expect(found).toBeDefined()
    expect(found?.direction).toBe('bullish')
  })
})
