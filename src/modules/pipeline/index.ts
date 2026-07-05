import { fetchMarketData, DEFAULT_CANDLE_LIMIT } from '../binance/index'
import type { MarketData } from '../binance/types'
import { computeIndicators } from '../indicators/index'
import type { IndicatorResult } from '../indicators/types'
import { computeMarketStructure } from '../market-structure/index'
import type { MarketStructureResult } from '../market-structure/types'
import { computeSupportResistance } from '../support-resistance/index'
import type { SupportResistanceResult } from '../support-resistance/types'
import { computeVolumeAnalysis } from '../volume-analysis/index'
import type { VolumeAnalysisResult } from '../volume-analysis/types'
import { computeAnalysis } from '../analysis/index'
import type { MarketAnalysisResult } from '../analysis/types'
import { validateAnalysis } from '../validation/index'
import type { ValidationResult } from '../validation/types'
import { computeConfidence } from '../confidence/index'
import type { ConfidenceResult } from '../confidence/types'
import { generateAnalysis } from '../writer/index'
import type { GeneratedAnalysis } from '../writer/types'
import { createAIProvider } from '../ai/index'
import type { AIConfig } from '../ai/types'
import { computeDecision } from './compute/decision'
import { computeTradePlan } from './compute/trade-plan'
import { computeMarketContext } from './compute/market-context'
import { computeInvalidationScenarios } from './compute/invalidation'
import { DEFAULT_PIPELINE_CONFIG, PIPELINE_VERSION } from './config'
import type {
  PipelineOptions,
  PipelineResult,
  PipelineConfig,
  PipelineTimings,
  PipelineErrorCode,
  FetchFn,
  TradeDecision,
  TradePlan,
  MarketContext,
  InvalidationScenario,
} from './types'

export type {
  PipelineOptions,
  PipelineResult,
  PipelineConfig,
  PipelineTimings,
  PipelineErrorCode,
  FetchFn,
  TradeDecision,
  TradeDecisionLabel,
  TradePlan,
  MarketPhase,
  MarketContext,
  InvalidationSeverity,
  InvalidationType,
  InvalidationScenario,
  DecisionDimensionStatus,
  DecisionDimension,
  DecisionExplanation,
  DecisionQuality,
} from './types'
export { PIPELINE_VERSION, DEFAULT_PIPELINE_CONFIG } from './config'

export class PipelineError extends Error {
  readonly code: PipelineErrorCode
  readonly module: string
  readonly reason: string
  readonly cause: unknown

  constructor(code: PipelineErrorCode, module: string, reason: string, cause?: unknown) {
    super(reason)
    this.name = 'PipelineError'
    this.code = code
    this.module = module
    this.reason = reason
    this.cause = cause
  }
}

function mergeConfig(partial: Partial<PipelineConfig>): PipelineConfig {
  return {
    minCandleCount: partial.minCandleCount ?? DEFAULT_PIPELINE_CONFIG.minCandleCount,
    marketStructure: { ...DEFAULT_PIPELINE_CONFIG.marketStructure, ...partial.marketStructure },
    supportResistance: { ...DEFAULT_PIPELINE_CONFIG.supportResistance, ...partial.supportResistance },
    volumeAnalysis: { ...DEFAULT_PIPELINE_CONFIG.volumeAnalysis, ...partial.volumeAnalysis },
    analysis: { ...DEFAULT_PIPELINE_CONFIG.analysis, ...partial.analysis },
    validation: { ...DEFAULT_PIPELINE_CONFIG.validation, ...partial.validation },
    confidence: { ...DEFAULT_PIPELINE_CONFIG.confidence, ...partial.confidence },
    writer: { ...DEFAULT_PIPELINE_CONFIG.writer, ...partial.writer },
    ai: partial.ai,
  }
}

