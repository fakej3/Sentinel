import type { Candle, Timeframe } from '../../binance/types'
import type { BenchmarkDataset, ExpectedOutput } from '../types'
import type { PipelineResult } from '../../pipeline/types'

// ── Candle factory ─────────────────────────────────────────────────────────

export function makeCandles(count: number, basePrice = 50_000): Candle[] {
  const candles: Candle[] = []
  let price = basePrice
  for (let i = 0; i < count; i++) {
    const move = Math.sin(i * 0.2) * (basePrice * 0.002)
    price = Math.max(basePrice * 0.5, price + move)
    const range = Math.abs(Math.cos(i * 0.3)) * (basePrice * 0.001) + basePrice * 0.0005
    const high = price + range
    const low = Math.max(0.01, price - range)
    const volume = 1000 + Math.abs(Math.sin(i * 0.15)) * 500
    const takerBuy = volume * (0.5 + Math.sin(i * 0.1) * 0.1)
    candles.push({
      openTime: i * 3_600_000,
      closeTime: i * 3_600_000 + 3_599_999,
      open: Math.max(0.01, price - move / 2),
      high,
      low,
      close: price,
      volume,
      quoteVolume: price * volume,
      trades: 100,
      takerBuyVolume: takerBuy,
      takerSellVolume: volume - takerBuy,
    })
  }
  return candles
}

// ── Dataset factory ────────────────────────────────────────────────────────

export function makeDataset(
  count: number,
  opts: { symbol?: string; interval?: Timeframe; fetchedAt?: number } = {},
): BenchmarkDataset {
  return {
    symbol: opts.symbol ?? 'BTCUSDT',
    interval: opts.interval ?? '1h',
    candles: makeCandles(count),
    metadata: { fetchedAt: opts.fetchedAt ?? 1_000_000_000, description: 'test dataset' },
  }
}

// ── Minimal PipelineResult mock for comparison unit tests ──────────────────

/**
 * Returns a plain object that satisfies PipelineResult's shape
 * well enough for compareOutputs (which only does property lookups).
 */
export function makeMockResult(shape: Record<string, unknown>): PipelineResult {
  return shape as unknown as PipelineResult
}

export function standardMockResult(): PipelineResult {
  return makeMockResult({
    analysis: {
      analysedAt: 999,
      fullTrend: { trend: 'strong bullish' },
      indicatorSummary: { rsi: { classification: 'neutral' } },
      emaContext: { emaAlignment: 'bullish_stack' },
      marketStructure: { trend: 'bullish', strength: 'strong' },
      evidence: [{ factor: 'Price above EMA200', impact: 'high', direction: 'bullish' }],
    },
    confidence: { grade: 'moderate', score: 5.2, bullishConfidence: 5.2, bearishConfidence: 0 },
    validation: { passed: true, clean: true, criticalCount: 0, warningCount: 0, infoCount: 0, issues: [], summary: 'ok' },
    generatedAnalysis: {
      headline: 'BTC holds key support',
      fullReport: 'Full report text here.',
      metadata: { confidenceScore: 5.2, confidenceGrade: 'moderate' },
    },
    metadata: {
      symbol: 'BTCUSDT',
      interval: '1h',
      candleCount: 100,
      timestamp: 1_000_000_000,
      executionTime: 42,
      version: '0.11.0',
      timings: {
        fetch: 5, indicators: 3, marketStructure: 2,
        supportResistance: 1, volume: 1, analysis: 5,
        validation: 1, confidence: 1, writer: 1, total: 20,
      },
    },
  })
}

// ── Expected output factories ──────────────────────────────────────────────

export function expectedFromResult(result: PipelineResult): ExpectedOutput {
  return {
    'analysis.fullTrend.trend': (result.analysis as unknown as Record<string, unknown> & { fullTrend: { trend: string } }).fullTrend.trend,
    'confidence.grade': result.confidence.grade,
    'confidence.score': result.confidence.score,
    'validation.passed': result.validation.passed,
    'validation.criticalCount': result.validation.criticalCount,
    'generatedAnalysis.headline': result.generatedAnalysis.headline,
    'metadata.symbol': result.metadata.symbol,
    'metadata.interval': result.metadata.interval,
    'metadata.candleCount': result.metadata.candleCount,
    'metadata.version': result.metadata.version,
  }
}
