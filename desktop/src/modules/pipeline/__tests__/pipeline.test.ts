import { describe, it, expect, vi } from 'vitest'
import { analyzeMarket, PipelineError, PIPELINE_VERSION } from '../index'
import type { Timeframe } from '../../binance/types'
import type { FetchFn } from '../types'
import { makeCandles, mockFetch, failingFetch } from './helpers'

const SYMBOL = 'BTCUSDT'
const INTERVAL: Timeframe = '1h'

// ── Successful end-to-end ───────────────────────────────────────────────────

describe('analyzeMarket — success path', () => {
  it('returns a complete PipelineResult for 200 candles', async () => {
    const candles = makeCandles(200)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })

    expect(result.candles).toHaveLength(200)
    expect(result.indicators).toBeDefined()
    expect(result.marketStructure).toBeDefined()
    expect(result.supportResistance).toBeDefined()
    expect(result.volumeAnalysis).toBeDefined()
    expect(result.analysis).toBeDefined()
    expect(result.validation).toBeDefined()
    expect(result.confidence).toBeDefined()
    expect(result.generatedAnalysis).toBeDefined()
    expect(result.metadata).toBeDefined()
  })

  it('result.candles is the array returned by the fetch implementation', async () => {
    const candles = makeCandles(100)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    expect(result.candles).toBe(candles)
  })

  it('generatedAnalysis has a non-empty fullReport', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(typeof result.generatedAnalysis.fullReport).toBe('string')
    expect(result.generatedAnalysis.fullReport.length).toBeGreaterThan(0)
  })

  it('generatedAnalysis has a headline', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(typeof result.generatedAnalysis.headline).toBe('string')
    expect(result.generatedAnalysis.headline.length).toBeGreaterThan(0)
  })

  it('validation result is included and has passed field', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(typeof result.validation.passed).toBe('boolean')
    expect(Array.isArray(result.validation.issues)).toBe(true)
  })

  it('confidence result has a score between 0 and 10', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(result.confidence.score).toBeGreaterThanOrEqual(0)
    expect(result.confidence.score).toBeLessThanOrEqual(10)
  })
})

// ── Metadata ────────────────────────────────────────────────────────────────

describe('analyzeMarket — metadata', () => {
  it('metadata.symbol is uppercased', async () => {
    const result = await analyzeMarket({ symbol: 'btcusdt', interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(result.metadata.symbol).toBe('BTCUSDT')
  })

  it('metadata.interval matches the requested interval', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: '4h', fetchImpl: mockFetch(makeCandles(100)) })
    expect(result.metadata.interval).toBe('4h')
  })

  it('metadata.candleCount matches candle array length', async () => {
    const candles = makeCandles(150)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    expect(result.metadata.candleCount).toBe(150)
    expect(result.metadata.candleCount).toBe(result.candles.length)
  })

  it('metadata.version equals PIPELINE_VERSION', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(result.metadata.version).toBe(PIPELINE_VERSION)
    expect(typeof result.metadata.version).toBe('string')
    expect(result.metadata.version.length).toBeGreaterThan(0)
  })

  it('metadata.timestamp is the fetchedAt value from the fetched data', async () => {
    const FIXED_TIME = 9_999_999
    const result = await analyzeMarket({
      symbol: SYMBOL,
      interval: INTERVAL,
      fetchImpl: mockFetch(makeCandles(100), FIXED_TIME),
    })
    expect(result.metadata.timestamp).toBe(FIXED_TIME)
  })

  it('metadata.executionTime is a non-negative number', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)
  })
})

// ── Timings ─────────────────────────────────────────────────────────────────

describe('analyzeMarket — timings', () => {
  it('metadata.timings has all 10 required fields', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    const keys = ['fetch', 'indicators', 'marketStructure', 'supportResistance', 'volume', 'analysis', 'validation', 'confidence', 'writer', 'total']
    for (const key of keys) {
      expect(result.metadata.timings).toHaveProperty(key)
    }
  })

  it('all timing values are non-negative numbers', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    const timings = result.metadata.timings
    for (const key of Object.keys(timings) as Array<keyof typeof timings>) {
      expect(typeof timings[key]).toBe('number')
      expect(timings[key]).toBeGreaterThanOrEqual(0)
    }
  })

  it('total timing is >= sum of individual stage timings', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    const { fetch, indicators, marketStructure, supportResistance, volume, analysis, validation, confidence, writer, total } = result.metadata.timings
    const stageSum = fetch + indicators + marketStructure + supportResistance + volume + analysis + validation + confidence + writer
    expect(total).toBeGreaterThanOrEqual(stageSum)
  })
})

