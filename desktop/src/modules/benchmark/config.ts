import type { ComparisonConfig } from './types'

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  numericTolerance: 0.001,
  ignoredPaths: [
    'metadata.timestamp',
    'metadata.executionTime',
    'metadata.timings',
    'metadata.timings.fetch',
    'metadata.timings.indicators',
    'metadata.timings.marketStructure',
    'metadata.timings.supportResistance',
    'metadata.timings.volume',
    'metadata.timings.analysis',
    'metadata.timings.validation',
    'metadata.timings.confidence',
    'metadata.timings.writer',
    'metadata.timings.total',
    'analysis.analysedAt',
  ],
}
