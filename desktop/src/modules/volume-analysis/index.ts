/**
 * Volume Analysis Engine — synthesizes nine volume sub-analyses into a single
 * result that feeds the Analysis Engine's volume context and evidence.
 *
 * Inputs:  Candle[], IndicatorResult, MarketStructureResult,
 *          SupportResistanceResult, VolumeAnalysisConfig
 * Outputs: VolumeAnalysisResult (relativeVolume, volumeTrend, buySellPressure,
 *          volumeConfirmation, climax, accumulationDistribution,
 *          obvAnalysis, vwapAnalysis, overallStrength, evidence[])
 * Deps:    binance, indicators, market-structure, support-resistance
 */
import type { Candle } from '../market/types'
import type { IndicatorResult } from '../indicators/types'
import type { MarketStructureResult } from '../market-structure/types'
import type { SupportResistanceResult } from '../support-resistance/types'
import type { VolumeAnalysisResult, VolumeAnalysisConfig } from './types'
import { DEFAULT_CONFIG } from './config'
import { computeRelativeVolume } from './compute/relative-volume'
import { computeVolumeTrend } from './compute/volume-trend'
import { computeBuySellPressure } from './compute/buy-sell-pressure'
import { computeVolumeConfirmation } from './compute/volume-confirmation'
import { computeClimax } from './compute/climax'
import { computeAccumulationDistribution } from './compute/accumulation-distribution'
import { computeOBVAnalysis } from './compute/obv-analysis'
import { computeVWAPAnalysis } from './compute/vwap-analysis'
import { computeOverallStrength } from './compute/strength'
import { buildEvidence } from './compute/evidence'

export function computeVolumeAnalysis(
  candles: Candle[],
  indicators: IndicatorResult,
  marketStructure: MarketStructureResult,
  supportResistance: SupportResistanceResult,
  config?: Partial<VolumeAnalysisConfig>,
): VolumeAnalysisResult {
  const cfg: VolumeAnalysisConfig = { ...DEFAULT_CONFIG, ...config }

  const relativeVolume = computeRelativeVolume(candles, indicators, cfg)
  const volumeTrend = computeVolumeTrend(candles, cfg)
  const buySellPressure = computeBuySellPressure(candles, cfg)
  const volumeConfirmation = computeVolumeConfirmation(
    candles, relativeVolume, marketStructure, cfg,
  )
  const climax = computeClimax(candles, relativeVolume.ratio, cfg)
  const obvAnalysis = computeOBVAnalysis(candles, cfg)
  const vwapAnalysis = computeVWAPAnalysis(candles, indicators, cfg)
  const accumulationDistribution = computeAccumulationDistribution(
    marketStructure, supportResistance, buySellPressure, obvAnalysis, vwapAnalysis,
  )
  const overallStrength = computeOverallStrength(
    relativeVolume, volumeTrend, buySellPressure, obvAnalysis, accumulationDistribution,
  )
  const evidence = buildEvidence(
    relativeVolume, volumeTrend, buySellPressure, volumeConfirmation,
    climax, accumulationDistribution, obvAnalysis, vwapAnalysis, overallStrength,
  )

  return {
    volumeTrend,
    relativeVolume,
    buySellPressure,
    volumeConfirmation,
    climax,
    accumulationDistribution,
    obvAnalysis,
    vwapAnalysis,
    overallStrength,
    evidence,
  }
}

export type {
  VolumeAnalysisResult,
  VolumeAnalysisConfig,
  RelativeVolumeResult,
  VolumeTrendResult,
  BuySellPressureResult,
  VolumeConfirmationResult,
  ClimaxResult,
  AccumulationDistributionResult,
  OBVAnalysisResult,
  VWAPAnalysisResult,
  VolumeClassification,
  VolumeTrendDirection,
  DominantSide,
  AccDistState,
  OBVDirection,
} from './types'
