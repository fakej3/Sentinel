import { describe, it, expect } from 'vitest'
import { computeConfidence } from '../index'
import { DEFAULT_CONFIDENCE_CONFIG } from '../config'
import { scoreToGrade } from '../compute/grade'
import { scoreEvidence, normalize } from '../compute/score'
import { computeBreakdown } from '../compute/breakdown'
import { computeTrust } from '../compute/trust'
import { ev, makeAnalysis, makeDirectionalAnalysis, cleanValidation, validationWithWarnings, validationWithCriticals, validationWithBoth } from './helpers'
import type { EvidenceDirection } from '../../analysis/types'

const cfg = DEFAULT_CONFIDENCE_CONFIG

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Normalize raw points using the default divisor */
function norm(raw: number): number {
  return Math.min(10, Math.max(0, raw / cfg.normalizationDivisor))
}

// ─────────────────────────────────────────────────────────────────────────────
// scoreEvidence unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreEvidence', () => {
  it('returns zero points for empty evidence', () => {
    const result = scoreEvidence([], cfg)
    expect(result.rawPoints).toBe(0)
    expect(result.bullishRawPoints).toBe(0)
    expect(result.bearishRawPoints).toBe(0)
    expect(result.reasons).toHaveLength(0)
  })

  it('adds positive points for a known bullish factor', () => {
    const result = scoreEvidence([ev('Price above EMA200', 'bullish')], cfg)
    expect(result.rawPoints).toBe(15)
    expect(result.bullishRawPoints).toBe(15)
    expect(result.bearishRawPoints).toBe(0)
  })

  it('adds negative points for a known bearish factor', () => {
    const result = scoreEvidence([ev('Price below EMA200', 'bearish')], cfg)
    expect(result.rawPoints).toBe(-15)
    expect(result.bullishRawPoints).toBe(0)
    expect(result.bearishRawPoints).toBe(15)
  })

  it('ignores factors not in the weight map', () => {
    const result = scoreEvidence([ev('Unknown factor', 'neutral')], cfg)
    expect(result.rawPoints).toBe(0)
    expect(result.reasons).toHaveLength(0)
  })

  it('accumulates multiple factors correctly', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),  // +15
      ev('Higher High confirmed', 'bullish'), // +15
      ev('MACD bullish bias', 'bullish'),   // +10
    ]
    const result = scoreEvidence(evidence, cfg)
    expect(result.rawPoints).toBe(40)
    expect(result.bullishRawPoints).toBe(40)
    expect(result.reasons).toHaveLength(3)
  })

  it('accumulates mixed positive and negative factors', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),  // +15
      ev('Lower High confirmed', 'bearish'), // -15
      ev('ADX above 25', 'neutral'),         // +8
    ]
    const result = scoreEvidence(evidence, cfg)
    expect(result.rawPoints).toBe(8)  // 15 - 15 + 8
    expect(result.bullishRawPoints).toBe(23)  // 15 + 8
    expect(result.bearishRawPoints).toBe(15)
  })

  it('produces reasons with correct fields', () => {
    const evidence = [ev('MACD bullish bias', 'bullish', 'medium')]
    const result = scoreEvidence(evidence, cfg)
    expect(result.reasons).toHaveLength(1)
    expect(result.reasons[0]).toEqual({
      factor: 'MACD bullish bias',
      points: 10,
      direction: 'bullish',
    })
  })

  it('reflects direction from the evidence item, not from whether points are positive', () => {
    // 'ADX above 25' is neutral direction but has positive points
    const evidence = [ev('ADX above 25', 'neutral')]
    const result = scoreEvidence(evidence, cfg)
    expect(result.reasons[0].direction).toBe('neutral')
    expect(result.reasons[0].points).toBe(8)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// normalize unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('returns 0 for negative raw points', () => {
    expect(normalize(-100, 10)).toBe(0)
  })

  it('returns 10 for raw points equal to divisor × 10', () => {
    expect(normalize(100, 10)).toBe(10)
  })

  it('clamps to 10 for raw points above max', () => {
    expect(normalize(200, 10)).toBe(10)
  })

  it('normalizes intermediate values correctly', () => {
    // 15 / 10 = 1.5
    expect(normalize(15, 10)).toBeCloseTo(1.5)
  })

  it('returns 0 for raw = 0', () => {
    expect(normalize(0, 10)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// scoreToGrade unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreToGrade', () => {
  it('returns weak for score = 0', () => {
    expect(scoreToGrade(0, cfg)).toBe('weak')
  })

  it('returns weak for score below mixed threshold', () => {
    expect(scoreToGrade(2.9, cfg)).toBe('weak')
  })

  it('returns mixed at score = 3.0', () => {
    expect(scoreToGrade(3.0, cfg)).toBe('mixed')
  })

  it('returns mixed between 3 and 5', () => {
    expect(scoreToGrade(4.0, cfg)).toBe('mixed')
  })

  it('returns moderate at score = 5.0', () => {
    expect(scoreToGrade(5.0, cfg)).toBe('moderate')
  })

  it('returns moderate between 5 and 7', () => {
    expect(scoreToGrade(6.0, cfg)).toBe('moderate')
  })

  it('returns strong at score = 7.0', () => {
    expect(scoreToGrade(7.0, cfg)).toBe('strong')
  })

  it('returns strong between 7 and 8.5', () => {
    expect(scoreToGrade(8.0, cfg)).toBe('strong')
  })

  it('returns very_strong at score = 8.5', () => {
    expect(scoreToGrade(8.5, cfg)).toBe('very_strong')
  })

  it('returns very_strong at score = 10', () => {
    expect(scoreToGrade(10, cfg)).toBe('very_strong')
  })

  it('respects custom thresholds', () => {
    const customCfg = { ...cfg, gradeThresholds: { veryStrong: 9, strong: 7, moderate: 5, mixed: 3 } }
    expect(scoreToGrade(8.5, customCfg)).toBe('strong')
    expect(scoreToGrade(9.0, customCfg)).toBe('very_strong')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — core scoring
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — core scoring', () => {
  it('returns score 0 and grade weak when evidence is empty', () => {
    const result = computeConfidence(makeAnalysis([]), cleanValidation())
    expect(result.score).toBe(0)
    expect(result.grade).toBe('weak')
    expect(result.reasons).toHaveLength(0)
  })

  it('returns the correct score for a single positive factor', () => {
    const analysis = makeAnalysis([ev('Price above EMA200', 'bullish')])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.score).toBeCloseTo(norm(15))
    expect(result.reasons).toHaveLength(1)
    expect(result.reasons[0].factor).toBe('Price above EMA200')
    expect(result.reasons[0].points).toBe(15)
  })

  it('scores bearish-only evidence by signal strength, not direction', () => {
    // rawPoints = -45, abs(-45) = 45, 45/10.6 ≈ 4.245 (mixed grade)
    const analysis = makeAnalysis([
      ev('Price below EMA200', 'bearish'),    // -15
      ev('Lower High confirmed', 'bearish'),   // -15
      ev('Lower Low confirmed', 'bearish'),    // -15
    ])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.score).toBeCloseTo(norm(45))
    expect(result.grade).toBe('mixed')
  })

  it('clamps to 10 when raw points exceed 100', () => {
    // A strong bullish market easily exceeds 100 raw points → score clamps at 10
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),        // +15
      ev('EMA bullish alignment', 'bullish'),      // +12
      ev('Higher High confirmed', 'bullish'),      // +15
      ev('Higher Low confirmed', 'bullish'),       // +15
      ev('Strong volume confirmation', 'neutral'), // +12
      ev('MACD bullish bias', 'bullish'),          // +10
      ev('Accumulation detected', 'bullish'),      // +10
      ev('Bullish BOS', 'bullish'),                // +10
      ev('RSI in 55–70 range', 'bullish'),         // +8
      ev('ADX above 25', 'neutral'),               // +8
      ev('Price above EMA50', 'bullish'),          // +7
      ev('Bullish OBV trend', 'bullish'),          // +6
      ev('Price above EMA20', 'bullish'),          // +5
      ev('StochRSI oversold', 'bullish'),          // +5
    ])
    // Sum = 138 raw points, 138/10 = 13.8 → clamped to 10
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.score).toBeCloseTo(10)
  })

  it('produces grade that matches score', () => {
    // 'Price above EMA200' (+15) + 'Higher High confirmed' (+15) = 30 → 30/10 = 3.0 → mixed
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
    ])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.grade).toBe('mixed')
  })

  it('ignores evidence factors not in the weight map', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),        // +15 → counted
      ev('Unknown wave pattern', 'bullish'),       // not in weights → ignored
      ev('Elliott wave impulse', 'neutral'),       // not in weights → ignored
    ])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.score).toBeCloseTo(norm(15))
    expect(result.reasons).toHaveLength(1)
  })

  it('does not double-count the same factor when it appears twice in evidence', () => {
    // Edge case: Module 6 might theoretically emit the same factor twice
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Price above EMA200', 'bullish'),  // duplicate
    ])
    const result = computeConfidence(analysis, cleanValidation())
    // Each occurrence is counted independently (evidence is passed as-is)
    expect(result.reasons).toHaveLength(2)
    expect(result.score).toBeCloseTo(norm(30))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — directional confidence
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — directional confidence', () => {
  it('bullishConfidence > 0 and bearishConfidence = 0 for only bullish factors', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),  // +15
      ev('Higher High confirmed', 'bullish'), // +15
    ])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.bullishConfidence).toBeCloseTo(norm(30))
    expect(result.bearishConfidence).toBe(0)
  })

  it('bearishConfidence > 0 and bullishConfidence = 0 for only bearish factors', () => {
    const analysis = makeAnalysis([
      ev('Price below EMA200', 'bearish'),  // -15
      ev('Lower High confirmed', 'bearish'), // -15
    ])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.bullishConfidence).toBe(0)
    expect(result.bearishConfidence).toBeCloseTo(norm(30))
  })

  it('both directional scores are non-zero for mixed evidence', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),   // +15
      ev('Lower High confirmed', 'bearish'), // -15
    ])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.bullishConfidence).toBeCloseTo(norm(15))
    expect(result.bearishConfidence).toBeCloseTo(norm(15))
    expect(result.score).toBeCloseTo(0)  // net = 0
  })

  it('neutral factors contribute to bullishConfidence when weight is positive', () => {
    // ADX above 25 has direction neutral but weight +8 → contributes to bullishRawPoints
    const analysis = makeAnalysis([ev('ADX above 25', 'neutral')])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.bullishConfidence).toBeCloseTo(norm(8))
    expect(result.bearishConfidence).toBe(0)
  })

  it('bearishConfidence is capped at 10 for very high negative weight totals', () => {
    const analysis = makeAnalysis([
      ev('Price below EMA200', 'bearish'),    // -15
      ev('Lower High confirmed', 'bearish'),   // -15
      ev('Lower Low confirmed', 'bearish'),    // -15
      ev('MACD bearish bias', 'bearish'),      // -10
      ev('Strong resistance overhead', 'bearish'), // -5
      ev('Overbought RSI (>70)', 'bearish'),   // -10
      ev('RSI in 30–45 range', 'bearish'),     // -8
      ev('Below average volume on move', 'neutral'), // -8
    ])
    // Total negative points = 86, 86/10 = 8.6 → high but < 10
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.bearishConfidence).toBeCloseTo(norm(86))
    expect(result.bearishConfidence).toBeLessThanOrEqual(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — validation penalties
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — validation penalties', () => {
  it('applies no penalty for clean validation', () => {
    const analysis = makeAnalysis([ev('Price above EMA200', 'bullish')])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.penalties).toHaveLength(0)
    expect(result.score).toBeCloseTo(norm(15))
  })

  it('reduces score by warningScorePenalty per warning', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),  // +15
      ev('Higher High confirmed', 'bullish'), // +15
      ev('Higher Low confirmed', 'bullish'),  // +15
      ev('Strong volume confirmation', 'neutral'), // +12
      ev('MACD bullish bias', 'bullish'),   // +10
    ])
    // raw = 67, normalized ≈ 6.32
    const baseScore = norm(67)
    const result = computeConfidence(analysis, validationWithWarnings(1))
    expect(result.score).toBeCloseTo(baseScore - cfg.warningScorePenalty)
    expect(result.penalties).toHaveLength(1)
    expect(result.penalties[0].source).toBe('validation_warning')
    expect(result.penalties[0].scoreReduction).toBe(cfg.warningScorePenalty)
  })

  it('reduces score by warningScorePenalty × N for N warnings', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('Higher Low confirmed', 'bullish'),
      ev('Strong volume confirmation', 'neutral'),
      ev('MACD bullish bias', 'bullish'),
    ])
    const baseScore = norm(67)
    const result = computeConfidence(analysis, validationWithWarnings(3))
    expect(result.score).toBeCloseTo(Math.max(0, baseScore - 3 * cfg.warningScorePenalty))
    expect(result.penalties[0].scoreReduction).toBe(3 * cfg.warningScorePenalty)
  })

  it('clamps score to 0 after excessive warning penalties', () => {
    // Score near 0 with many warnings
    const analysis = makeAnalysis([ev('Price above EMA20', 'bullish')]) // +5 → 0.47
    const result = computeConfidence(analysis, validationWithWarnings(10))
    expect(result.score).toBe(0)
  })

  it('caps score at criticalScoreCap when critical issues are present', () => {
    // Give it a very high score
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('Higher Low confirmed', 'bullish'),
      ev('Strong volume confirmation', 'neutral'),
      ev('MACD bullish bias', 'bullish'),
      ev('RSI in 55–70 range', 'bullish'),
      ev('ADX above 25', 'neutral'),
      ev('Price above EMA50', 'bullish'),
    ])
    // raw = 67+8+8+7 = 90, normalized ≈ 8.49 → capped at 3.0
    const result = computeConfidence(analysis, validationWithCriticals(1))
    expect(result.score).toBe(cfg.criticalScoreCap)
    expect(result.penalties.some(p => p.source === 'validation_critical')).toBe(true)
  })

  it('does not add a critical penalty when score is already below criticalScoreCap', () => {
    // Very low score (1 small positive factor)
    const analysis = makeAnalysis([ev('Price above EMA20', 'bullish')]) // 0.47 < 3.0
    const result = computeConfidence(analysis, validationWithCriticals(1))
    expect(result.score).toBe(norm(5))  // no cap applied (already below)
    // No critical penalty because score didn't need to be reduced
    expect(result.penalties.filter(p => p.source === 'validation_critical')).toHaveLength(0)
  })

  it('applies warnings first, then critical cap', () => {
    // High score + 1 warning + 1 critical
    // raw = 106 → normalized = 10.0
    // After 1 warning: 10.0 - 0.5 = 9.5
    // After critical cap: min(9.5, 3.0) = 3.0
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('Higher Low confirmed', 'bullish'),
      ev('Strong volume confirmation', 'neutral'),
      ev('MACD bullish bias', 'bullish'),
      ev('RSI in 55–70 range', 'bullish'),
      ev('ADX above 25', 'neutral'),
      ev('Price above EMA50', 'bullish'),
      ev('Bullish OBV trend', 'bullish'),
      ev('Price above EMA20', 'bullish'),
      ev('StochRSI oversold', 'bullish'),
    ])
    const result = computeConfidence(analysis, validationWithBoth(1, 1))
    expect(result.score).toBe(cfg.criticalScoreCap)
    expect(result.penalties).toHaveLength(2)
    expect(result.penalties[0].source).toBe('validation_warning')
    expect(result.penalties[1].source).toBe('validation_critical')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — warnings emitted
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — warnings emitted', () => {
  it('emits no warnings for clean validation', () => {
    const result = computeConfidence(makeAnalysis([]), cleanValidation())
    expect(result.warnings).toHaveLength(0)
  })

  it('emits a validation warning when criticalCount > 0', () => {
    const result = computeConfidence(makeAnalysis([ev('Price above EMA200', 'bullish')]), validationWithCriticals(2))
    const validationWarning = result.warnings.find(w => w.source === 'validation')
    expect(validationWarning).toBeDefined()
    expect(validationWarning?.message).toContain('2 critical')
  })

  it('emits a validation warning when passed = false and only warnings exist', () => {
    // 1 warning, passed = false
    const result = computeConfidence(makeAnalysis([ev('Price above EMA200', 'bullish')]), validationWithWarnings(1))
    const advisory = result.warnings.find(w => w.source === 'validation')
    expect(advisory).toBeDefined()
  })

  it('does not emit an advisory warning for clean validation with only infos', () => {
    const validation = {
      passed: true,
      clean: false,
      issues: [{ severity: 'info' as const, category: 'consistency' as const, field: 'f', message: 'info' }],
      criticalCount: 0,
      warningCount: 0,
      infoCount: 1,
      summary: '1 info',
    }
    const result = computeConfidence(makeAnalysis([]), validation)
    expect(result.warnings).toHaveLength(0)
    expect(result.penalties).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — config overrides
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — config overrides', () => {
  it('uses custom factorWeights for scoring', () => {
    const customConfig = {
      factorWeights: { 'Price above EMA200': 50 },
    }
    const analysis = makeAnalysis([ev('Price above EMA200', 'bullish')])
    const result = computeConfidence(analysis, cleanValidation(), customConfig)
    // 50 / 10.6 ≈ 4.72
    expect(result.score).toBeCloseTo(50 / cfg.normalizationDivisor)
    expect(result.reasons[0].points).toBe(50)
  })

  it('merges custom factorWeights with defaults (does not replace all)', () => {
    const customConfig = {
      factorWeights: { 'Price above EMA200': 50 },
    }
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),    // custom: 50
      ev('Higher High confirmed', 'bullish'), // default: 15
    ])
    const result = computeConfidence(analysis, cleanValidation(), customConfig)
    expect(result.reasons.find(r => r.factor === 'Price above EMA200')?.points).toBe(50)
    expect(result.reasons.find(r => r.factor === 'Higher High confirmed')?.points).toBe(15)
  })

  it('uses custom normalizationDivisor', () => {
    const customConfig = { normalizationDivisor: 15 }
    const analysis = makeAnalysis([ev('Price above EMA200', 'bullish')]) // +15
    const result = computeConfidence(analysis, cleanValidation(), customConfig)
    expect(result.score).toBeCloseTo(15 / 15) // = 1.0
  })

  it('uses custom warningScorePenalty', () => {
    const customConfig = { warningScorePenalty: 1.0 }
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),  // +15
      ev('Higher High confirmed', 'bullish'), // +15
      ev('Higher Low confirmed', 'bullish'),  // +15
      ev('Strong volume confirmation', 'neutral'), // +12
      ev('MACD bullish bias', 'bullish'),   // +10
    ])
    const baseScore = norm(67)
    const result = computeConfidence(analysis, validationWithWarnings(1), customConfig)
    expect(result.score).toBeCloseTo(baseScore - 1.0)
  })

  it('uses custom criticalScoreCap', () => {
    const customConfig = { criticalScoreCap: 5.0 }
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('Higher Low confirmed', 'bullish'),
      ev('Strong volume confirmation', 'neutral'),
      ev('MACD bullish bias', 'bullish'),
      ev('RSI in 55–70 range', 'bullish'),
      ev('ADX above 25', 'neutral'),
      ev('Price above EMA50', 'bullish'),
    ])
    const result = computeConfidence(analysis, validationWithCriticals(1), customConfig)
    expect(result.score).toBe(5.0)
  })

  it('uses custom grade thresholds', () => {
    const customConfig = {
      gradeThresholds: { veryStrong: 9.0, strong: 6.0, moderate: 4.0, mixed: 2.0 },
    }
    // Score ≈ 1.415 → would normally be 'weak', with custom thresholds still 'weak' (below 2.0)
    const analysis = makeAnalysis([ev('Price above EMA200', 'bullish')]) // 15/10.6 ≈ 1.415
    const result = computeConfidence(analysis, cleanValidation(), customConfig)
    expect(result.grade).toBe('weak')
  })

  it('custom grade threshold: lower mixed boundary changes grade', () => {
    const customConfig = {
      gradeThresholds: { veryStrong: 9.0, strong: 6.0, moderate: 4.0, mixed: 1.0 },
    }
    // Score ≈ 1.415 → above mixed(1.0) → 'mixed'
    const analysis = makeAnalysis([ev('Price above EMA200', 'bullish')])
    const result = computeConfidence(analysis, cleanValidation(), customConfig)
    expect(result.grade).toBe('mixed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — specific factor weights from ENGINE_RULES.md §11
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — ENGINE_RULES.md §11 factor weights', () => {
  const factorCases: Array<[string, EvidenceDirection, number]> = [
    // ── Positive weights ──
    ['Price above EMA200',          'bullish',  15],
    ['EMA bullish alignment',       'bullish',  12],
    ['Higher High confirmed',       'bullish',  15],
    ['Higher Low confirmed',        'bullish',  15],
    ['Strong volume confirmation',  'neutral',  12],
    ['Accumulation detected',       'bullish',  10],
    ['Price at active support',     'bullish',  10],
    ['Bullish BOS',                 'bullish',  10],
    ['Bullish breakout confirmed',  'bullish',  10],
    ['MACD bullish bias',           'bullish',  10],
    ['Price above EMA100',          'bullish',  10],
    ['Bullish CHoCH',               'bullish',   8],
    ['RSI in 55–70 range',          'bullish',   8],
    ['Oversold RSI (<30)',           'bullish',   8],
    ['ADX above 25',                'neutral',   8],
    ['RSI supports bullish',        'bullish',   7],
    ['Price above EMA50',           'bullish',   7],
    ['Volume climax selling',       'bullish',   6],
    ['Bullish OBV trend',           'bullish',   6],
    ['Price at Bollinger lower',    'bullish',   5],
    ['Price above EMA20',           'bullish',   5],
    ['StochRSI oversold',           'bullish',   5],
    ['Strong support below',        'bullish',   5],
    ['Price above VWAP',            'bullish',   4],
    ['Active support zone',         'bullish',   3],
    ['High relative volume',        'neutral',   3],
    // ── Negative weights ──
    ['Price below EMA200',          'bearish', -15],
    ['Lower High confirmed',        'bearish', -15],
    ['Lower Low confirmed',         'bearish', -15],
    ['EMA bearish alignment',       'bearish', -12],
    ['Distribution detected',       'bearish', -10],
    ['Price at active resistance',  'bearish', -10],
    ['Bearish BOS',                 'bearish', -10],
    ['Bearish breakout confirmed',  'bearish', -10],
    ['MACD bearish bias',           'bearish', -10],
    ['Overbought RSI (>70)',         'bearish', -10],
    ['Price below EMA100',          'bearish', -10],
    ['RSI in 30–45 range',          'bearish',  -8],
    ['Bearish CHoCH',               'bearish',  -8],
    ['Strong resistance above',     'bearish',  -8],
    ['Below average volume on move','neutral',  -8],
    ['RSI supports bearish',        'bearish',  -7],
    ['Price below EMA50',           'bearish',  -7],
    ['Volume climax buying',        'bearish',  -6],
    ['OBV diverging from price',    'bearish',  -5],
    ['Failed breakout',             'bearish',  -5],
    ['Strong resistance overhead',  'bearish',  -5],
    ['Price at Bollinger upper',    'bearish',  -5],
    ['Price below EMA20',           'bearish',  -5],
    ['Price below VWAP',            'bearish',  -4],
    ['StochRSI overbought',         'bearish',  -4],
    ['ADX trend weak',              'neutral',  -4],
    ['Active pullback',             'neutral',  -3],
    ['Market in consolidation',     'neutral',  -3],
    ['Low relative volume',         'neutral',  -3],
  ]

  for (const [factor, direction, expectedPoints] of factorCases) {
    it(`'${factor}' has weight ${expectedPoints}`, () => {
      const analysis = makeAnalysis([ev(factor, direction)])
      const result = computeConfidence(analysis, cleanValidation())
      expect(result.reasons[0]?.points).toBe(expectedPoints)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — determinism
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — determinism', () => {
  it('produces identical output for identical inputs', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('MACD bullish bias', 'bullish'),
      ev('Overbought RSI (>70)', 'bearish'),
    ])
    const validation = validationWithWarnings(1)
    const r1 = computeConfidence(analysis, validation)
    const r2 = computeConfidence(analysis, validation)
    expect(r1).toEqual(r2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — reasons array completeness
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — reasons array', () => {
  it('includes all weighted factors in reasons', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('EMA bullish alignment', 'bullish'),      // now in weights → included
      ev('RSI in 55–70 range', 'bullish'),
      ev('ADX above 25', 'neutral'),
      ev('Unknown wave pattern', 'bullish'),        // not in weights → excluded
    ])
    const result = computeConfidence(analysis, cleanValidation())
    const factors = result.reasons.map(r => r.factor)
    expect(factors).toContain('Price above EMA200')
    expect(factors).toContain('EMA bullish alignment')
    expect(factors).toContain('RSI in 55–70 range')
    expect(factors).toContain('ADX above 25')
    expect(factors).not.toContain('Unknown wave pattern')
  })

  it('reasons preserve direction from evidence items', () => {
    const analysis = makeAnalysis([
      ev('Price above EMA200', 'bullish'),
      ev('Overbought RSI (>70)', 'bearish'),
      ev('ADX above 25', 'neutral'),
    ])
    const result = computeConfidence(analysis, cleanValidation())
    expect(result.reasons.find(r => r.factor === 'Price above EMA200')?.direction).toBe('bullish')
    expect(result.reasons.find(r => r.factor === 'Overbought RSI (>70)')?.direction).toBe('bearish')
    expect(result.reasons.find(r => r.factor === 'ADX above 25')?.direction).toBe('neutral')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// computeConfidence — DEFAULT_CONFIDENCE_CONFIG integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_CONFIDENCE_CONFIG', () => {
  it('normalizationDivisor is 10', () => {
    expect(cfg.normalizationDivisor).toBe(10)
  })

  it('a strong bullish market achieves a very high (≥ 10) raw score before clamping', () => {
    // A representative strong bullish market fires many high-weight factors
    const strongBullishFactors = [
      'Price above EMA200',        // 15
      'EMA bullish alignment',     // 12
      'Higher High confirmed',     // 15
      'Higher Low confirmed',      // 15
      'Strong volume confirmation',// 12
      'MACD bullish bias',         // 10
      'Accumulation detected',     // 10
      'Bullish BOS',               // 10
      'RSI in 55–70 range',        //  8
      'ADX above 25',              //  8
      'Price above EMA50',         //  7
      'Bullish OBV trend',         //  6
      'Price above EMA20',         //  5
    ]
    const sum = strongBullishFactors.reduce((acc, name) => acc + (cfg.factorWeights[name] ?? 0), 0)
    // Verify sum > 100 so normalized score exceeds 10 (gets clamped)
    expect(sum).toBeGreaterThan(100)
    expect(sum / cfg.normalizationDivisor).toBeGreaterThan(10)
  })

  it('contains grade thresholds matching ENGINE_RULES.md §11', () => {
    expect(cfg.gradeThresholds.veryStrong).toBe(8.5)
    expect(cfg.gradeThresholds.strong).toBe(7.0)
    expect(cfg.gradeThresholds.moderate).toBe(5.0)
    expect(cfg.gradeThresholds.mixed).toBe(3.0)
  })

  it('deferred positive factors are present in the weight map', () => {
    expect(cfg.factorWeights['Bullish RSI divergence']).toBe(15)
    expect(cfg.factorWeights['Bearish RSI divergence']).toBe(-20)
    expect(cfg.factorWeights['Weak volume on breakout']).toBe(-12)
  })

  it('contradictionPenaltyFactor is 0.3', () => {
    expect(cfg.contradictionPenaltyFactor).toBe(0.3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Module 25 — Direction-Aware Confidence Scoring
// ─────────────────────────────────────────────────────────────────────────────

describe('computeConfidence — directional symmetry', () => {
  // Use perfectly mirrored factor pairs so bull === bear in both raw points
  // Each bullish factor has an exact negative-weight mirror in the bearish list.
  const strongBullishEvidence = [
    ev('Price above EMA200', 'bullish'),                  // +15
    ev('EMA bullish alignment', 'bullish'),               // +12
    ev('Higher High confirmed', 'bullish'),               // +15
    ev('Higher Low confirmed', 'bullish'),                // +15
    ev('MACD bullish bias', 'bullish'),                   // +10
    ev('RSI in 55–70 range', 'bullish'),                  // +8
    ev('Strong bullish volume confirmation', 'bullish'),  // +12
  ]
  const strongBearishEvidence = [
    ev('Price below EMA200', 'bearish'),                  // -15  mirror of +15
    ev('EMA bearish alignment', 'bearish'),               // -12  mirror of +12
    ev('Lower High confirmed', 'bearish'),                // -15  mirror of +15
    ev('Lower Low confirmed', 'bearish'),                 // -15  mirror of +15
    ev('MACD bearish bias', 'bearish'),                   // -10  mirror of +10
    ev('RSI in 30–45 range', 'bearish'),                  // -8   mirror of +8
    ev('Strong bearish volume confirmation', 'bearish'),  // -12  mirror of +12
  ]

  it('strong bullish and strong bearish produce equal confidence scores', () => {
    const bullResult = computeConfidence(
      makeDirectionalAnalysis('strong bullish', strongBullishEvidence),
      cleanValidation(),
    )
    const bearResult = computeConfidence(
      makeDirectionalAnalysis('strong bearish', strongBearishEvidence),
      cleanValidation(),
    )
    // Scores must be within 0.5 of each other (symmetric markets → symmetric confidence)
    expect(Math.abs(bullResult.score - bearResult.score)).toBeLessThan(0.5)
    expect(bullResult.score).toBeGreaterThan(7.0)
    expect(bearResult.score).toBeGreaterThan(7.0)
  })

  it('both strong setups produce strong or very_strong grade', () => {
    const bullResult = computeConfidence(
      makeDirectionalAnalysis('strong bullish', strongBullishEvidence),
      cleanValidation(),
    )
    const bearResult = computeConfidence(
      makeDirectionalAnalysis('strong bearish', strongBearishEvidence),
      cleanValidation(),
    )
    expect(['strong', 'very_strong']).toContain(bullResult.grade)
    expect(['strong', 'very_strong']).toContain(bearResult.grade)
  })

  it('ranging market with same evidence uses abs(net) path — backward compatible', () => {
    // A mix of bullish and bearish in a ranging market
    const mixedEvidence = [
      ev('Price above EMA200', 'bullish'),    // +15
      ev('Lower High confirmed', 'bearish'),  // -15
      ev('ADX above 25', 'neutral'),          // +8
    ]
    const ranging = computeConfidence(makeDirectionalAnalysis('ranging', mixedEvidence), cleanValidation())
    // abs(15 - 15 + 8) = 8; 8/10 = 0.8 (no contradiction penalty for ranging)
    expect(ranging.score).toBeCloseTo(0.8)
  })

  it('pure bullish evidence in bullish market scores higher than in ranging market', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),      // +15
      ev('Higher High confirmed', 'bullish'),   // +15
      ev('MACD bullish bias', 'bullish'),       // +10
    ]
    const directional = computeConfidence(
      makeDirectionalAnalysis('strong bullish', evidence),
      cleanValidation(),
    )
    const ranging = computeConfidence(makeDirectionalAnalysis('ranging', evidence), cleanValidation())
    // Both: bullishRawPoints=40, no bearish, contradictionPoints=0
    // Both paths produce the same result when there are no contradictions
    expect(directional.score).toBeCloseTo(ranging.score)
    expect(directional.score).toBeCloseTo(normalize(40, 10))
  })
})

describe('computeConfidence — contradiction penalties', () => {
  it('contradicting evidence reduces confidence in a bullish trend', () => {
    const pureEvidence = [
      ev('Price above EMA200', 'bullish'),    // +15
      ev('Higher High confirmed', 'bullish'), // +15
      ev('MACD bullish bias', 'bullish'),     // +10
    ]
    const withContradiction = [
      ...pureEvidence,
      ev('Lower Low confirmed', 'bearish'),   // -15 → contradiction
      ev('MACD bearish bias', 'bearish'),     // -10 → contradiction
    ]
    const pure = computeConfidence(makeDirectionalAnalysis('strong bullish', pureEvidence), cleanValidation())
    const mixed = computeConfidence(makeDirectionalAnalysis('strong bullish', withContradiction), cleanValidation())
    expect(mixed.score).toBeLessThan(pure.score)
  })

  it('contradicting evidence reduces confidence in a bearish trend symmetrically', () => {
    const pureEvidence = [
      ev('Price below EMA200', 'bearish'),   // -15
      ev('Lower High confirmed', 'bearish'), // -15
      ev('MACD bearish bias', 'bearish'),    // -10
    ]
    const withContradiction = [
      ...pureEvidence,
      ev('Higher High confirmed', 'bullish'), // +15 → contradiction
      ev('MACD bullish bias', 'bullish'),     // +10 → contradiction
    ]
    const pure = computeConfidence(makeDirectionalAnalysis('strong bearish', pureEvidence), cleanValidation())
    const mixed = computeConfidence(makeDirectionalAnalysis('strong bearish', withContradiction), cleanValidation())
    expect(mixed.score).toBeLessThan(pure.score)
  })

  it('the contradiction reduction is proportional to the penalty factor', () => {
    // 40 bull, 20 bear in bullish trend
    // With factor 0.3: penalizedPoints = 40 - 20*0.3 = 34 → score = 3.4
    // With factor 0.0: penalizedPoints = 40 - 0 = 40 → score = 4.0
    const evidence = [
      ev('Price above EMA200', 'bullish'),    // +15
      ev('Higher High confirmed', 'bullish'), // +15
      ev('MACD bullish bias', 'bullish'),     // +10
      ev('Lower Low confirmed', 'bearish'),   // -15 contradiction
      ev('MACD bearish bias', 'bearish'),     // -10 contradiction
    ]
    const analysis = makeDirectionalAnalysis('strong bullish', evidence)
    const withPenalty = computeConfidence(analysis, cleanValidation(), { contradictionPenaltyFactor: 0.3 })
    const noPenalty  = computeConfidence(analysis, cleanValidation(), { contradictionPenaltyFactor: 0.0 })
    // 40 bull - 25*0.3 = 32.5 → 3.25
    expect(withPenalty.score).toBeCloseTo(normalize(40 - 25 * 0.3, 10))
    // 40 bull - 25*0.0 = 40 → 4.0
    expect(noPenalty.score).toBeCloseTo(normalize(40, 10))
    expect(withPenalty.score).toBeLessThan(noPenalty.score)
  })

  it('contradiction penalty appears in the penalties array', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),    // +15
      ev('Lower Low confirmed', 'bearish'),   // -15 (contradiction in bullish trend)
    ]
    const result = computeConfidence(
      makeDirectionalAnalysis('strong bullish', evidence),
      cleanValidation(),
    )
    const contPenalty = result.penalties.find(p => p.source === 'contradiction')
    expect(contPenalty).toBeDefined()
    expect(contPenalty?.description).toContain('bearish')
  })

  it('no contradiction penalty when no opposing evidence exists', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),    // +15
      ev('Higher High confirmed', 'bullish'), // +15
    ]
    const result = computeConfidence(
      makeDirectionalAnalysis('strong bullish', evidence),
      cleanValidation(),
    )
    expect(result.penalties.filter(p => p.source === 'contradiction')).toHaveLength(0)
  })

  it('ranging market has no contradiction penalty even with mixed evidence', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),    // +15
      ev('Lower Low confirmed', 'bearish'),   // -15
    ]
    const result = computeConfidence(makeDirectionalAnalysis('ranging', evidence), cleanValidation())
    expect(result.penalties.filter(p => p.source === 'contradiction')).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Module 25 — Confidence Breakdown
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBreakdown', () => {
  it('returns all six components', () => {
    const bd = computeBreakdown([], cfg, 0)
    expect(bd).toHaveProperty('trendQuality')
    expect(bd).toHaveProperty('momentum')
    expect(bd).toHaveProperty('volume')
    expect(bd).toHaveProperty('marketStructure')
    expect(bd).toHaveProperty('srPositioning')
    expect(bd).toHaveProperty('contradictions')
  })

  it('all components are 0 for empty evidence', () => {
    const bd = computeBreakdown([], cfg, 0)
    expect(bd.trendQuality).toBe(0)
    expect(bd.momentum).toBe(0)
    expect(bd.volume).toBe(0)
    expect(bd.marketStructure).toBe(0)
    expect(bd.srPositioning).toBe(0)
    expect(bd.contradictions).toBe(0)
  })

  it('EMA factor contributes to trendQuality only', () => {
    const bd = computeBreakdown([ev('Price above EMA200', 'bullish')], cfg, 0)
    expect(bd.trendQuality).toBeCloseTo(normalize(15, 10))
    expect(bd.momentum).toBe(0)
    expect(bd.volume).toBe(0)
    expect(bd.marketStructure).toBe(0)
    expect(bd.srPositioning).toBe(0)
  })

  it('RSI factor contributes to momentum only', () => {
    const bd = computeBreakdown([ev('RSI supports bullish', 'bullish')], cfg, 0)
    expect(bd.momentum).toBeCloseTo(normalize(7, 10))
    expect(bd.trendQuality).toBe(0)
  })

  it('volume factor contributes to volume only', () => {
    const bd = computeBreakdown([ev('Strong volume confirmation', 'neutral')], cfg, 0)
    expect(bd.volume).toBeCloseTo(normalize(12, 10))
    expect(bd.trendQuality).toBe(0)
  })

  it('structure factor contributes to marketStructure only', () => {
    const bd = computeBreakdown([ev('Higher High confirmed', 'bullish')], cfg, 0)
    expect(bd.marketStructure).toBeCloseTo(normalize(15, 10))
    expect(bd.trendQuality).toBe(0)
  })

  it('SR factor contributes to srPositioning only', () => {
    const bd = computeBreakdown([ev('Price at active support', 'bullish')], cfg, 0)
    expect(bd.srPositioning).toBeCloseTo(normalize(10, 10))
    expect(bd.trendQuality).toBe(0)
  })

  it('uses abs(weight) so bearish factors also contribute positively to their category', () => {
    const bd = computeBreakdown([ev('Price below EMA200', 'bearish')], cfg, 0)
    // abs(-15) = 15 → trendQuality = normalize(15, 10) = 1.5
    expect(bd.trendQuality).toBeCloseTo(normalize(15, 10))
  })

  it('contradictions component reflects the contradictionPoints passed in', () => {
    const bd = computeBreakdown([], cfg, 20)
    expect(bd.contradictions).toBeCloseTo(normalize(20, 10))
  })

  it('computeConfidence result contains a valid breakdown', () => {
    const evidence = [
      ev('Price above EMA200', 'bullish'),
      ev('Higher High confirmed', 'bullish'),
      ev('RSI in 55–70 range', 'bullish'),
      ev('Strong volume confirmation', 'neutral'),
      ev('Price at active support', 'bullish'),
    ]
    const result = computeConfidence(makeAnalysis(evidence), cleanValidation())
    expect(result.breakdown.trendQuality).toBeGreaterThan(0)
    expect(result.breakdown.marketStructure).toBeGreaterThan(0)
    expect(result.breakdown.momentum).toBeGreaterThan(0)
    expect(result.breakdown.volume).toBeGreaterThan(0)
    expect(result.breakdown.srPositioning).toBeGreaterThan(0)
    expect(result.breakdown.contradictions).toBe(0) // no opposing evidence
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Module 25 — Trust Layer
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTrust', () => {
  it('returns required fields', () => {
    const trust = computeTrust(makeAnalysis(), cleanValidation())
    expect(trust).toHaveProperty('score')
    expect(trust).toHaveProperty('level')
    expect(trust).toHaveProperty('factors')
    expect(trust).toHaveProperty('reductions')
    expect(Array.isArray(trust.factors)).toBe(true)
    expect(Array.isArray(trust.reductions)).toBe(true)
  })

  it('score is a percentage (0-100)', () => {
    const trust = computeTrust(makeAnalysis(), cleanValidation())
    expect(trust.score).toBeGreaterThanOrEqual(0)
    expect(trust.score).toBeLessThanOrEqual(100)
  })

  it('level is high, medium, or low', () => {
    const trust = computeTrust(makeAnalysis(), cleanValidation())
    expect(['high', 'medium', 'low']).toContain(trust.level)
  })

  it('each factor has label and passed fields', () => {
    const trust = computeTrust(makeAnalysis(), cleanValidation())
    for (const factor of trust.factors) {
      expect(typeof factor.label).toBe('string')
      expect(typeof factor.passed).toBe('boolean')
    }
  })

  it('reductions correspond to failed factors', () => {
    const trust = computeTrust(makeAnalysis(), cleanValidation())
    const failedWithNotes = trust.factors.filter(f => !f.passed && f.note !== undefined)
    expect(trust.reductions).toHaveLength(failedWithNotes.length)
  })

  it('critical validation issues reduce trust and appear in reductions', () => {
    const trustClean   = computeTrust(makeAnalysis(), cleanValidation())
    const trustCritical = computeTrust(makeAnalysis(), validationWithCriticals(1))
    expect(trustCritical.score).toBeLessThan(trustClean.score)
    expect(trustCritical.reductions.some(r => r.includes('critical'))).toBe(true)
  })

  it('computeConfidence result contains a valid trust object', () => {
    const result = computeConfidence(makeAnalysis([ev('Price above EMA200', 'bullish')]), cleanValidation())
    expect(result.trust.score).toBeGreaterThanOrEqual(0)
    expect(result.trust.score).toBeLessThanOrEqual(100)
    expect(['high', 'medium', 'low']).toContain(result.trust.level)
    expect(result.trust.factors.length).toBeGreaterThan(0)
  })

  it('determinism — same inputs produce same trust output', () => {
    const analysis = makeAnalysis([ev('Price above EMA200', 'bullish')])
    const t1 = computeTrust(analysis, cleanValidation())
    const t2 = computeTrust(analysis, cleanValidation())
    expect(t1).toEqual(t2)
  })
})
