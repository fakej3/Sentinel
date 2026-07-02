// Re-export engine types used by the UI layer
export type { PipelineResult, PipelineMetadata, PipelineTimings } from '../modules/pipeline/types'
export type {
  MarketAnalysisResult,
  PriceSummary,
  FullTrendResult,
  FullTrendLabel,
  EMAContextResult,
  EMAAlignmentState,
  IndicatorSummaryResult,
  RSIInterpretation,
  MACDInterpretation,
  ADXInterpretation,
  BollingerInterpretation,
  StochRSIInterpretation,
  SRContextResult,
  VolumeContextResult,
  EvidenceItem,
  EvidenceImpact,
  EvidenceDirection,
  ModuleSource,
} from '../modules/analysis/types'
export type {
  MarketStructureResult,
  SwingPoint,
  StructureEvent,
  StructureCounts,
  ConsolidationResult,
  BreakoutResult,
  PullbackResult,
  TrendDirection,
  TrendStrength,
} from '../modules/market-structure/types'
export type {
  SupportResistanceResult,
  PriceZone,
  ZoneState,
} from '../modules/support-resistance/types'
export type {
  VolumeAnalysisResult,
  RelativeVolumeResult,
  VolumeTrendResult,
  BuySellPressureResult,
  VolumeConfirmationResult,
  ClimaxResult,
  AccumulationDistributionResult,
  OBVAnalysisResult,
  VWAPAnalysisResult,
  VolumeClassification,
  AccDistState,
  OBVDirection,
} from '../modules/volume-analysis/types'
export type {
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  ValidationCategory,
} from '../modules/validation/types'
export type {
  ConfidenceResult,
  ConfidenceGrade,
  ConfidenceReason,
  ConfidencePenalty,
  ConfidenceWarning,
} from '../modules/confidence/types'
export type {
  GeneratedAnalysis,
  WriterMetadata,
  WriterTemplate,
} from '../modules/writer/types'
export type { IndicatorResult } from '../modules/indicators/types'

// ── UI-specific types ──────────────────────────────────────────────────────────

export interface RecentAnalysis {
  symbol: string
  interval: string
  timestamp: number
  grade: string
  score: number
}

export type AppTab =
  | 'overview'
  | 'evidence'
  | 'indicators'
  | 'structure'
  | 'volume'
  | 'validation'
  | 'writer'
  | 'benchmark'

export type AppPage =
  | 'dashboard'
  | 'chart'
  | 'analysis'
  | 'watchlist'
  | 'history'
  | 'settings'

export interface AnalyzeParams {
  symbol: string
  interval: string
  candleLimit?: number
}
