/**
 * Module 39 — Improvement candidates.
 *
 * Promotes filter simulation results to actionable recommendations only when:
 *   - The filter removes proportionally more losers than winners (selectivity > 0.55)
 *   - Expectancy improves after filtering
 *   - There is sufficient sample size (≥ 10 resolved trades in "after" set)
 *
 * Includes a 95 % Wilson confidence interval for the post-filter win rate.
 */
import type { AttributedRecord, FilterSimulationResult, ImprovementCandidate } from './types'
import { simulateFilters } from './filters'

// ── Wilson CI ─────────────────────────────────────────────────────────────────

function wilsonCI(
  wins: number,
  total: number,
  z = 1.96,
): { low: number; high: number } | null {
  if (total === 0) return null
  const p   = wins / total
  const denom = 1 + (z * z) / total
  const centre = p + (z * z) / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))
  return {
    low:  Math.max(0, (centre - margin) / denom),
    high: Math.min(1, (centre + margin) / denom),
  }
}

// ── Evidence strength ─────────────────────────────────────────────────────────

function evidenceStrength(
  n: number,
  selectivity: number,
): 'strong' | 'moderate' | 'weak' {
  if (n >= 30 && selectivity >= 0.70) return 'strong'
  if (n >= 15 && selectivity >= 0.60) return 'moderate'
  return 'weak'
}

// ── Recommendation text ───────────────────────────────────────────────────────

function buildRecommendation(
  label: string,
  delta: number,
  selectivity: number,
  strength: 'strong' | 'moderate' | 'weak',
): string {
  const improvement = (delta * 100).toFixed(2)
  const pctLosers   = (selectivity * 100).toFixed(0)
  const qualifier   = strength === 'strong'   ? 'Strongly recommend'
                    : strength === 'moderate' ? 'Consider'
                    : 'Tentatively consider'
  return `${qualifier} applying "${label}": removes ${pctLosers}% losers, improves expectancy by ${improvement}R.`
}

// ── Public API ────────────────────────────────────────────────────────────────

const MIN_AFTER_RESOLVED = 10
const MIN_SELECTIVITY    = 0.55

export function deriveImprovementCandidates(
  records: AttributedRecord[],
): ImprovementCandidate[] {
  const simResults: FilterSimulationResult[] = simulateFilters(records)

  const candidates: ImprovementCandidate[] = []

  for (const r of simResults) {
    if (!r.improvesExpectancy) continue
    if (r.selectivity === null || r.selectivity < MIN_SELECTIVITY) continue
    if (r.expectancyDelta === null || r.expectancyDelta <= 0) continue

    const afterResolved = r.after.winCount + r.after.lossCount
    if (afterResolved < MIN_AFTER_RESOLVED) continue

    const expectancyBefore = r.before.expectancy ?? 0
    const expectancyAfter  = r.after.expectancy  ?? 0

    const ci = wilsonCI(r.after.winCount, afterResolved)

    const strength = evidenceStrength(afterResolved, r.selectivity)
    const recommendation = buildRecommendation(
      r.label,
      r.expectancyDelta,
      r.selectivity,
      strength,
    )

    candidates.push({
      filterId:          r.filterId,
      label:             r.label,
      winsRemoved:       r.winsRemoved,
      lossesRemoved:     r.lossesRemoved,
      selectivity:       r.selectivity,
      expectancyBefore,
      expectancyAfter,
      expectancyDelta:   r.expectancyDelta,
      ciLow:             ci?.low  ?? null,
      ciHigh:            ci?.high ?? null,
      evidenceStrength:  strength,
      recommendation,
    })
  }

  // Sort by expectancy improvement descending
  return candidates.sort((a, b) => b.expectancyDelta - a.expectancyDelta)
}