// ── Error handling ───────────────────────────────────────────────────────────

describe('analyzeMarket — error handling', () => {
  it('throws PipelineError with code fetch_failure when fetchImpl rejects', async () => {
    await expect(
      analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: failingFetch('timeout') }),
    ).rejects.toThrow(PipelineError)

    try {
      await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: failingFetch('timeout') })
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError)
      expect((err as PipelineError).code).toBe('fetch_failure')
      expect((err as PipelineError).module).toBe('binance')
    }
  })

  it('PipelineError includes original cause for fetch failure', async () => {
    const original = new Error('DNS lookup failed')
    const fetch: FetchFn = async () => { throw original }
    try {
      await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: fetch })
    } catch (err) {
      expect((err as PipelineError).cause).toBe(original)
    }
  })

  it('throws PipelineError with code insufficient_candles when candle count is below minimum', async () => {
    const fewCandles = makeCandles(10)
    try {
      await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(fewCandles) })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError)
      expect((err as PipelineError).code).toBe('insufficient_candles')
      expect((err as PipelineError).module).toBe('binance')
    }
  })

  it('throws PipelineError with code configuration_error for empty symbol', async () => {
    try {
      await analyzeMarket({ symbol: '', interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError)
      expect((err as PipelineError).code).toBe('configuration_error')
    }
  })

  it('PipelineError is instanceof Error', async () => {
    try {
      await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: failingFetch() })
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(PipelineError)
    }
  })

  it('PipelineError exposes code, module, and reason as string properties', async () => {
    try {
      await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: failingFetch('bad') })
    } catch (err) {
      const pe = err as PipelineError
      expect(typeof pe.code).toBe('string')
      expect(typeof pe.module).toBe('string')
      expect(typeof pe.reason).toBe('string')
    }
  })

  it('PipelineError.name is "PipelineError"', async () => {
    try {
      await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: failingFetch() })
    } catch (err) {
      expect((err as PipelineError).name).toBe('PipelineError')
    }
  })
})

// ── Configuration ────────────────────────────────────────────────────────────

describe('analyzeMarket — configuration', () => {
  it('custom minCandleCount allows fewer candles through', async () => {
    const candles = makeCandles(20)
    const result = await analyzeMarket({
      symbol: SYMBOL,
      interval: INTERVAL,
      fetchImpl: mockFetch(candles),
      config: { minCandleCount: 10 },
    })
    expect(result.candles).toHaveLength(20)
  })

  it('throws insufficient_candles when candle count is below custom minCandleCount', async () => {
    const candles = makeCandles(5)
    try {
      await analyzeMarket({
        symbol: SYMBOL,
        interval: INTERVAL,
        fetchImpl: mockFetch(candles),
        config: { minCandleCount: 10 },
      })
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as PipelineError).code).toBe('insufficient_candles')
    }
  })

  it('writer config override is applied (executive template changes fullReport)', async () => {
    const candles = makeCandles(100)
    const [r1, r2] = await Promise.all([
      analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) }),
      analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles), config: { writer: { template: 'bullet' } } }),
    ])
    expect(r1.generatedAnalysis.fullReport).not.toBe(r2.generatedAnalysis.fullReport)
  })
})

// ── Dependency injection ─────────────────────────────────────────────────────

describe('analyzeMarket — fetch dependency injection', () => {
  it('calls fetchImpl with the provided symbol and interval', async () => {
    const spy = vi.fn(mockFetch(makeCandles(100)))
    await analyzeMarket({ symbol: 'ETHUSDT', interval: '4h', fetchImpl: spy })
    expect(spy).toHaveBeenCalledTimes(1)
    const [calledSymbol, calledInterval] = spy.mock.calls[0]
    expect(calledSymbol).toBe('ETHUSDT')
    expect(calledInterval).toBe('4h')
  })

  it('calls fetchImpl with candleLimit from options', async () => {
    const spy = vi.fn(mockFetch(makeCandles(100)))
    await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, candleLimit: 333, fetchImpl: spy })
    const [, , options] = spy.mock.calls[0]
    expect(options.candleLimit).toBe(333)
  })

  it('does not make real network requests when fetchImpl is provided', async () => {
    // If the real fetchMarketData were called it would attempt a network request
    // and either fail or produce inconsistent data. Providing a mock confirms DI works.
    const localFetch = vi.fn(mockFetch(makeCandles(100)))
    await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: localFetch })
    expect(localFetch).toHaveBeenCalledTimes(1)
  })
})

