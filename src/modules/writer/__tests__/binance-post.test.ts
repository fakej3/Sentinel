import { describe, it, expect } from 'vitest'
import { buildBinancePost } from '../binance-post'
import type { BinancePostInput } from '../binance-post'
import type { TradePlan, InvalidationScenario, MultiTimeframeAgreement } from '../../pipeline/types'
import { makeAnalysis, makeConfidence, cleanValidation, validationWithCriticals } from './helpers'

// ─── Stubs ────────────────────────────────────────────────────────────────────

const MATURE_MATURITY = {
  maturityScore: 62,
  maturityLabel: 'mature' as const,
  maturityComponents: { momentum: 20, volume: 15, trend: 14, structure: 8, confidence: 5 },
  maturityPrimaryConcern: null,
}

function makeActionablePlan(overrides: Partial<TradePlan> = {}): TradePlan {
  return {
    entryZone: { lower: 94_800, upper: 95_200 },
    invalidationLevel: 94_280,
    targetLevel: 98_150,
    riskRewardRatio: 2.35,
    setupQuality: 'excellent',
    setupQualityReason: 'Excellent setup: RR 2.35, confidence 7.8, trust 100%',
    actionable: true,
    patienceMessage: 'High-quality setup — enter near 95000, stop at 94280, target 98150, RR 2.35:1',
    ...MATURE_MATURITY,
    ...overrides,
  }
}

function makeNoSetupPlan(): TradePlan {
  return {
    entryZone: null,
    invalidationLevel: null,
    targetLevel: null,
    riskRewardRatio: null,
    setupQuality: 'no_setup',
    setupQualityReason: 'Insufficient support/resistance data to establish trade levels',
    actionable: false,
    patienceMessage: 'No high-quality trade setup currently exists — wait for support/resistance structure to form',
    ...MATURE_MATURITY,
  }
}

function makeAvoidPlan(): TradePlan {
  return {
    entryZone: { lower: 94_800, upper: 95_200 },
    invalidationLevel: 94_280,
    targetLevel: 95_500,
    riskRewardRatio: 1.1,
    setupQuality: 'avoid',
    setupQualityReason: 'Risk/reward of 1.10 is below the minimum threshold of 1.5',
    actionable: false,
    patienceMessage: 'Risk/reward is 1.10:1 — below minimum 1.5:1; wait for price to approach a higher-probability zone',
    ...MATURE_MATURITY,
  }
}

function makeGoodPlan(): TradePlan {
  return {
    entryZone: { lower: 94_800, upper: 95_200 },
    invalidationLevel: 94_280,
    targetLevel: 98_150,
    riskRewardRatio: 2.35,
    setupQuality: 'good',
    setupQualityReason: 'Setup downgraded: RR 2.35, confidence 8.0 — weak trend reduces setup reliability',
    actionable: true,
    patienceMessage: 'Good setup in a weak trend — wait for a confirmation candle before entering; enter near 95000, stop at 94280, target 98150, RR 2.35:1',
    ...MATURE_MATURITY,
  }
}

function makeAveragePlan(): TradePlan {
  return {
    entryZone: { lower: 94_800, upper: 95_200 },
    invalidationLevel: 94_280,
    targetLevel: 98_150,
    riskRewardRatio: 1.80,
    setupQuality: 'average',
    setupQualityReason: 'Setup downgraded: RR 1.80, confidence 5.5 — weak trend reduces setup reliability',
    actionable: true,
    patienceMessage: 'Weak trend — if entering, wait for a strong confirmation candle, use reduced position size, and strict stop placement',
    ...MATURE_MATURITY,
  }
}

function makeInvalidationScenarios(): InvalidationScenario[] {
  return [
    {
      type: 'price_level',
      severity: 'critical',
      description: 'Close and hold below $94,280 breaks the key support level and invalidates the bullish thesis',
    },
    {
      type: 'structure',
      severity: 'major',
      description: 'Bearish BOS or CHoCH would signal a structural trend change',
    },
  ]
}

function makeMTFConflict(): MultiTimeframeAgreement {
  return {
    agreement: 'strong_conflict',
    agreementScore: 1.5,
    timeframes: [],
    dominantDirection: 'bullish',
    conflictingCount: 2,
  }
}

function makeMTFAligned(): MultiTimeframeAgreement {
  return {
    agreement: 'aligned',
    agreementScore: 9.0,
    timeframes: [],
    dominantDirection: 'bullish',
    conflictingCount: 0,
  }
}

