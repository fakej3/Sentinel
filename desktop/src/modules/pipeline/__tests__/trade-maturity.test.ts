/**
 * Phase 16 — Trade Maturity Score unit tests.
 *
 * computeTradeMaturity gates ALL actionable trade setups: a score < 30
 * forces setupQuality to 'poor' regardless of trend, confidence, or RR.
 * It is therefore the most consequential single function between the raw
 * analysis and the final trade recommendation.
 *
 * Tests cover every component and the composite label, without hardcoding
 * numerics beyond what the source code's own tier boundaries imply.
 */
import { describe, it, expect } from 'vitest'
import { computeTradeMaturity } from '../compute/trade-maturity'
import type { MarketAnalysisResult } from '../../analysis/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { Timeframe } from '../../binance/types'

// ─── Minimal stubs ────────────────────────────────────────────────────────────

function makeAnalysis(
  trend: string,
  rsiClass: string,
  macdBias: string,
  relVol: number,
  obvConfirms: boolean,
  volConfirms: boolean,
): MarketAnalysisResult {
  return {
    symbol: 'BTCUSDT', timeframe: '1h' as Timeframe, analysedAt: 0,
    price: { current: 50000, change24hPercent: 1, high24h: 51000, low24h: 49000, atrPercent: 2 },
    fullTrend: {
      trend: trend as MarketAnalysisResult['fullTrend']['trend'],
      bullishConditionsMet: 3, bearishConditionsMet: 0, neutralConditionsMet: 1,
      conditions: {} as never,
    },
    indicatorSummary: {
      rsi: { value: 60, classification: rsiClass as never },
      macd: { histogram: 1, bias: macdBias as never },
      adx: { adx: 28, trendStrength: 'strong' as never, dominantDirection: 'bullish' as never },
      bollinger: { bandwidthPercent: 2, bandwidthState: 'normal' as never, priceRelativeToBands: 'inside' as never },
      stochRsi: { k: 55, d: 50, zone: 'neutral' as never },
    },
    volumeContext: {
      relativeVolume: relVol,
      volumeClassification: 'normal' as never,
      confirmsCurrentMove: volConfirms,
      climaxSignal: 'none' as never,
      accDistState: 'neutral' as never,
      vwap: { available: true, unavailable: null, value: 49500, side: 'above' as never, distancePercent: 1, respectingVWAP: true },
      obvDirection: 'bullish' as never,
      obvConfirmingPrice: obvConfirms,
      overallStrength: 6,
    },
    emaContext: { priceVsEMA20: 'above', priceVsEMA50: 'above', priceVsEMA100: 'above', priceVsEMA200: 'above',
      emaAlignment: 'bullish_stack', confluenceZones: [] } as never,
    srContext: {} as never,
    evidence: [],
    indicators: {} as never,
    marketStructure: {} as never,
    supportResistance: {} as never,
    volumeAnalysis: {} as never,
  }
}

function makeMarketStructure(
  chochDetected: boolean,
  bosDetected: boolean,
  strength: 'strong' | 'moderate' | 'weak',
): Partial<MarketStructureResult> {
  return {
    choch: { detected: chochDetected, events: [], last: null },
    bos:   { detected: bosDetected,   events: [], last: null },
    strength,
  } as unknown as Partial<MarketStructureResult>
}

function makeConfidence(score: number): ConfidenceResult {
  return { score } as unknown as ConfidenceResult
}

// ─── Component: Momentum ──────────────────────────────────────────────────────

