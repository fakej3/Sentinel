// Re-export engine types used by the UI layer
export type {
  PipelineResult, PipelineMetadata, PipelineTimings,
  TradeDecision, TradeDecisionLabel,
  MarketPhase, MarketContext,
  InvalidationSeverity, InvalidationType, InvalidationScenario,
  DecisionDimensionStatus, DecisionDimension, DecisionExplanation,
  DecisionQuality,
  ConfidenceExplanation,
  MarketStory,
  ContradictionSeverity, ContradictionCategory, ContradictionIntelligence,
  TraderVerdict, TraderReview,
  QualityLevel, OpportunityAssessment,
  SanityFlag, ConfidenceSanityResult,
  MTFAgreementLabel, MTFTimeframeInput, MultiTimeframeAgreement,
} from '../modules/pipeline/types'
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
  ConfidenceBreakdown,
  TrustFactor,
  TrustResult,
  EvidenceQualityRating,
  EvidenceQuality,
  ConfluenceResult,
  ContradictionGroup,
  IndicatorReliabilityContext,
  AnalysisQuality,
} from '../modules/confidence/types'
export type {
  GeneratedAnalysis,
  WriterMetadata,
  WriterTemplate,
} from '../modules/writer/types'
export type { IndicatorResult } from '../modules/indicators/types'
export type { TradePlan, TradeSetupQuality } from '../modules/pipeline/types'
export type { FibResult, FibLevel, FibDirection } from '../modules/fibonacci/types'

// ── UI-specific types ──────────────────────────────────────────────────────────

export interface RecentAnalysis {
  symbol: string
  interval: string
  timestamp: number
  grade: string
  score: number
  decision?: string
  bias?: string
}

export type { HistoryMeta, HistoryEntry } from './transport'

export type AppTab =
  | 'summary'
  | 'trade'
  | 'overview'
  | 'evidence'
  | 'indicators'
  | 'structure'
  | 'volume'
  | 'validation'
  | 'writer'

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
