import { describe, it, expect } from 'vitest'
import { clampSize, CHART_HEIGHT_DEFAULT, CHART_HEIGHT_MIN, CHART_HEIGHT_MAX } from '../hooks/useResizablePanel'
import { QUICK_TIMEFRAMES, EXTRA_TIMEFRAMES, ALL_TIMEFRAMES } from '../utils/timeframes'

// ── clampSize ────────────────────────────────────────────────────────────────

describe('clampSize()', () => {
  it('clamps to min when value is below range', () => {
    expect(clampSize(50, 150, 600)).toBe(150)
  })

  it('clamps to max when value exceeds range', () => {
    expect(clampSize(700, 150, 600)).toBe(600)
  })

  it('returns value unchanged when within range', () => {
    expect(clampSize(320, 150, 600)).toBe(320)
  })

  it('returns min at exact min boundary', () => {
    expect(clampSize(150, 150, 600)).toBe(150)
  })

  it('returns max at exact max boundary', () => {
    expect(clampSize(600, 150, 600)).toBe(600)
  })

  it('handles negative delta (drag up)', () => {
    expect(clampSize(320 - 200, 150, 600)).toBe(150)
  })

  it('handles delta within range', () => {
    expect(clampSize(320 + 100, 150, 600)).toBe(420)
  })
})

// ── chart height constants ───────────────────────────────────────────────────

describe('chart height constants', () => {
  it('default is within [min, max]', () => {
    expect(CHART_HEIGHT_DEFAULT).toBeGreaterThanOrEqual(CHART_HEIGHT_MIN)
    expect(CHART_HEIGHT_DEFAULT).toBeLessThanOrEqual(CHART_HEIGHT_MAX)
  })

  it('min is less than max', () => {
    expect(CHART_HEIGHT_MIN).toBeLessThan(CHART_HEIGHT_MAX)
  })

  it('clamping default returns default unchanged', () => {
    expect(clampSize(CHART_HEIGHT_DEFAULT, CHART_HEIGHT_MIN, CHART_HEIGHT_MAX)).toBe(CHART_HEIGHT_DEFAULT)
  })

  // Module 17: premium layout — chart should dominate the workspace
  it('default height is at least 500px so chart dominates the workspace', () => {
    expect(CHART_HEIGHT_DEFAULT).toBeGreaterThanOrEqual(500)
  })

  it('has the Module 17 premium values (560 default, 300 min, 900 max)', () => {
    expect(CHART_HEIGHT_DEFAULT).toBe(560)
    expect(CHART_HEIGHT_MIN).toBe(300)
    expect(CHART_HEIGHT_MAX).toBe(900)
  })

  it('clamps correctly across the full Module 17 range', () => {
    expect(clampSize(0, CHART_HEIGHT_MIN, CHART_HEIGHT_MAX)).toBe(300)
    expect(clampSize(1000, CHART_HEIGHT_MIN, CHART_HEIGHT_MAX)).toBe(900)
    expect(clampSize(560, CHART_HEIGHT_MIN, CHART_HEIGHT_MAX)).toBe(560)
  })
})

// ── timeframe coverage ───────────────────────────────────────────────────────

describe('QUICK_TIMEFRAMES', () => {
  it('has exactly 10 entries', () => {
    expect(QUICK_TIMEFRAMES).toHaveLength(10)
  })

  it('contains the most common timeframes', () => {
    expect(QUICK_TIMEFRAMES).toContain('1h')
    expect(QUICK_TIMEFRAMES).toContain('4h')
    expect(QUICK_TIMEFRAMES).toContain('1d')
  })
})

describe('EXTRA_TIMEFRAMES', () => {
  it('has exactly 5 entries', () => {
    expect(EXTRA_TIMEFRAMES).toHaveLength(5)
  })

  it('has no overlap with QUICK_TIMEFRAMES', () => {
    const quickSet: Set<string> = new Set(QUICK_TIMEFRAMES)
    for (const tf of EXTRA_TIMEFRAMES) {
      expect(quickSet.has(tf)).toBe(false)
    }
  })
})

describe('ALL_TIMEFRAMES', () => {
  it('has exactly 15 entries', () => {
    expect(ALL_TIMEFRAMES).toHaveLength(15)
  })

  it('has no duplicates', () => {
    expect(new Set(ALL_TIMEFRAMES).size).toBe(ALL_TIMEFRAMES.length)
  })

  it('union of quick + extra equals all', () => {
    const combined = new Set([...QUICK_TIMEFRAMES, ...EXTRA_TIMEFRAMES])
    expect(combined.size).toBe(ALL_TIMEFRAMES.length)
    for (const tf of ALL_TIMEFRAMES) {
      expect(combined.has(tf)).toBe(true)
    }
  })
})