describe('computeTradeMaturity — momentum component', () => {
  it('bullish direction: MACD bullish + RSI healthy_bullish → max momentum (25)', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.momentum).toBe(25)
  })

  it('bullish direction: MACD bullish only → 15', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'bullish', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.momentum).toBe(15)
  })

  it('bullish direction: RSI oversold (reversal-entry-friendly for longs) → 10', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'oversold', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.momentum).toBe(10)
  })

  it('bearish direction: MACD bearish + RSI weak_bearish → max momentum (25)', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bearish', 'weak_bearish', 'bearish', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.momentum).toBe(25)
  })

  it('bearish direction: RSI overbought (reversal-entry-friendly for shorts) → 10', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bearish', 'overbought', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.momentum).toBe(10)
  })

  it('ranging direction: neither RSI nor MACD favourable → momentum = 0', () => {
    const result = computeTradeMaturity(
      makeAnalysis('ranging', 'healthy_bullish', 'bullish', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    // "ranging" → dir = 'neutral' → rsiFav = false, macdFav = false
    expect(result.components.momentum).toBe(0)
  })

  it('no MACD or RSI alignment → momentum = 0', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'overbought', 'bearish', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.momentum).toBe(0)
  })
})

// ─── Component: Volume ────────────────────────────────────────────────────────

describe('computeTradeMaturity — volume component', () => {
  it('OBV confirms + high relVol (≥1.3) + move confirms → max volume (20)', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.5, true, true),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.volume).toBe(20)
  })

  it('OBV confirms + normal relVol + move confirms → 15', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, true, true),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.volume).toBe(15)
  })

  it('OBV confirms only → 10', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, true, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.volume).toBe(10)
  })

  it('move confirms only (no OBV) → 8', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, true),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.volume).toBe(8)
  })

  it('low relVol (< 0.7) deducts 5 from base', () => {
    // OBV confirms + normal relVol = 10, then -5 for low relVol
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 0.5, true, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.volume).toBe(5)   // 10 - 5
  })

  it('no OBV, no confirmation, low relVol → 0 (clamped)', () => {
    const result = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 0.5, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(result.components.volume).toBe(0)   // 0 - 5 = -5, clamped to 0
  })
})

// ─── Component: Trend ─────────────────────────────────────────────────────────

describe('computeTradeMaturity — trend component', () => {
  it('strong trend → 20', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.trend).toBe(20)
  })

  it('moderate trend → 14', () => {
    const r = computeTradeMaturity(
      makeAnalysis('moderate bearish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.trend).toBe(14)
  })

  it('weak trend → 5', () => {
    const r = computeTradeMaturity(
      makeAnalysis('weak bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.trend).toBe(5)
  })

  it('ranging → 0', () => {
    const r = computeTradeMaturity(
      makeAnalysis('ranging', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.trend).toBe(0)
  })
})

// ─── Component: Structure ─────────────────────────────────────────────────────

describe('computeTradeMaturity — structure component', () => {
  it('CHoCH detected + strong market structure → 20', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(true, false, 'strong') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.structure).toBe(20)
  })

  it('CHoCH detected + moderate structure → 16', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(true, false, 'moderate') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.structure).toBe(16)
  })

  it('BOS detected + strong structure (no CHoCH) → 14', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, true, 'strong') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.structure).toBe(14)
  })

  it('BOS detected + moderate structure → 10', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, true, 'moderate') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.structure).toBe(10)
  })

  it('no CHoCH, no BOS, weak structure → 0', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(5),
    )
    expect(r.components.structure).toBe(0)
  })
})

// ─── Component: Confidence ────────────────────────────────────────────────────

describe('computeTradeMaturity — confidence component', () => {
  it('score ≥ 8.5 → 15', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(9),
    )
    expect(r.components.confidence).toBe(15)
  })

  it('score ≥ 7.0 (and < 8.5) → 10', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(7.5),
    )
    expect(r.components.confidence).toBe(10)
  })

  it('score ≥ 5.0 (and < 7.0) → 5', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(6),
    )
    expect(r.components.confidence).toBe(5)
  })

  it('score < 5.0 → 0', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(3),
    )
    expect(r.components.confidence).toBe(0)
  })
})

// ─── Composite score and label ────────────────────────────────────────────────

