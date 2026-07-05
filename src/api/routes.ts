import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { PIPELINE_VERSION } from './config'
import { validateAnalyzeInput } from './middleware/validation'
import type { AnalyzeFn, AnalyzeRequest } from './types'
import type { Timeframe } from '../modules/binance/types'
import type { Candle, MarketData } from '../modules/binance/types'
import type { PipelineConfig } from '../modules/pipeline/types'
import { analyzeMarket } from '../modules/pipeline/index'
import { computeConfidence } from '../modules/confidence/index'
import type { MarketAnalysisResult, EvidenceItem } from '../modules/analysis/types'
import type { ValidationResult } from '../modules/validation/types'

export function createRouter(analyzeFn: AnalyzeFn): Router {
  const router = Router()

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: PIPELINE_VERSION })
  })

  router.get('/version', (_req: Request, res: Response) => {
    res.json({ version: PIPELINE_VERSION })
  })

  router.post(
    '/analyze',
    validateAnalyzeInput,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { symbol, interval, candleLimit, config } = req.body as AnalyzeRequest
        const result = await analyzeFn({
          symbol: symbol.trim().toUpperCase(),
          interval: interval as Timeframe,
          candleLimit: candleLimit !== undefined ? Number(candleLimit) : undefined,
          config: config as Partial<PipelineConfig>,
        })

        res.json(result)
      } catch (err) {
        next(err)
      }
    },
  )

  // ── Module 28 Debug Endpoint ────────────────────────────────────────────────
  // Runs computeConfidence() directly with a known mock bearish analysis.
  // Bypasses Binance fetch. Use to verify the engine returns non-zero scores
  // for bearish markets independently of live data.
  // TEMPORARY — remove after forensic investigation is complete.
  router.get('/debug-confidence', (_req: Request, res: Response) => {
    const mockEvidence: EvidenceItem[] = [
      { factor: 'Price below EMA20',      direction: 'bearish', impact: 'high',   description: 'Mock: price below EMA20',  source: 'indicators' },
      { factor: 'Price below EMA50',      direction: 'bearish', impact: 'high',   description: 'Mock: price below EMA50',  source: 'indicators' },
      { factor: 'Price below EMA100',     direction: 'bearish', impact: 'high',   description: 'Mock: price below EMA100', source: 'indicators' },
      { factor: 'Price below EMA200',     direction: 'bearish', impact: 'high',   description: 'Mock: price below EMA200', source: 'indicators' },
      { factor: 'EMA bearish alignment',  direction: 'bearish', impact: 'high',   description: 'Mock: bearish EMA stack',  source: 'indicators' },
      { factor: 'Lower High confirmed',   direction: 'bearish', impact: 'high',   description: 'Mock: lower high',         source: 'market_structure' },
      { factor: 'Lower Low confirmed',    direction: 'bearish', impact: 'high',   description: 'Mock: lower low',          source: 'market_structure' },
      { factor: 'MACD bearish bias',      direction: 'bearish', impact: 'medium', description: 'Mock: MACD bearish',       source: 'indicators' },
      { factor: 'RSI weak bearish',       direction: 'bearish', impact: 'medium', description: 'Mock: RSI 38',             source: 'indicators' },
    ]

    const mockAnalysis: MarketAnalysisResult = {
      symbol: 'BTCUSDT',
      timeframe: '4h' as Timeframe,
      analysedAt: Date.now(),
      price: { current: 95000, change24hPercent: -2.5, high24h: 97000, low24h: 94000, atrPercent: 2.1 },
      fullTrend: {
        trend: 'moderate bearish',
        bullishConditionsMet: 1,
        bearishConditionsMet: 4,
        neutralConditionsMet: 0,
        conditions: {
          priceAboveEMA20: false, priceAboveEMA50: false, priceAboveEMA100: false, priceAboveEMA200: false,
          priceAboveAllEMAs: false, emaInBullishOrder: false, hasConsistentHHHL: false,
          rsiSupportsBullish: false, macdBullish: false,
          priceBelowEMA20: true, priceBelowEMA50: true, priceBelowEMA100: true, priceBelowEMA200: true,
          priceBelowAllEMAs: true, emaInBearishOrder: true, hasConsistentLHLL: true,
          rsiSupportsBearish: true, macdBearish: false,
          adxBelowWeakThreshold: false, rsiInNeutralRange: false,
          noConsistentStructure: false, priceBetweenEMAsWithoutClearOrder: false,
        },
      },
      emaContext: {
        priceVsEMA20: 'below', priceVsEMA50: 'below', priceVsEMA100: 'below', priceVsEMA200: 'below',
        emaAlignment: 'bearish_stack', confluenceZones: [],
      },
      indicatorSummary: {
        rsi: { value: 38, classification: 'weak_bearish' },
        macd: { histogram: -120, bias: 'bearish' },
        adx: { adx: 28, trendStrength: 'strong', dominantDirection: 'bearish' },
        bollinger: { bandwidth: 0.04, bandwidthState: 'normal', priceRelativeToBands: 'inside' },
        stochRsi: { k: 25, d: 30, zone: 'oversold' },
      },
      srContext: {
        nearestSupportDistance: null, nearestResistanceDistance: 2.1,
        insideSupport: false, insideResistance: false,
        approachingSupport: false, approachingResistance: false,
        strongestActiveSupport: null, strongestActiveResistance: null,
      },
      volumeContext: {
        relativeVolume: 1.3, volumeClassification: 'high',
        confirmsCurrentMove: true, climaxSignal: 'none',
        accDistState: 'distribution', priceAboveVWAP: false,
        vwapDistancePercent: 1.2, respectingVWAP: true,
        obvDirection: 'bearish', obvConfirmingPrice: true,
        overallStrength: 7,
      },
      evidence: mockEvidence,
      indicators: {
        ema20: null, ema50: null, ema100: null, ema200: null,
        sma20: null, sma50: null, sma200: null,
        rsi: null, macd: null, atr: null, atrPercent: null, adx: null,
        vwap: 0, bollingerBands: null, stochRsi: null,
        obv: 0, mfi: null, cci: null, volumeMA: null,
      },
      marketStructure: {
        trend: 'bearish', strength: 'strong', confidence: 80,
        structure:       { higherHighs: 0, higherLows: 0, lowerHighs: 3, lowerLows: 3, equalHighs: 0, equalLows: 0 },
        recentStructure: { higherHighs: 0, higherLows: 0, lowerHighs: 2, lowerLows: 2, equalHighs: 0, equalLows: 0 },
        bos:           { detected: true,  events: [], last: null },
        choch:         { detected: false, events: [], last: null },
        pullback:      { detected: false, depth: null },
        consolidation: { detected: false, rangeHigh: null, rangeLow: null, rangePercent: null, barsInRange: 0 },
        breakout:      { confirmed: false, failed: false, level: null, direction: null },
        swings: [], events: [], evidence: [],
      },
      supportResistance: {
        zones: [], activeSupport: [], activeResistance: [],
        nearestSupport: null, nearestResistance: null, currentZone: null, evidence: [],
      },
      volumeAnalysis: {
        volumeTrend: { direction: 'decreasing', confidence: 70, evidence: [] },
        relativeVolume: { current: 1300, average: 1000, ratio: 1.3, classification: 'high' },
        buySellPressure: { buyVolume: 400, sellVolume: 600, delta: -200, deltaPercent: -20, dominantSide: 'sellers' },
        volumeConfirmation: { confirmed: true, reason: 'Volume 1.3× confirms bearish move', supportsTrend: true, supportsBreakout: false, supportsBOS: false, supportsCHOCH: false },
        climax: { buyingClimax: false, sellingClimax: false, exhaustion: false },
        accumulationDistribution: { state: 'distribution', score: -3 },
        obvAnalysis: { direction: 'bearish', confirmingPrice: true, diverging: false },
        vwapAnalysis: { above: false, below: true, distancePercent: 1.2, respectingVWAP: true },
        overallStrength: 7,
        evidence: [],
      },
    }

    const mockValidation: ValidationResult = {
      passed: true, clean: true, issues: [],
      criticalCount: 0, warningCount: 0, infoCount: 0,
      summary: 'Debug mock: all checks passed',
    }

    console.log('[api:routes] /debug-confidence: calling computeConfidence with mock bearish data')
    console.log('[api:routes] mockEvidence:', JSON.stringify(mockEvidence, null, 2))
    console.log('[api:routes] trend:', mockAnalysis.fullTrend.trend)

    const confidence = computeConfidence(mockAnalysis, mockValidation)

    const response = {
      _debug: {
        source: 'GET /api/debug-confidence',
        note: 'Mock moderate bearish analysis. Intermediate values logged to server console.',
        trend: mockAnalysis.fullTrend.trend,
        evidenceCount: mockEvidence.length,
        factors: mockEvidence.map(e => `${e.direction}:${e.factor}`),
      },
      confidence,
    }

    console.log('[api:routes] /debug-confidence RESULT:', JSON.stringify({
      score: confidence.score,
      grade: confidence.grade,
      bullishConfidence: confidence.bullishConfidence,
      bearishConfidence: confidence.bearishConfidence,
      neutralContribution: confidence.neutralContribution,
      reasonsCount: confidence.reasons.length,
    }, null, 2))

    res.json(response)
  })

  // ── Module 28 Full-Pipeline Debug Endpoint ─────────────────────────────────
  // Runs all 11 pipeline stages with synthetic bearish candle data.
  // No Binance API needed. Proves the full chain works end-to-end.
  // TEMPORARY — remove after forensic investigation is complete.
  router.get('/debug-pipeline', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const COUNT = 250
      const now = Date.now()
      const INTERVAL_MS = 3_600_000 // 1h
      const START_PRICE = 100_000
      const END_PRICE = 76_000
      const priceStep = (END_PRICE - START_PRICE) / COUNT

      const syntheticCandles: Candle[] = Array.from({ length: COUNT }, (_, i) => {
        const base = START_PRICE + priceStep * i
        const noise = (Math.sin(i * 0.7) * 200) + (Math.cos(i * 1.3) * 100)
        const close = Math.max(70_000, base + noise)
        const open  = close + 100 + Math.sin(i) * 80
        const high  = Math.max(open, close) + 150 + Math.abs(Math.sin(i * 2.1)) * 200
        const low   = Math.min(open, close) - 150 - Math.abs(Math.cos(i * 1.7)) * 200
        const vol   = 1200 + Math.abs(Math.sin(i * 0.5)) * 800 + (i > 200 ? 500 : 0)
        return {
          openTime:       now - (COUNT - i) * INTERVAL_MS,
          closeTime:      now - (COUNT - i) * INTERVAL_MS + INTERVAL_MS - 1,
          open:           Math.round(open * 100) / 100,
          high:           Math.round(high * 100) / 100,
          low:            Math.round(low  * 100) / 100,
          close:          Math.round(close * 100) / 100,
          volume:         Math.round(vol * 10) / 10,
          quoteVolume:    Math.round(vol * close),
          trades:         Math.round(200 + Math.abs(Math.sin(i)) * 100),
          takerBuyVolume: Math.round(vol * 0.38 * 10) / 10,
          takerSellVolume:Math.round(vol * 0.62 * 10) / 10,
        }
      })

      const lastClose = syntheticCandles[syntheticCandles.length - 1].close
      const prevClose = syntheticCandles[syntheticCandles.length - 2].close
      const mockFetch = async (): Promise<MarketData> => ({
        symbol: 'BTCUSDT_MOCK',
        timeframe: '1h',
        fetchedAt: now,
        candles: syntheticCandles,
        ticker: {
          symbol: 'BTCUSDT_MOCK', priceChange: lastClose - prevClose,
          priceChangePercent: ((lastClose - prevClose) / prevClose) * 100,
          weightedAvgPrice: lastClose, lastPrice: lastClose,
          bidPrice: lastClose - 10, askPrice: lastClose + 10,
          openPrice: prevClose, highPrice: lastClose + 500, lowPrice: lastClose - 500,
          volume: 12000, quoteVolume: 12000 * lastClose,
          openTime: now - 86_400_000, closeTime: now,
          tradeCount: 5000,
        },
        fundingRate: null,
        openInterest: null,
      })

      console.log('[api:routes] /debug-pipeline: running full 11-stage pipeline with synthetic bearish candles')

      const result = await analyzeMarket({
        symbol: 'BTCUSDT_MOCK',
        interval: '1h',
        fetchImpl: mockFetch,
      })

      console.log('[api:routes] /debug-pipeline RESULT:', JSON.stringify({
        trend: result.analysis.fullTrend.trend,
        bullishConditions: result.analysis.fullTrend.bullishConditionsMet,
        bearishConditions: result.analysis.fullTrend.bearishConditionsMet,
        evidenceCount: result.analysis.evidence.length,
        confidenceScore: result.confidence.score,
        confidenceGrade: result.confidence.grade,
        bullishConfidence: result.confidence.bullishConfidence,
        bearishConfidence: result.confidence.bearishConfidence,
        neutralContribution: result.confidence.neutralContribution,
        reasonsCount: result.confidence.reasons.length,
      }, null, 2))

      res.json({
        _debug: {
          source: 'GET /debug-pipeline',
          note: '11-stage pipeline with 250 synthetic bearish candles. No Binance API used.',
          candleCount: syntheticCandles.length,
          startPrice: START_PRICE,
          endPrice: Math.round(lastClose),
        },
        trend: result.analysis.fullTrend.trend,
        bullishConditionsMet: result.analysis.fullTrend.bullishConditionsMet,
        bearishConditionsMet: result.analysis.fullTrend.bearishConditionsMet,
        evidenceCount: result.analysis.evidence.length,
        evidence: result.analysis.evidence.map(e => ({ direction: e.direction, factor: e.factor })),
        confidence: result.confidence,
        timings: result.metadata.timings,
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