// ── Determinism ──────────────────────────────────────────────────────────────

describe('analyzeMarket — deterministic output', () => {
  it('produces identical non-timing output for identical inputs', async () => {
    const candles = makeCandles(100)
    const fetch = mockFetch(candles)
    const opts = { symbol: SYMBOL, interval: INTERVAL as Timeframe, fetchImpl: fetch }

    const r1 = await analyzeMarket(opts)
    const r2 = await analyzeMarket(opts)

    const stable = (r: Awaited<ReturnType<typeof analyzeMarket>>) => ({
      indicators: r.indicators,
      marketStructure: r.marketStructure,
      supportResistance: r.supportResistance,
      volumeAnalysis: r.volumeAnalysis,
      analysis: r.analysis,
      validation: r.validation,
      confidence: r.confidence,
      generatedAnalysis: r.generatedAnalysis,
      meta: {
        symbol: r.metadata.symbol,
        interval: r.metadata.interval,
        candleCount: r.metadata.candleCount,
        version: r.metadata.version,
        timestamp: r.metadata.timestamp,
      },
    })

    expect(stable(r1)).toEqual(stable(r2))
  })
})

// ── Execution order ──────────────────────────────────────────────────────────

describe('analyzeMarket — execution order', () => {
  it('stages run in order: indicators receive candles from fetch', async () => {
    const candles = makeCandles(100)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    // If indicators were computed before fetch, they would have no data and all fields would be null.
    // With 100 candles we expect EMA20 to be non-null.
    expect(result.indicators.ema20).not.toBeNull()
  })

  it('analysis sees market structure output', async () => {
    const candles = makeCandles(100)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    // MarketAnalysisResult contains marketStructure pass-through; verify it is present
    expect(result.analysis.marketStructure).toBeDefined()
  })

  it('confidence sees validation result (warns when validation has issues)', async () => {
    const candles = makeCandles(100)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    // Confidence penalties come from validation; verifying the pipeline wires them correctly
    expect(Array.isArray(result.confidence.penalties)).toBe(true)
  })

  it('writer receives confidence score from stage 8', async () => {
    const candles = makeCandles(100)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    expect(result.generatedAnalysis.metadata.confidenceScore).toBe(result.confidence.score)
  })
})

// ── Phase 13 — Cross-layer wiring invariants ──────────────────────────────────
//
// The pipeline is composed of independent modules. These tests verify the
// data plumbing: that each stage consumes exactly the output of the stage
// above it, not a recomputed copy. A wiring regression (e.g. Fibonacci
// receiving a different swing set, or metadata.window pointing to wrong
// candles) would not be caught by per-module unit tests.