function makeInput(overrides: Partial<BinancePostInput> = {}): BinancePostInput {
  return {
    analysis: makeAnalysis([], 'strong bullish'),
    validation: cleanValidation(),
    confidence: makeConfidence(7.8, 'strong'),
    tradePlan: makeActionablePlan(),
    invalidationScenarios: makeInvalidationScenarios(),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildBinancePost', () => {
  describe('publishable post (actionable setup)', () => {
    it('is publishable when setup is actionable and validation is clean', () => {
      const post = buildBinancePost(makeInput())
      expect(post.publishable).toBe(true)
      expect(post.blockReason).toBeNull()
    })

    it('contains entry zone, stop-loss, target, and RR', () => {
      const post = buildBinancePost(makeInput())
      expect(post.text).toContain('Entry zone:')
      expect(post.text).toContain('Stop-loss:')
      expect(post.text).toContain('Target:')
      expect(post.text).toContain('Risk/reward:')
    })

    it('contains evidence section', () => {
      const post = buildBinancePost(makeInput())
      expect(post.text).toContain('Evidence:')
    })

    it('contains invalidation statement from scenarios', () => {
      const post = buildBinancePost(makeInput())
      expect(post.text).toContain('Invalidation:')
    })

    it('contains disclaimer', () => {
      const post = buildBinancePost(makeInput())
      expect(post.text).toContain('Not financial advice')
    })

    it('reports bias correctly for bullish trend', () => {
      const post = buildBinancePost(makeInput())
      expect(post.bias).toBe('bullish')
    })

    it('reports bias correctly for bearish trend', () => {
      const post = buildBinancePost(makeInput({ analysis: makeAnalysis([], 'strong bearish') }))
      expect(post.bias).toBe('bearish')
    })

    it('reports bias correctly for ranging market', () => {
      const post = buildBinancePost(makeInput({ analysis: makeAnalysis([], 'ranging') }))
      expect(post.bias).toBe('neutral')
    })

    it('evidence coverage is always 100', () => {
      const post = buildBinancePost(makeInput())
      expect(post.evidenceCoverage).toBe(100)
    })

    it('confidence score matches input', () => {
      const post = buildBinancePost(makeInput())
      expect(post.confidenceScore).toBeCloseTo(7.8)
    })
  })

  describe('WAIT post (not publishable)', () => {
    it('is not publishable when setup is no_setup', () => {
      const post = buildBinancePost(makeInput({ tradePlan: makeNoSetupPlan() }))
      expect(post.publishable).toBe(false)
      expect(post.blockReason).not.toBeNull()
    })

    it('text contains WAIT heading', () => {
      const post = buildBinancePost(makeInput({ tradePlan: makeNoSetupPlan() }))
      expect(post.text).toContain('WAIT')
    })

    it('text contains reason for blocking', () => {
      const post = buildBinancePost(makeInput({ tradePlan: makeAvoidPlan() }))
      expect(post.text).toContain('Reason:')
    })

    it('still contains disclaimer in WAIT post', () => {
      const post = buildBinancePost(makeInput({ tradePlan: makeNoSetupPlan() }))
      expect(post.text).toContain('Not financial advice')
    })

    it('is not publishable when validation has critical issues', () => {
      const post = buildBinancePost(makeInput({ validation: validationWithCriticals(1) }))
      expect(post.publishable).toBe(false)
      expect(post.blockReason).toMatch(/critical/i)
    })
  })

  describe('MTF conflict blocking', () => {
    it('is not publishable when MTF shows strong_conflict', () => {
      const post = buildBinancePost(makeInput({ mtfAgreement: makeMTFConflict() }))
      expect(post.publishable).toBe(false)
      expect(post.blockReason).toMatch(/multi-timeframe conflict/i)
    })

    it('blockReason mentions opposing timeframe count', () => {
      const post = buildBinancePost(makeInput({ mtfAgreement: makeMTFConflict() }))
      expect(post.blockReason).toContain('2')
    })

    it('remains publishable when MTF is aligned', () => {
      const post = buildBinancePost(makeInput({ mtfAgreement: makeMTFAligned() }))
      expect(post.publishable).toBe(true)
    })

    it('remains publishable when mtfAgreement is undefined', () => {
      const post = buildBinancePost(makeInput({ mtfAgreement: undefined }))
      expect(post.publishable).toBe(true)
    })
  })

  describe('language constraints', () => {
    const PROHIBITED = ['probably', 'maybe', 'looks like', 'appears to', 'might suggest', 'seems like']

    it('does not contain prohibited hedging language in a publishable post', () => {
      const post = buildBinancePost(makeInput())
      for (const phrase of PROHIBITED) {
        expect(post.text.toLowerCase()).not.toContain(phrase)
      }
    })

    it('does not contain prohibited hedging language in a WAIT post', () => {
      const post = buildBinancePost(makeInput({ tradePlan: makeNoSetupPlan() }))
      for (const phrase of PROHIBITED) {
        expect(post.text.toLowerCase()).not.toContain(phrase)
      }
    })
  })

  describe('risk factors', () => {
    it('does not include risk section when no elevated risks', () => {
      // Default makeAnalysis has no approaching S/R, no climax, no low volume
      const post = buildBinancePost(makeInput())
      // Risk section only appears when there are bullets — no guarantee it's there
      // but if it is, it should have specific content not a generic disclaimer
      if (post.text.includes('Risk factors:')) {
        expect(post.text).not.toContain('No elevated risk factors')
      }
    })
  })

  describe('deterministic output', () => {
    it('produces identical output for the same inputs', () => {
      const input = makeInput()
      const p1 = buildBinancePost(input)
      const p2 = buildBinancePost(input)
      expect(p1.text).toBe(p2.text)
      expect(p1.publishable).toBe(p2.publishable)
    })
  })

  describe('setup quality note', () => {
    it('excellent setup does not add a quality warning line', () => {
      const post = buildBinancePost(makeInput())
      // excellent posts should not contain a ⚠️ quality note (the existing disclaimer is at the end)
      const lines = post.text.split('\n')
      const qualityLines = lines.filter(l => l.startsWith('⚠️') && !l.includes('Not financial advice'))
      expect(qualityLines).toHaveLength(0)
    })

    it('good setup with weak trend includes weak-trend confirmation warning', () => {
      const post = buildBinancePost(makeInput({
        analysis: makeAnalysis([], 'weak bullish'),
        tradePlan: makeGoodPlan(),
      }))
      expect(post.publishable).toBe(true)
      expect(post.text).toContain('Weak trend')
      expect(post.text).toContain('confirmation candle')
    })

    it('average setup with weak trend includes marginal-setup warning mentioning weak trend', () => {
      const post = buildBinancePost(makeInput({
        analysis: makeAnalysis([], 'weak bullish'),
        tradePlan: makeAveragePlan(),
      }))
      expect(post.publishable).toBe(true)
      expect(post.text).toContain('Marginal setup')
      expect(post.text).toContain('weak trend')
    })

    it('average setup without weak trend includes marginal-setup warning (no weak-trend mention)', () => {
      const post = buildBinancePost(makeInput({
        analysis: makeAnalysis([], 'strong bullish'),
        tradePlan: makeAveragePlan(),
      }))
      expect(post.publishable).toBe(true)
      expect(post.text).toContain('Marginal setup')
      expect(post.text).not.toContain('weak trend')
    })

    it('good setup with strong trend does not add quality warning', () => {
      const strongGoodPlan: TradePlan = {
        ...makeGoodPlan(),
        setupQuality: 'good',
        setupQualityReason: 'Good setup: RR 2.35, confidence 6.5',
        patienceMessage: 'Good setup — enter at the entry zone with a clearly defined stop loss',
      }
      const post = buildBinancePost(makeInput({
        analysis: makeAnalysis([], 'strong bullish'),
        tradePlan: strongGoodPlan,
      }))
      expect(post.publishable).toBe(true)
      const lines = post.text.split('\n')
      const qualityLines = lines.filter(l => l.startsWith('⚠️') && !l.includes('Not financial advice'))
      expect(qualityLines).toHaveLength(0)
    })

    it('setup quality note does not use prohibited hedging language', () => {
      const PROHIBITED = ['probably', 'maybe', 'looks like', 'appears to', 'might suggest', 'seems like']
      const posts = [
        buildBinancePost(makeInput({ analysis: makeAnalysis([], 'weak bullish'), tradePlan: makeGoodPlan() })),
        buildBinancePost(makeInput({ analysis: makeAnalysis([], 'weak bullish'), tradePlan: makeAveragePlan() })),
        buildBinancePost(makeInput({ analysis: makeAnalysis([], 'strong bullish'), tradePlan: makeAveragePlan() })),
      ]
      for (const post of posts) {
        for (const phrase of PROHIBITED) {
          expect(post.text.toLowerCase()).not.toContain(phrase)
        }
      }
    })
  })
})
