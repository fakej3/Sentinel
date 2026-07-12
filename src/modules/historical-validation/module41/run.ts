/**
 * Module 41 — Trade Maturity Score Validation
 *
 * Runs Module 38 walk-forward validation with the current pipeline (which
 * now computes maturityScore for every TradePlan), then slices the resolved
 * trades by maturity tier to produce a before/after comparison.
 *
 * Before: current engine — all actionable trades pass through.
 * After:  engine + Immature gate — score < 30 blocked as 'poor'.
 *
 * Usage:
 *   npx ts-node -e "require('./src/modules/historical-validation/module41/run').runModule41()"
 */
import { writeFileSync } from 'node:fs'
import type { ValidationRecord } from '../types'
import type { MaturityLabel } from '../../pipeline/compute/trade-maturity'
import { runModule38 } from '../module38/run'
import { generateModule41Report } from './report'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MaturityTier = 'immature' | 'early' | 'developing' | 'mature' | 'peak'

export interface TierStats {
  tier: MaturityTier
  scoreRange: string
  tradeCount: number
  wins: number
  losses: number
  winRate: number | null
  avgSetupRR: number | null
  expectancy: number | null
  profitFactor: number | null
}

export interface EngineStats {
  label: string
  tradeCount: number
  wins: number
  losses: number
  winRate: number | null
  expectancy: number | null
  profitFactor: number | null
  avgSetupRR: number | null
  rejectedCount: number
  savedLosses: number
}

