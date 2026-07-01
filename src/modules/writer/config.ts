import type { WriterConfig } from './types'

export const DEFAULT_WRITER_CONFIG: WriterConfig = {
  template: 'full',
  verbosity: 'standard',
  maxSummaryLength: 600,
  maxReportLength: 4000,
  includeValidationSection: true,
  includeConfidenceSection: true,
  includeWarnings: true,
  maxReasonsDisplayed: 3,
  maxRiskFactors: 3,
}