export async function analyzeMarket(options: PipelineOptions): Promise<PipelineResult> {
  const {
    symbol,
    interval,
    candleLimit = DEFAULT_CANDLE_LIMIT,
    config: userConfig = {},
    fetchImpl,
  } = options

  if (!symbol || typeof symbol !== 'string') {
    throw new PipelineError('configuration_error', 'pipeline', 'symbol is required and must be a non-empty string')
  }

  const cfg = mergeConfig(userConfig)
  const pipelineStart = Date.now()
  const fetcher: FetchFn = fetchImpl ?? fetchMarketData

  // ── Stage 1: Fetch ──────────────────────────────────────────────────────────
  const t0 = Date.now()
  let marketData!: MarketData
  try {
    marketData = await fetcher(symbol, interval, { candleLimit })
  } catch (err) {
    throw new PipelineError(
      'fetch_failure',
      'binance',
      `Failed to fetch market data for ${symbol}: ${err instanceof Error ? err.message : String(err)}`,
      err,
    )
  }
  const fetchTime = Date.now() - t0

  if (marketData.candles.length < cfg.minCandleCount) {
    throw new PipelineError(
      'insufficient_candles',
      'binance',
      `Insufficient candles: need at least ${cfg.minCandleCount}, got ${marketData.candles.length}`,
    )
  }

  // ── Stage 2: Indicators ─────────────────────────────────────────────────────
  const t1 = Date.now()
  let indicators!: IndicatorResult
  try {
    indicators = computeIndicators(marketData.candles)
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'indicators', String(err), err)
  }
  const indicatorsTime = Date.now() - t1

  // ── Stage 3: Market Structure ───────────────────────────────────────────────
  const t2 = Date.now()
  let marketStructure!: MarketStructureResult
  try {
    marketStructure = computeMarketStructure(marketData.candles, cfg.marketStructure)
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'market-structure', String(err), err)
  }
  const marketStructureTime = Date.now() - t2

  // ── Stage 4: Support / Resistance ───────────────────────────────────────────
  const t3 = Date.now()
  let supportResistance!: SupportResistanceResult
  try {
    supportResistance = computeSupportResistance(marketData.candles, marketStructure, cfg.supportResistance)
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'support-resistance', String(err), err)
  }
  const supportResistanceTime = Date.now() - t3

  // ── Stage 5: Volume Analysis ────────────────────────────────────────────────
  const t4 = Date.now()
  let volumeAnalysis!: VolumeAnalysisResult
  try {
    volumeAnalysis = computeVolumeAnalysis(
      marketData.candles,
      indicators,
      marketStructure,
      supportResistance,
      cfg.volumeAnalysis,
    )
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'volume-analysis', String(err), err)
  }
  const volumeTime = Date.now() - t4

  // ── Stage 6: Analysis ───────────────────────────────────────────────────────
  const t5 = Date.now()
  let analysis!: MarketAnalysisResult
  try {
    analysis = computeAnalysis(
      marketData,
      indicators,
      marketStructure,
      supportResistance,
      volumeAnalysis,
      cfg.analysis,
    )
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'analysis', String(err), err)
  }
  const analysisTime = Date.now() - t5

  // ── Stage 7: Validation ─────────────────────────────────────────────────────
  const t6 = Date.now()
  let validation!: ValidationResult
  try {
    validation = validateAnalysis(analysis, cfg.validation)
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'validation', String(err), err)
  }
  const validationTime = Date.now() - t6

  // ── Stage 8: Confidence ─────────────────────────────────────────────────────
  const t7 = Date.now()
  let confidence!: ConfidenceResult
  try {
    confidence = computeConfidence(analysis, validation, cfg.confidence)
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'confidence', String(err), err)
  }
  const confidenceTime = Date.now() - t7

  // ── Stage 9: Trade Decision + Trade Plan + Market Context + Invalidation ────
  let decision!: TradeDecision
  let tradePlan!: TradePlan
  let marketContext!: MarketContext
  let invalidationScenarios!: InvalidationScenario[]
  try {
    decision              = computeDecision(analysis, confidence, validation)
    tradePlan             = computeTradePlan(analysis, supportResistance, confidence)
    marketContext         = computeMarketContext(analysis)
    invalidationScenarios = computeInvalidationScenarios(analysis, validation, tradePlan)
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'decision', String(err), err)
  }

  // ── Stage 10: Writer ─────────────────────────────────────────────────────────
  const t8 = Date.now()
  let generatedAnalysis!: GeneratedAnalysis
  try {
    generatedAnalysis = generateAnalysis({ analysis, validation, confidence }, cfg.writer)
  } catch (err) {
    throw new PipelineError('internal_module_failure', 'writer', String(err), err)
  }
  const writerTime = Date.now() - t8

  // ── Stage 11: AI Enhancement (optional, never throws) ───────────────────────
  let aiTime: number | undefined
  const aiCfg = cfg.ai
  if (aiCfg?.provider && aiCfg.apiKey) {
    const t9 = Date.now()
    try {
      const provider = createAIProvider(aiCfg as AIConfig)
      if (provider.isAvailable()) {
        const enhancement = await provider.enhance({
          symbol,
          interval,
          headline: generatedAnalysis.headline,
          summary: generatedAnalysis.summary,
          conclusion: generatedAnalysis.conclusion,
          fullReport: generatedAnalysis.fullReport,
          confidenceScore: confidence.score,
          confidenceGrade: confidence.grade,
        })
        generatedAnalysis = {
          ...generatedAnalysis,
          summary: enhancement.summary,
          conclusion: enhancement.conclusion,
          aiEnhanced: true,
        }
      }
    } catch {
      // Silently fall back to deterministic output — AI is always optional
    }
    aiTime = Date.now() - t9
  }

  const totalTime = Date.now() - pipelineStart

  const timings: PipelineTimings = {
    fetch: fetchTime,
    indicators: indicatorsTime,
    marketStructure: marketStructureTime,
    supportResistance: supportResistanceTime,
    volume: volumeTime,
    analysis: analysisTime,
    validation: validationTime,
    confidence: confidenceTime,
    writer: writerTime,
    ...(aiTime !== undefined && { aiEnhancement: aiTime }),
    total: totalTime,
  }

  return {
    candles: marketData.candles,
    indicators,
    marketStructure,
    supportResistance,
    volumeAnalysis,
    analysis,
    validation,
    confidence,
    decision,
    tradePlan,
    marketContext,
    invalidationScenarios,
    generatedAnalysis,
    metadata: {
      symbol: marketData.symbol,
      interval,
      candleCount: marketData.candles.length,
      timestamp: marketData.fetchedAt,
      executionTime: totalTime,
      version: PIPELINE_VERSION,
      timings,
    },
  }
}
