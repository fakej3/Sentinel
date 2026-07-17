import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { ContradictionIntelligence, ContradictionCategory, ContradictionSeverity } from '../types'

const CATEGORY_ORDER = [
  'Trend',
  'Momentum',
  'Volume',
  'Structure',
  'Support/Resistance',
  'Validation',
]

/**
 * Maps existing ContradictionGroup data into a per-category severity breakdown.
 * Adds Validation as an extra category based on validation issues.
 * Does NOT modify confidence scores.
 */
export function computeContradictionIntelligence(
  confidence: ConfidenceResult,
  validation: ValidationResult,
): ContradictionIntelligence {
  const categories: ContradictionCategory[] = []

  // Map confidence contradictions to our 6 categories
  const mapped = new Map<string, ContradictionCategory>()

  for (const group of confidence.analysisQuality.contradictions) {
    const category = normalizeCategory(group.category)
    const severity = mapSeverity(group.severity)
    const existing = mapped.get(category)
    if (!existing || severityRank(severity) > severityRank(existing.severity)) {
      mapped.set(category, {
        category,
        severity,
        detail: group.description,
      })
    }
  }

  // Add Validation category from validation result
  if (validation.criticalCount > 0) {
    mapped.set('Validation', {
      category: 'Validation',
      severity: 'major',
      detail: `${validation.criticalCount} critical validation issue(s) detected.`,
    })
  } else if (validation.warningCount > 0) {
    mapped.set('Validation', {
      category: 'Validation',
      severity: 'minor',
      detail: `${validation.warningCount} validation warning(s) present.`,
    })
  }

  // Build result in canonical order, filling missing categories with 'none'
  for (const cat of CATEGORY_ORDER) {
    const found = mapped.get(cat)
    categories.push(found ?? { category: cat, severity: 'none', detail: 'No contradictions detected.' })
  }

  // Overall severity = worst across all categories
  const overallSeverity = categories.reduce<ContradictionSeverity>((worst, c) => {
    return severityRank(c.severity) > severityRank(worst) ? c.severity : worst
  }, 'none')

  const summary = buildSummary(overallSeverity, categories)

  return { categories, overallSeverity, summary }
}

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('trend') || lower.includes('ema') || lower.includes('directional')) return 'Trend'
  if (lower.includes('momentum') || lower.includes('rsi') || lower.includes('macd') || lower.includes('stoch')) return 'Momentum'
  if (lower.includes('volume') || lower.includes('obv') || lower.includes('vwap') || lower.includes('acc')) return 'Volume'
  if (lower.includes('structure') || lower.includes('swing') || lower.includes('bos') || lower.includes('choch')) return 'Structure'
  if (lower.includes('support') || lower.includes('resistance') || lower.includes('zone')) return 'Support/Resistance'
  return 'Momentum' // fallback for miscellaneous indicator contradictions
}

function mapSeverity(raw: 'strong' | 'moderate' | 'mild'): ContradictionSeverity {
  switch (raw) {
    case 'strong':   return 'major'
    case 'moderate': return 'moderate'
    case 'mild':     return 'minor'
  }
}

function severityRank(s: ContradictionSeverity): number {
  switch (s) {
    case 'none':     return 0
    case 'minor':    return 1
    case 'moderate': return 2
    case 'major':    return 3
  }
}

function buildSummary(overall: ContradictionSeverity, cats: ContradictionCategory[]): string {
  const activeCount = cats.filter(c => c.severity !== 'none').length
  if (overall === 'none') {
    return 'No significant contradictions detected across signal categories.'
  }
  if (overall === 'minor') {
    return `Minor contradictions in ${activeCount} category(ies) — signal is mostly clear.`
  }
  if (overall === 'moderate') {
    const affected = cats.filter(c => severityRank(c.severity) >= severityRank('moderate')).map(c => c.category)
    return `Moderate contradictions in ${affected.join(', ')} — verify alignment before acting.`
  }
  // major
  const affected = cats.filter(c => c.severity === 'major').map(c => c.category)
  return `Major contradictions in ${affected.join(', ')} — conflicting signals, high caution warranted.`
}
