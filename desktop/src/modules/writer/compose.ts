import type { MarketAnalysisResult } from '../analysis/types'
import type { ValidationResult } from '../validation/types'
import type { ConfidenceResult } from '../confidence/types'
import type { WriterConfig, WriterTemplate } from './types'
import {
  buildHeadline,
  buildSummary,
  buildTrendSection,
  buildIndicatorSection,
  buildMarketStructureSection,
  buildSupportResistanceSection,
  buildVolumeSection,
  buildRiskSection,
  buildConfidenceSection,
  buildValidationSection,
  buildConclusion,
} from './sections'

// ─── Section bundle ───────────────────────────────────────────────────────────

interface Sections {
  headline: string
  summary: string
  trendSection: string
  indicatorSection: string
  marketStructureSection: string
  supportResistanceSection: string
  volumeSection: string
  riskSection: string
  confidenceSection: string
  validationSection: string
  conclusion: string
}

// ─── Assemblers ───────────────────────────────────────────────────────────────

function composeFull(sections: Sections): string {
  const parts: string[] = []

  parts.push(`# ${sections.headline}`)
  parts.push('')

  if (sections.validationSection) {
    parts.push(`**${sections.validationSection}**`)
    parts.push('')
  }

  parts.push(sections.summary)
  parts.push('')

  parts.push('## Trend & EMA')
  parts.push(sections.trendSection)
  parts.push('')

  parts.push('## Market Structure')
  parts.push(sections.marketStructureSection)
  parts.push('')

  parts.push('## Momentum & Indicators')
  parts.push(sections.indicatorSection)
  parts.push('')

  parts.push('## Volume')
  parts.push(sections.volumeSection)
  parts.push('')

  parts.push('## Support & Resistance')
  parts.push(sections.supportResistanceSection)
  parts.push('')

  parts.push('## Risk Factors')
  parts.push(sections.riskSection)
  parts.push('')

  parts.push('## Confidence')
  parts.push(sections.confidenceSection)
  parts.push('')

  parts.push('## Conclusion')
  parts.push(sections.conclusion)

  return parts.join('\n').trim()
}

function composeExecutive(sections: Sections): string {
  const parts: string[] = []

  parts.push(sections.headline)
  parts.push('')

  if (sections.validationSection) {
    parts.push(sections.validationSection)
    parts.push('')
  }

  parts.push(sections.summary)
  parts.push('')
  parts.push(sections.trendSection)
  parts.push('')
  parts.push(sections.confidenceSection)
  parts.push('')
  parts.push(sections.riskSection)
  parts.push('')
  parts.push(sections.conclusion)

  return parts.join('\n').trim()
}

function composeSummaryTemplate(sections: Sections): string {
  const parts: string[] = []

  if (sections.validationSection) {
    parts.push(sections.validationSection + ' ')
  }

  parts.push(sections.summary)

  return parts.join('').trim()
}

function composeBullet(sections: Sections): string {
  const bullets: string[] = []

  if (sections.validationSection) {
    bullets.push(`• WARNING: ${sections.validationSection}`)
  }

  bullets.push(`• ${sections.headline}`)

  // Pull key sentences from sections
  const trendFirst = sections.trendSection.split('.')[0]
  if (trendFirst) bullets.push(`• ${trendFirst}.`)

  const indFirst = sections.indicatorSection.split('.')[0]
  if (indFirst) bullets.push(`• ${indFirst}.`)

  const volFirst = sections.volumeSection.split('.')[0]
  if (volFirst) bullets.push(`• ${volFirst}.`)

  const srFirst = sections.supportResistanceSection.split('.')[0]
  if (srFirst) bullets.push(`• ${srFirst}.`)

  const riskFirst = sections.riskSection.split('2.')[0].trim()
  if (riskFirst) bullets.push(`• Risk: ${riskFirst}`)

  return bullets.slice(0, 7).join('\n').trim()
}

function composeHeadlineTemplate(sections: Sections): string {
  return sections.headline
}

function composeSocial(sections: Sections): string {
  // Headline + 1-sentence summary + confidence + disclaimer
  const headlineClean = sections.headline
  const summaryFirst = sections.summary.split('.')[0]
  const confFirst = sections.confidenceSection.split('.')[0]

  return [headlineClean, summaryFirst + '.', confFirst + '.', 'Not financial advice.']
    .filter(Boolean)
    .join(' ')
    .trim()
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function composeReport(sections: Sections, template: WriterTemplate): string {
  switch (template) {
    case 'full':
      return composeFull(sections)
    case 'executive':
      return composeExecutive(sections)
    case 'summary':
      return composeSummaryTemplate(sections)
    case 'bullet':
      return composeBullet(sections)
    case 'headline':
      return composeHeadlineTemplate(sections)
    case 'social':
      return composeSocial(sections)
  }
}

// ─── Build all sections helper ────────────────────────────────────────────────

export function buildAllSections(
  analysis: MarketAnalysisResult,
  validation: ValidationResult,
  confidence: ConfidenceResult,
  cfg: WriterConfig,
): Sections {
  return {
    headline: buildHeadline(analysis, confidence),
    summary: buildSummary(analysis, confidence, cfg),
    trendSection: buildTrendSection(analysis),
    indicatorSection: buildIndicatorSection(analysis),
    marketStructureSection: buildMarketStructureSection(analysis),
    supportResistanceSection: buildSupportResistanceSection(analysis),
    volumeSection: buildVolumeSection(analysis),
    riskSection: buildRiskSection(analysis, confidence, cfg),
    confidenceSection: buildConfidenceSection(confidence, cfg),
    validationSection: buildValidationSection(validation),
    conclusion: buildConclusion(analysis, confidence),
  }
}