describe('computeTradeMaturity — composite score and label', () => {
  it('score = sum of all five components', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.5, true, true),
      makeMarketStructure(true, false, 'strong') as MarketStructureResult,
      makeConfidence(9),
    )
    const expected = r.components.momentum + r.components.volume + r.components.trend
      + r.components.structure + r.components.confidence
    expect(r.score).toBe(expected)
  })

  it('maximum score with all conditions fully met = 100', () => {
    // momentum=25, volume=20, trend=20, structure=20, confidence=15
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.5, true, true),
      makeMarketStructure(true, false, 'strong') as MarketStructureResult,
      makeConfidence(9),
    )
    expect(r.score).toBe(100)
  })

  it('minimum score with no conditions met = 0', () => {
    const r = computeTradeMaturity(
      makeAnalysis('ranging', 'neutral', 'neutral', 0.5, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    expect(r.score).toBe(0)
  })

  it('score < 30 → label immature', () => {
    const r = computeTradeMaturity(
      makeAnalysis('weak bullish', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    // weak trend=5, no momentum, no volume, no structure, no confidence
    expect(r.score).toBe(5)
    expect(r.label).toBe('immature')
  })

  it('score exactly at the immature/early boundary (30) → early', () => {
    // Construct a score exactly at 30:
    // trend=strong(20), confidence=5.0→5, rest=5 → total=5+20+5=30... needs tuning
    // Let's try: moderate trend=14 + MACD only momentum=15 + conf≥5→5 = 34 → early
    // Or: weak trend=5 + MACD+RSI=25 → 30 → early
    const r = computeTradeMaturity(
      makeAnalysis('weak bullish', 'healthy_bullish', 'bullish', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    // momentum=25 (both), trend=5 (weak), volume=0, structure=0, confidence=0
    expect(r.score).toBe(30)
    expect(r.label).toBe('early')
  })

  it('score in [30, 44] → early', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'neutral', 'bullish', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    // momentum=15(MACD only), trend=20(strong), others=0 → 35
    expect(r.score).toBe(35)
    expect(r.label).toBe('early')
  })

  it('score in [45, 59] → developing', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.0, true, true),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    // momentum=25, trend=20, volume=15(OBV+conf+normal), structure=0, conf=0 → 60 → mature
    // Let's use: momentum=25, trend=20, volume=8(confirm only) = 53 → developing
    const r2 = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.0, false, true),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    expect(r2.score).toBe(53)
    expect(r2.label).toBe('developing')
  })

  it('score in [60, 74] → mature', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.0, true, true),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    // momentum=25, trend=20, volume=15, structure=0, conf=0 → 60
    expect(r.score).toBe(60)
    expect(r.label).toBe('mature')
  })

  it('score ≥ 75 → peak', () => {
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.5, true, true),
      makeMarketStructure(true, false, 'strong') as MarketStructureResult,
      makeConfidence(5),
    )
    // momentum=25, trend=20, volume=20, structure=20, conf=5 → 90
    expect(r.score).toBe(90)
    expect(r.label).toBe('peak')
  })
})

// ─── Primary concern ──────────────────────────────────────────────────────────

describe('computeTradeMaturity — primaryConcern', () => {
  it('when the score is very low, primaryConcern names the largest gap', () => {
    const r = computeTradeMaturity(
      makeAnalysis('ranging', 'neutral', 'neutral', 1.0, false, false),
      makeMarketStructure(false, false, 'weak') as MarketStructureResult,
      makeConfidence(2),
    )
    // All components 0 — momentum gap=25, volume gap=20, trend gap=20, structure gap=20, conf gap=15
    // Momentum gap is largest → primaryConcern describes momentum
    expect(r.primaryConcern).not.toBeNull()
    expect(r.primaryConcern).toMatch(/momentum/)
  })

  it('when the gap is small (<8 in all components), primaryConcern is null', () => {
    // All maxed out: momentum=25, volume=20, trend=20, structure=20, confidence=15 → score=100
    const r = computeTradeMaturity(
      makeAnalysis('strong bullish', 'healthy_bullish', 'bullish', 1.5, true, true),
      makeMarketStructure(true, false, 'strong') as MarketStructureResult,
      makeConfidence(9),
    )
    expect(r.score).toBe(100)
    expect(r.primaryConcern).toBeNull()
  })
})
