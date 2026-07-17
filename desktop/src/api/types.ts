import type { PipelineOptions, PipelineResult } from '../modules/pipeline/types'

export type AnalyzeFn = (options: PipelineOptions) => Promise<PipelineResult>

export interface AnalyzeRequest {
  symbol: string
  interval: string
  candleLimit?: number
  config?: Record<string, unknown>
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    module?: string
  }
}