export interface Module41Output {
  tierStats: TierStats[]
  before: EngineStats
  after: EngineStats
  /** Distribution of rejected trades by setup quality */
  rejectedByQuality: Record<string, number>
  /** Maturity components of saved losses (to show what was wrong) */
  savedLossComponents: {
    avgMomentum: number
    avgVolume: number
    avgTrend: number
    avgStructure: number
    avgConfidence: number
  }
  html: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierFor(score: number): MaturityTier {
  if (score >= 75) return 'peak'
  if (score >= 60) return 'mature'
  if (score >= 45) return 'developing'
  if (score >= 30) return 'early'
  return 'immature'
}

function expectancy(wins: number, losses: number, avgRR: number | null): number | null {
  const total = wins + losses
  if (total === 0 || avgRR === null) return null
  const wr = wins / total
  return wr * avgRR - (1 - wr) * 1.0
}

function profitFactor(wins: number, losses: number, avgRR: number | null): number | null {
  if (losses === 0 || avgRR === null) return wins > 0 ? Infinity : null
  return (wins * avgRR) / losses
}

function statsFor(records: ValidationRecord[], label: string, rejectedCount = 0, savedLosses = 0): EngineStats {
  const wins   = records.filter(r => r.outcome.result === 'tp_hit')
  const losses = records.filter(r => r.outcome.result === 'sl_hit')
  const w = wins.length
  const l = losses.length
  const total = w + l
  const wr = total > 0 ? w / total : null
  const rrVals = wins.map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio).filter((v): v is number => v !== null)
  const avgRR = rrVals.length > 0 ? rrVals.reduce((a, b) => a + b, 0) / rrVals.length : null
  return {
    label,
    tradeCount: total,
    wins: w, losses: l,
    winRate: wr,
    expectancy: expectancy(w, l, avgRR),
    profitFactor: profitFactor(w, l, avgRR),
    avgSetupRR: avgRR,
    rejectedCount,
    savedLosses,
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runModule41(options?: {
  outputPath?: string
  verbose?: boolean
}): Promise<Module41Output> {
  const { outputPath, verbose = false } = options ?? {}

  if (verbose) console.log('\nModule 41 — Trade Maturity Score Validation')
  if (verbose) console.log('Running Module 38 with maturity-enabled pipeline...\n')

  const { results } = await runModule38({ verbose })

  // Flatten all records
  const allRecords: ValidationRecord[] = results.flatMap(r => r.records)

  // Resolved actionable trades only (tp_hit or sl_hit)
  const resolved = allRecords.filter(r =>
    r.outcome.result === 'tp_hit' || r.outcome.result === 'sl_hit',
  )

  // ── Per-tier stats ─────────────────────────────────────────────────────────
  const TIERS: { tier: MaturityTier; range: string; min: number; max: number }[] = [
    { tier: 'immature',   range: '0–29',   min: 0,  max: 29  },
    { tier: 'early',      range: '30–44',  min: 30, max: 44  },
    { tier: 'developing', range: '45–59',  min: 45, max: 59  },
    { tier: 'mature',     range: '60–74',  min: 60, max: 74  },
    { tier: 'peak',       range: '75–100', min: 75, max: 100 },
  ]

  const tierStats: TierStats[] = TIERS.map(({ tier, range, min, max }) => {
    const recs = resolved.filter(r => {
      const s = r.snapshot.pipeline.tradePlan.maturityScore
      return s >= min && s <= max
    })
    const wins   = recs.filter(r => r.outcome.result === 'tp_hit').length
    const losses = recs.filter(r => r.outcome.result === 'sl_hit').length
    const wr     = wins + losses > 0 ? wins / (wins + losses) : null
    const rrVals = recs
      .filter(r => r.outcome.result === 'tp_hit')
      .map(r => r.snapshot.pipeline.tradePlan.riskRewardRatio)
      .filter((v): v is number => v !== null)
    const avgRR  = rrVals.length > 0 ? rrVals.reduce((a, b) => a + b, 0) / rrVals.length : null
    return {
      tier,
      scoreRange: range,
      tradeCount: recs.length,
      wins, losses,
      winRate: wr,
      avgSetupRR: avgRR,
      expectancy: expectancy(wins, losses, avgRR),
      profitFactor: profitFactor(wins, losses, avgRR),
    }
  })

  // ── Before/After comparison ────────────────────────────────────────────────
  const beforeRecords = resolved
  const afterRecords  = resolved.filter(r => r.snapshot.pipeline.tradePlan.maturityScore >= 30)
  const immatureRecs  = resolved.filter(r => r.snapshot.pipeline.tradePlan.maturityScore < 30)
  const savedLosses   = immatureRecs.filter(r => r.outcome.result === 'sl_hit').length

  const before = statsFor(beforeRecords, 'Current engine')
  const after  = statsFor(afterRecords,  'Engine + Immature gate', immatureRecs.length, savedLosses)

  // ── Distribution of rejected trades by setup quality ──────────────────────
  const rejectedByQuality: Record<string, number> = {}
  for (const r of immatureRecs) {
    const q = r.snapshot.pipeline.tradePlan.setupQuality
    rejectedByQuality[q] = (rejectedByQuality[q] ?? 0) + 1
  }

  // ── Component breakdown of saved losses (what made them immature) ──────────
  const savedLossRecs = immatureRecs.filter(r => r.outcome.result === 'sl_hit')
  let savedLossComponents = { avgMomentum: 0, avgVolume: 0, avgTrend: 0, avgStructure: 0, avgConfidence: 0 }
  if (savedLossRecs.length > 0) {
    const n = savedLossRecs.length
    savedLossComponents = {
      avgMomentum:   savedLossRecs.reduce((s, r) => s + r.snapshot.pipeline.tradePlan.maturityComponents.momentum,   0) / n,
      avgVolume:     savedLossRecs.reduce((s, r) => s + r.snapshot.pipeline.tradePlan.maturityComponents.volume,     0) / n,
      avgTrend:      savedLossRecs.reduce((s, r) => s + r.snapshot.pipeline.tradePlan.maturityComponents.trend,      0) / n,
      avgStructure:  savedLossRecs.reduce((s, r) => s + r.snapshot.pipeline.tradePlan.maturityComponents.structure,  0) / n,
      avgConfidence: savedLossRecs.reduce((s, r) => s + r.snapshot.pipeline.tradePlan.maturityComponents.confidence, 0) / n,
    }
  }

  if (verbose) {
    console.log('\n── Tier Summary ────────────────────────────────────────────')
    for (const t of tierStats) {
      const wr = t.winRate !== null ? `${(t.winRate * 100).toFixed(1)}%` : 'n/a'
      const ex = t.expectancy !== null ? t.expectancy.toFixed(3) : 'n/a'
      console.log(`  ${t.tier.padEnd(11)} [${t.scoreRange.padStart(5)}] ` +
        `${String(t.tradeCount).padStart(4)} trades  WR=${wr.padStart(6)}  E=${ex}`)
    }
    const bwr = before.winRate !== null ? `${(before.winRate * 100).toFixed(1)}%` : 'n/a'
    const awr = after.winRate  !== null ? `${(after.winRate  * 100).toFixed(1)}%` : 'n/a'
    const bex = before.expectancy !== null ? before.expectancy.toFixed(3) : 'n/a'
    const aex = after.expectancy  !== null ? after.expectancy.toFixed(3)  : 'n/a'
    console.log('\n── Before vs After ─────────────────────────────────────────')
    console.log(`  Before: ${before.tradeCount} trades  WR=${bwr}  E=${bex}`)
    console.log(`  After:  ${after.tradeCount} trades  WR=${awr}  E=${aex}`)
    console.log(`  Rejected: ${immatureRecs.length} (${savedLosses} losses saved, ${immatureRecs.length - savedLosses} wins blocked)`)
  }

  const html = generateModule41Report({ tierStats, before, after, rejectedByQuality, savedLossComponents })

  if (outputPath) {
    writeFileSync(outputPath, html, 'utf-8')
    if (verbose) console.log(`\nReport written to: ${outputPath}`)
  }

  return { tierStats, before, after, rejectedByQuality, savedLossComponents, html }
}