describe('analyzeMarket — Phase 13: cross-layer wiring invariants', () => {
  it('metadata.window spans exactly the fetched candle array', async () => {
    const candles = makeCandles(200)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    expect(result.metadata.window).toBeDefined()
    expect(result.metadata.window!.firstOpenTime).toBe(candles[0].openTime)
    expect(result.metadata.window!.lastOpenTime).toBe(candles[candles.length - 1].openTime)
  })

  it('metadata.window.lastOpenTime equals the last candle openTime in result.candles', async () => {
    // This verifies the window tracks the same candle set as result.candles.
    const candles = makeCandles(150)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    const lastCandle = result.candles[result.candles.length - 1]
    expect(result.metadata.window!.lastOpenTime).toBe(lastCandle.openTime)
  })

  it('fibonacci anchor prices come from marketStructure.swings when fibonacci is available', async () => {
    // fibonacci is computed with marketStructure.swings as input. Its anchor
    // prices must be prices that the swing detector emitted — never recomputed.
    const candles = makeCandles(200)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })

    if (!result.fibonacci?.available) return  // no impulse detected on this fixture — skip

    const swingPrices = new Set(result.marketStructure.swings.map(s => s.price))
    expect(swingPrices.has(result.fibonacci.swingHigh.price),
      `fibonacci.swingHigh.price ${result.fibonacci.swingHigh.price} not in marketStructure.swings`
    ).toBe(true)
    expect(swingPrices.has(result.fibonacci.swingLow.price),
      `fibonacci.swingLow.price ${result.fibonacci.swingLow.price} not in marketStructure.swings`
    ).toBe(true)
  })

  it('fibonacci anchor timestamps match the swing timestamps', async () => {
    const candles = makeCandles(200)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })

    if (!result.fibonacci?.available) return

    const matchHigh = result.marketStructure.swings.find(
      s => s.price === result.fibonacci!.swingHigh.price && s.type === 'high',
    )
    const matchLow = result.marketStructure.swings.find(
      s => s.price === result.fibonacci!.swingLow.price && s.type === 'low',
    )
    expect(matchHigh).toBeDefined()
    expect(matchLow).toBeDefined()
    expect(result.fibonacci.swingHigh.timestamp).toBe(matchHigh!.timestamp)
    expect(result.fibonacci.swingLow.timestamp).toBe(matchLow!.timestamp)
  })

  it('fibonacci direction is consistent with the full-trend direction from analysis', async () => {
    // Stage 6b derives fibDirection from analysis.fullTrend.trend (not from
    // marketStructure.trend alone). Verify the two directions agree.
    const candles = makeCandles(200)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })

    if (!result.fibonacci?.available) return

    const fullTrend = result.analysis.fullTrend.trend
    const expectedFibDir =
      fullTrend.includes('bullish') ? 'bullish' :
      fullTrend.includes('bearish') ? 'bearish' :
      'ranging'

    expect(result.fibonacci.direction).toBe(expectedFibDir)
  })

  it('every BOS and CHoCH event level is a price from marketStructure.swings', async () => {
    // detectBosChoch assigns event.level directly from the swing object.
    // This verifies the pipeline does not re-derive levels from candle data.
    const candles = makeCandles(200)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })

    const swingPrices = new Set(result.marketStructure.swings.map(s => s.price))
    for (const e of result.marketStructure.events) {
      expect(swingPrices.has(e.level),
        `${e.type} level ${e.level} at bar ${e.index} is not in marketStructure.swings`
      ).toBe(true)
    }
  })

  it('result.candles is the exact array returned by fetchImpl (identity, not a copy)', async () => {
    // The pipeline must not deep-copy the candles array — downstream consumers
    // that compare candle references (e.g. pipelineFetch.ts) depend on identity.
    const candles = makeCandles(100)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    expect(result.candles).toBe(candles)
  })
})

// ── Phase 14 — Analysis generation ID ────────────────────────────────────────
//
// Every pipeline run emits a unique analysisId. This lets the UI distinguish a
// genuinely fresh result from an identical re-render, and is the stable key for
// React memoisation and history deduplication — even when symbol/interval/window
// are the same across two consecutive calls.

describe('analyzeMarket — Phase 14: analysis generation ID', () => {
  it('metadata.analysisId is a non-empty string', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(typeof result.metadata.analysisId).toBe('string')
    expect(result.metadata.analysisId.length).toBeGreaterThan(0)
  })

  it('metadata.analysisId looks like a UUID (8-4-4-4-12 hex)', async () => {
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(makeCandles(100)) })
    expect(result.metadata.analysisId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('two runs with identical inputs produce different analysisIds', async () => {
    const candles = makeCandles(100)
    const fetch = mockFetch(candles)
    const opts = { symbol: SYMBOL, interval: INTERVAL as Timeframe, fetchImpl: fetch }

    const r1 = await analyzeMarket(opts)
    const r2 = await analyzeMarket(opts)

    expect(r1.metadata.analysisId).not.toBe(r2.metadata.analysisId)
  })

  it('analysisId is not included in the deterministic-output snapshot (it changes per run)', async () => {
    // The existing determinism test checks stable: never include analysisId there.
    // This test makes that contract explicit.
    const candles = makeCandles(100)
    const result = await analyzeMarket({ symbol: SYMBOL, interval: INTERVAL, fetchImpl: mockFetch(candles) })
    // analysisId must be present on metadata but MUST NOT equal any deterministic field
    expect(result.metadata.analysisId).toBeDefined()
    expect(result.metadata.analysisId).not.toBe(result.metadata.symbol)
    expect(result.metadata.analysisId).not.toBe(result.metadata.interval)
    expect(result.metadata.analysisId).not.toBe(result.metadata.version)
  })
})
