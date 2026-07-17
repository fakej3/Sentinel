import type { PipelineConfig } from './types'

export const PIPELINE_VERSION = '0.12.0'

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  minCandleCount: 50,
  marketStructure: {},
  supportResistance: {},
  volumeAnalysis: {},
  analysis: {},
  validation: {},
  confidence: {},
  writer: {},
}
