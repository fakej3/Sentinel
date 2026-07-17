/**
 * Analysis Engine — synthesizes all upstream module outputs into a single
 * MarketAnalysisResult used by confidence scoring, validation, and the writer.
 *
 * Inputs:  MarketData, IndicatorResult, MarketStructureResult,
 *          SupportResistanceResult, VolumeAnalysisResult
 * Outputs: MarketAnalysisResult (price, fullTrend, emaContext, indicatorSummary,
 *          srContext, volumeContext, evidence)
 * Deps:    binance, indicators, market-structure, support-resistance, volume-analysis
 */
import type { MarketData } from '../market/types'
import type { IndicatorResult } from '../indicators/types'
import type { MarketStructureResult } from '../market-structure/types'
import type { SupportResistanceResult } from '../support-resistance/types'
import type { VolumeAnalysisResult } from '../volume-analysis/types'
import type { AnalysisConfig, MarketAnalysisResult } from './types'
import { DEFAULT_ANALYSIS_CONFIG } from './config'
import { extractPriceSummary } from './compute/price'
import { synthesizeFullTrend } from './compute/full-trend'
import { computeEMAContext } from './compute/ema-context'
import { interpretIndicators } from './compute/indicators'
import { deriveSRContext } from './compute/sr-context'
import { buildVolumeContext } from './compute/volume-context'
import { collectEvidence } from './compute/evidence'

export function computeAnalysis(
  marketData: MarketData,
  indicators: IndicatorResult,
  marketStructure: MarketStructureResult,
  supportResistance: SupportResistanceResult,
  volumeAnalysis: VolumeAnalysisResult,
  config?: Partial<AnalysisConfig>,
): MarketAnalysisResult {
  const cfg: AnalysisConfig = { ...DEFAULT_ANALYSIS_CONFIG, ...config }

  const price = extractPriceSummary(marketData, indicators)
  const currentPrice = price.current

  const fullTrend = synthesizeFullTrend(currentPrice, indicators, marketStructure, cfg)
  const emaContext = computeEMAContext(currentPrice, indicators, cfg)
  const indicatorSummary = interpretIndicators(currentPrice, indicators, cfg)
  const srContext = deriveSRContext(currentPrice, supportResistance, cfg)
  const volumeContext = buildVolumeContext(volumeAnalysis)
  const evidence = collectEvidence(
    fullTrend, emaContext, indicatorSummary, marketStructure, srContext, volumeContext, indicators, cfg,
  )

  return {
    symbol: marketData.symbol,
    timeframe: marketData.timeframe,
    analysedAt: marketData.fetchedAt,
    price,
    fullTrend,
    emaContext,
    indicatorSummary,
    srContext,
    volumeContext,
    evidence,
    indicators,
    marketStructure,
    supportResistance,
    volumeAnalysis,
  }
}

export type {
  MarketAnalysisResult,
  AnalysisConfig,
  PriceSummary,
  FullTrendResult,
  FullTrendLabel,
  TrendConditions,
  EMAContextResult,
  EMAConfluenceZone,
  EMAAlignmentState,
  EMALabel,
  IndicatorSummaryResult,
  RSIInterpretation,
  RSIClassification,
  MACDInterpretation,
  ADXInterpretation,
  ADXTrendStrength,
  BollingerInterpretation,
  BollingerBandwidthState,
  PriceVsBands,
  StochRSIInterpretation,
  SRContextResult,
  VolumeContextResult,
  ClimaxSignalType,
  EvidenceItem,
  EvidenceImpact,
  ModuleSource,
} from './types'

export { DEFAULT_ANALYSIS_CONFIG } from './config'
