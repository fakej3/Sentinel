import type { Candle, Timeframe, FetchOptions, MarketData } from '../binance/types'
import type { IndicatorResult } from '../indicators/types'
import type { MarketStructureResult, MarketStructureConfig } from '../market-structure/types'
import type { SupportResistanceResult, SupportResistanceConfig } from '../support-resistance/types'
import type { VolumeAnalysisResult, VolumeAnalysisConfig } from '../volume-analysis/types'
import type { MarketAnalysisResult, AnalysisConfig } from '../analysis/types'
import type { ValidationResult, ValidationConfig } from '../validation/types'
import type { ConfidenceResult, ConfidenceConfig } from '../confidence/types'
import type { GeneratedAnalysis, WriterConfig } from '../writer/types'
import type { AIConfig } from '../ai/types'

export type TradeDecisionLabel =
  | 'Strong Buy'
  | 'Buy'
  | 'Cautious Buy'
  | 'Watch'
  | 'Neutral'
  | 'Cautious Sell'
  | 'Sell'
  | 'Strong Sell'

export interface TradeDecision {
  label: TradeDecisionLabel
  /** 3–5 concise reasons supporting the label */
  reasons: string[]
  riskLevel: 'Low' | 'Medium' | 'High'
  /** Mirrors confidence.score for convenience */
  confidence: number
}

export type PipelineErrorCode =
  | 'fetch_failure'
  | 'insufficient_candles'
  | 'validation_failure'
  | 'internal_module_failure'
  | 'configuration_error'

export interface PipelineTimings {
  fetch: number
  indicators: number
  marketStructure: number
  supportResistance: number
  volume: number
  analysis: number
  validation: number
  confidence: number
  writer: number
  aiEnhancement?: number
  total: number
}

export interface PipelineMetadata {
  symbol: string
  interval: Timeframe
  candleCount: number
  timestamp: number
  executionTime: number
  version: string
  timings: PipelineTimings
}

export interface PipelineResult {
  candles: Candle[]
  indicators: IndicatorResult
  marketStructure: MarketStructureResult
  supportResistance: SupportResistanceResult
  volumeAnalysis: VolumeAnalysisResult
  analysis: MarketAnalysisResult
  validation: ValidationResult
  confidence: ConfidenceResult
  decision: TradeDecision
  generatedAnalysis: GeneratedAnalysis
  metadata: PipelineMetadata
}

export interface PipelineConfig {
  minCandleCount: number
  marketStructure: Partial<MarketStructureConfig>
  supportResistance: Partial<SupportResistanceConfig>
  volumeAnalysis: Partial<VolumeAnalysisConfig>
  analysis: Partial<AnalysisConfig>
  validation: Partial<ValidationConfig>
  confidence: Partial<ConfidenceConfig>
  writer: Partial<WriterConfig>
  /** Optional AI enhancement config. When omitted or apiKey is empty, Stage 10 is skipped. */
  ai?: Partial<AIConfig>
}

export type FetchFn = (
  symbol: string,
  timeframe: Timeframe,
  options: FetchOptions,
) => Promise<MarketData>

export interface PipelineOptions {
  symbol: string
  interval: Timeframe
  candleLimit?: number
  config?: Partial<PipelineConfig>
  fetchImpl?: FetchFn
}
