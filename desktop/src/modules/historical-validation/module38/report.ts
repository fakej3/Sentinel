/**
 * Module 38 — HTML production readiness report.
 *
 * Generates a fully self-contained HTML page (no external resources)
 * with comprehensive statistics, calibration tables, SVG charts,
 * and a production readiness verdict.
 */
import type { CalibrationDashboard } from '../types'
import type { DatasetResult, ExtendedMetrics } from './extended-metrics'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number | null, decimals = 1): string {
  return n === null ? '—' : `${(n * 100).toFixed(decimals)}%`
}
function num(n: number | null, decimals = 2): string {
  return n === null ? '—' : n.toFixed(decimals)
}
function scoreColor(wr: number | null): string {
  if (wr === null) return '#6b7280'
  if (wr >= 0.60) return '#22c55e'
  if (wr >= 0.50) return '#f59e0b'
  return '#ef4444'
}
function verdictColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 55) return '#f59e0b'
  if (score >= 35) return '#f97316'
  return '#ef4444'
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function fmtDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

// ── SVG bar chart ─────────────────────────────────────────────────────────────

interface BarData { label: string; value: number; color?: string }

function svgBarChart(
  bars: BarData[],
  title: string,
  maxValue: number,
  width = 560,
  height = 220,
): string {
  const marginLeft  = 130
  const marginRight = 20
  const marginTop   = 30
  const marginBottom = 30
  const chartW = width - marginLeft - marginRight
  const chartH = height - marginTop - marginBottom
  const barH   = Math.max(12, Math.floor((chartH / Math.max(1, bars.length)) * 0.7))
  const gap    = Math.floor((chartH / Math.max(1, bars.length)) * 0.3)

  let svgBars = ''
  for (let i = 0; i < bars.length; i++) {
    const { label, value, color = '#3b82f6' } = bars[i]
    const barW    = Math.round((value / Math.max(0.001, maxValue)) * chartW)
    const y       = marginTop + i * (barH + gap)
    const labelX  = marginLeft - 6
    svgBars += `
      <text x="${labelX}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="11" fill="#9ca3af">${esc(label)}</text>
      <rect x="${marginLeft}" y="${y}" width="${Math.max(2, barW)}" height="${barH}" fill="${color}" rx="2"/>
      <text x="${marginLeft + Math.max(2, barW) + 4}" y="${y + barH / 2 + 4}" font-size="11" fill="#d1d5db">${typeof value === 'number' ? value.toFixed(1) : value}%</text>
    `
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;overflow:hidden">
    <text x="${width / 2}" y="18" text-anchor="middle" font-size="12" font-weight="600" fill="#d1d5db">${esc(title)}</text>
    <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${height - marginBottom}" stroke="#374151" stroke-width="1"/>
    ${svgBars}
  </svg>`
}

// ── Confidence calibration table ──────────────────────────────────────────────

function confCalibTable(dashboards: CalibrationDashboard[]): string {
  // Aggregate across all dashboards
  const bucketMap = new Map<string, { wins: number; losses: number; total: number }>()
  for (const d of dashboards) {
    for (const b of d.confidence.buckets) {
      const key = b.label
      const e   = bucketMap.get(key) ?? { wins: 0, losses: 0, total: 0 }
      e.wins   += b.wins
      e.losses += b.losses
      e.total  += b.totalTrades
      bucketMap.set(key, e)
    }
  }

  const BUCKET_ORDER = ['9-10','8-9','7-8','6-7','5-6','4-5','3-4','2-3','1-2','0-1']
  let rows = ''
  for (const label of BUCKET_ORDER) {
    const e = bucketMap.get(label)
    if (!e || e.total === 0) continue
    const resolved = e.wins + e.losses
    const wr = resolved > 0 ? e.wins / resolved : null
    const c  = scoreColor(wr)
    rows += `<tr>
      <td>${label}</td>
      <td>${e.total}</td>
      <td>${e.wins}</td>
      <td>${e.losses}</td>
      <td style="color:${c};font-weight:600">${pct(wr)}</td>
    </tr>`
  }
  return `<table class="data-table">
    <thead><tr><th>Confidence</th><th>Trades</th><th>Wins</th><th>Losses</th><th>Win Rate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Per-symbol summary table ──────────────────────────────────────────────────

function perSymbolTable(metrics: ExtendedMetrics): string {
  const bySymbol = new Map<string, typeof metrics.datasets[0][]>()
  for (const d of metrics.datasets) {
    const e = bySymbol.get(d.symbol) ?? []
    e.push(d)
    bySymbol.set(d.symbol, e)
  }

  let rows = ''
  for (const [symbol, datasets] of bySymbol) {
    const totalSnaps  = datasets.reduce((s, d) => s + d.totalSnapshots, 0)
    const totalAct    = datasets.reduce((s, d) => s + d.actionableCount, 0)
    const totalWins   = datasets.reduce((s, d) => s + d.winCount, 0)
    const totalLosses = datasets.reduce((s, d) => s + d.lossCount, 0)
    const resolved    = totalWins + totalLosses
    const wr          = resolved > 0 ? totalWins / resolved : null
    const avgRR       = datasets.map(d => d.avgSetupRR).filter((v): v is number => v !== null)
    const avgRRVal    = avgRR.length > 0 ? avgRR.reduce((s, v) => s + v, 0) / avgRR.length : null
    const exp         = avgRR.length > 0 && wr !== null
      ? wr * (avgRRVal ?? 1) - (1 - wr) * 1.0 : null

    rows += `<tr>
      <td style="font-weight:600">${symbol}</td>
      <td>${totalSnaps}</td>
      <td>${totalAct} (${pct(totalAct / Math.max(1, totalSnaps), 0)})</td>
      <td>${totalWins}</td>
      <td>${totalLosses}</td>
      <td style="color:${scoreColor(wr)};font-weight:600">${pct(wr)}</td>
      <td>${num(avgRRVal)}</td>
      <td style="color:${exp !== null && exp >= 0 ? '#22c55e' : '#ef4444'}">${num(exp)}</td>
    </tr>`
  }

  return `<table class="data-table">
    <thead><tr>
      <th>Symbol</th><th>Snapshots</th><th>Actionable</th>
      <th>Wins</th><th>Losses</th><th>Win Rate</th>
      <th>Avg R:R</th><th>Expectancy</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Per-timeframe summary ─────────────────────────────────────────────────────

function perTimeframeTable(metrics: ExtendedMetrics): string {
  const tfMap = new Map<string, typeof metrics.datasets[0][]>()
  for (const d of metrics.datasets) {
    const e = tfMap.get(d.timeframe) ?? []
    e.push(d)
    tfMap.set(d.timeframe, e)
  }

  let rows = ''
  for (const tf of ['15m', '1h', '4h']) {
    const datasets = tfMap.get(tf)
    if (!datasets || datasets.length === 0) continue
    const totalSnaps  = datasets.reduce((s, d) => s + d.totalSnapshots, 0)
    const totalAct    = datasets.reduce((s, d) => s + d.actionableCount, 0)
    const totalWins   = datasets.reduce((s, d) => s + d.winCount, 0)
    const totalLosses = datasets.reduce((s, d) => s + d.lossCount, 0)
    const resolved    = totalWins + totalLosses
    const wr          = resolved > 0 ? totalWins / resolved : null
    const avgRR       = datasets.map(d => d.avgSetupRR).filter((v): v is number => v !== null)
    const avgRRVal    = avgRR.length > 0 ? avgRR.reduce((s, v) => s + v, 0) / avgRR.length : null
    const exp         = avgRR.length > 0 && wr !== null
      ? wr * (avgRRVal ?? 1) - (1 - wr) * 1.0 : null

    rows += `<tr>
      <td style="font-weight:600">${tf}</td>
      <td>${totalSnaps}</td>
      <td>${totalAct} (${pct(totalAct / Math.max(1, totalSnaps), 0)})</td>
      <td>${totalWins}</td>
      <td>${totalLosses}</td>
      <td style="color:${scoreColor(wr)};font-weight:600">${pct(wr)}</td>
      <td>${num(avgRRVal)}</td>
      <td style="color:${exp !== null && exp >= 0 ? '#22c55e' : '#ef4444'}">${num(exp)}</td>
    </tr>`
  }

  return `<table class="data-table">
    <thead><tr>
      <th>Timeframe</th><th>Snapshots</th><th>Actionable</th>
      <th>Wins</th><th>Losses</th><th>Win Rate</th>
      <th>Avg R:R</th><th>Expectancy</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Regime stats table ────────────────────────────────────────────────────────

function regimeTable(metrics: ExtendedMetrics): string {
  const sorted = [...metrics.regimeStats].sort((a, b) => {
    const wa = a.winRate ?? 0
    const wb = b.winRate ?? 0
    return wb - wa
  })

  let rows = ''
  for (const r of sorted) {
    if (r.totalSnapshots === 0) continue
    rows += `<tr>
      <td>${r.label}</td>
      <td>${r.totalSnapshots}</td>
      <td>${r.actionableCount}</td>
      <td>${r.winCount}</td>
      <td>${r.lossCount}</td>
      <td style="color:${scoreColor(r.winRate)};font-weight:600">${pct(r.winRate)}</td>
    </tr>`
  }

  return `<table class="data-table">
    <thead><tr>
      <th>Market Regime</th><th>Snapshots</th><th>Actionable</th>
      <th>Wins</th><th>Losses</th><th>Win Rate</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── MTF agreement table ───────────────────────────────────────────────────────

function mtfTable(metrics: ExtendedMetrics): string {
  const LABELS: Record<string, string> = {
    aligned:        'All timeframes aligned',
    mostly_aligned: 'Mostly aligned (3/3)',
    mixed:          'Mixed signals',
    strong_conflict:'Strong conflict',
  }

  let rows = ''
  for (const r of metrics.mtfAgreementStats) {
    rows += `<tr>
      <td>${LABELS[r.agreement] ?? r.agreement}</td>
      <td>${r.count}</td>
      <td>${r.wins}</td>
      <td>${r.losses}</td>
      <td style="color:${scoreColor(r.winRate)};font-weight:600">${pct(r.winRate)}</td>
    </tr>`
  }

  if (!rows) rows = `<tr><td colspan="5" style="text-align:center;color:#6b7280">No MTF data available (need ≥2 timeframes per symbol)</td></tr>`

  return `<table class="data-table">
    <thead><tr>
      <th>MTF Agreement</th><th>Position Bins</th><th>Wins</th><th>Losses</th><th>Win Rate</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Loss category table ───────────────────────────────────────────────────────

function lossCatTable(metrics: ExtendedMetrics): string {
  let rows = ''
  for (const r of metrics.lossCategoryBreakdown) {
    rows += `<tr>
      <td>${r.label}</td>
      <td>${r.count}</td>
      <td>${r.pct.toFixed(1)}%</td>
    </tr>`
  }

  if (!rows) rows = `<tr><td colspan="3" style="text-align:center;color:#6b7280">No losses recorded</td></tr>`

  return `<table class="data-table">
    <thead><tr><th>Loss Category</th><th>Count</th><th>% of Losses</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Main report generator ─────────────────────────────────────────────────────

export function generateHtmlReport(
  results: DatasetResult[],
  metrics: ExtendedMetrics,
  dashboards: CalibrationDashboard[],
): string {
  const { overall, productionReadinessScore: score, productionReadinessVerdict: verdict, productionReadinessDetails } = metrics
  const scoreCol = verdictColor(score)
  const generatedAt = fmtDate(Date.now())

  // Bar chart for confidence calibration win rates
  const confBars = dashboards.length > 0 ? (() => {
    const bucketMap = new Map<string, { wins: number; losses: number }>()
    for (const d of dashboards) {
      for (const b of d.confidence.buckets) {
        const e = bucketMap.get(b.label) ?? { wins: 0, losses: 0 }
        e.wins   += b.wins
        e.losses += b.losses
        bucketMap.set(b.label, e)
      }
    }
    const ORDER = ['9-10','8-9','7-8','6-7','5-6','4-5','3-4','2-3','1-2','0-1']
    return ORDER.map(label => {
      const e = bucketMap.get(label)
      if (!e || e.wins + e.losses === 0) return null
      const wr = e.wins / (e.wins + e.losses)
      return { label, value: wr * 100, color: scoreColor(wr) }
    }).filter((b): b is NonNullable<typeof b> => b !== null)
  })() : []

  // Bar chart for loss categories
  const lossBars: BarData[] = metrics.lossCategoryBreakdown.slice(0, 8).map(c => ({
    label: c.label, value: c.pct, color: '#f97316',
  }))

  // Bar chart for regime win rates
  const regimeBars: BarData[] = metrics.regimeStats
    .filter(r => r.winCount + r.lossCount >= 3)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .map(r => ({
      label: r.label.replace(' / ', '/').slice(0, 25),
      value: (r.winRate ?? 0) * 100,
      color: scoreColor(r.winRate),
    }))

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sentinel Engine — Ground Truth Validation</title>
<style>
  :root {
    --bg: #0f1117;
    --bg2: #1a1d27;
    --bg3: #252836;
    --border: #2d3148;
    --text: #e2e8f0;
    --muted: #9ca3af;
    --accent: #3b82f6;
    --green: #22c55e;
    --yellow: #f59e0b;
    --red: #ef4444;
    --orange: #f97316;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f8fafc; --bg2: #ffffff; --bg3: #f1f5f9;
      --border: #e2e8f0; --text: #0f172a; --muted: #64748b;
    }
  }
  :root[data-theme="light"] {
    --bg: #f8fafc; --bg2: #ffffff; --bg3: #f1f5f9;
    --border: #e2e8f0; --text: #0f172a; --muted: #64748b;
  }
  :root[data-theme="dark"] {
    --bg: #0f1117; --bg2: #1a1d27; --bg3: #252836;
    --border: #2d3148; --text: #e2e8f0; --muted: #9ca3af;
  }

  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'SF Mono','Cascadia Code','Consolas',monospace; background: var(--bg); color: var(--text); line-height: 1.6; padding: 0 }
  h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em }
  h2 { font-size: 1.05rem; font-weight: 600; color: var(--accent); margin: 2rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem }
  h3 { font-size: 0.9rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: var(--muted) }
  p, li { font-size: 0.85rem; color: var(--muted) }
  a { color: var(--accent); text-decoration: none }

  .header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 1.25rem 2rem; display: flex; align-items: center; gap: 1rem }
  .header-meta { font-size: 0.75rem; color: var(--muted) }
  .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: var(--bg3); border: 1px solid var(--border) }

  .container { max-width: 1200px; margin: 0 auto; padding: 1.5rem 2rem }

  .verdict-banner {
    border-radius: 8px; padding: 1.25rem 1.5rem; margin: 1.5rem 0;
    background: var(--bg2); border: 2px solid;
    display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: center
  }
  .verdict-score { font-size: 3rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums }
  .verdict-text { font-size: 0.95rem; font-weight: 600 }
  .verdict-sub  { font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin: 1rem 0 }
  .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 1rem }
  .stat-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em }
  .stat-value { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 0.25rem }

  .section { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem }

  .data-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; font-variant-numeric: tabular-nums }
  .data-table th { padding: 0.5rem 0.75rem; text-align: left; background: var(--bg3); color: var(--muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; position: sticky; top: 0 }
  .data-table td { padding: 0.45rem 0.75rem; border-top: 1px solid var(--border) }
  .data-table tr:hover td { background: var(--bg3) }
  .table-scroll { overflow-x: auto }

  .chart-wrap { overflow-x: auto; padding: 0.5rem 0 }

  .details-list { list-style: none; padding: 0 }
  .details-list li { font-size: 0.82rem; padding: 0.3rem 0; color: var(--text); display: flex; gap: 0.5rem }
  .details-list li::before { content: '•'; color: var(--accent) }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem }
  @media (max-width: 700px) { .two-col { grid-template-columns: 1fr } }

  .theme-toggle { margin-left: auto; background: var(--bg3); border: 1px solid var(--border); color: var(--text); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Sentinel Engine</h1>
    <div class="header-meta">Ground Truth Validation Report &mdash; Module 38</div>
  </div>
  <span class="badge">10 symbols × 3 timeframes</span>
  <span class="badge">${overall.totalSnapshots} snapshots</span>
  <span class="badge">${generatedAt}</span>
  <button class="theme-toggle" onclick="toggleTheme()">Toggle Theme</button>
</div>

<div class="container">

  <!-- PRODUCTION READINESS VERDICT -->
  <h2>Production Readiness</h2>
  <div class="verdict-banner" style="border-color:${scoreCol}">
    <div class="verdict-score" style="color:${scoreCol}">${score}</div>
    <div>
      <div class="verdict-text" style="color:${scoreCol}">${esc(verdict)}</div>
      <div class="verdict-sub">Score out of 100 — based on win rate, expectancy, calibration, signal rate, and loss quality</div>
    </div>
  </div>

  <div class="section">
    <h3>Scoring Breakdown</h3>
    <ul class="details-list">
      ${productionReadinessDetails.map(d => `<li>${esc(d)}</li>`).join('')}
    </ul>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <h2>Executive Summary</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Datasets</div>
      <div class="stat-value">${results.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Snapshots</div>
      <div class="stat-value">${overall.totalSnapshots}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Actionable Trades</div>
      <div class="stat-value">${overall.actionableCount} <span style="font-size:0.8rem;color:var(--muted)">(${pct(overall.signalRate, 0)})</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Win Rate</div>
      <div class="stat-value" style="color:${scoreColor(overall.winRate)}">${pct(overall.winRate)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Setup R:R</div>
      <div class="stat-value">${num(overall.avgSetupRR)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Expectancy</div>
      <div class="stat-value" style="color:${overall.expectancy !== null && overall.expectancy >= 0 ? 'var(--green)' : 'var(--red)'}">
        ${num(overall.expectancy)}R
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Precision</div>
      <div class="stat-value">${pct(overall.precision)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">F1 (approx)</div>
      <div class="stat-value">${num(overall.f1Approx)}</div>
    </div>
  </div>

  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat-card" style="border-color:var(--green)">
      <div class="stat-label">Wins (TP Hit)</div>
      <div class="stat-value" style="color:var(--green)">${overall.winCount}</div>
    </div>
    <div class="stat-card" style="border-color:var(--red)">
      <div class="stat-label">Losses (SL Hit)</div>
      <div class="stat-value" style="color:var(--red)">${overall.lossCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Inconclusive</div>
      <div class="stat-value" style="color:var(--muted)">${overall.neitherCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">No Trade</div>
      <div class="stat-value" style="color:var(--muted)">${overall.totalSnapshots - overall.actionableCount}</div>
    </div>
  </div>

  <!-- CONFIDENCE CALIBRATION -->
  <h2>Confidence Calibration</h2>
  <div class="two-col">
    <div class="section">
      <h3>Win Rate by Confidence Bucket (all datasets)</h3>
      <div class="table-scroll">${confCalibTable(dashboards)}</div>
    </div>
    <div class="section">
      <h3>Calibration Chart</h3>
      <div class="chart-wrap">
        ${confBars.length > 0
          ? svgBarChart(confBars, 'Win Rate % by Confidence Bucket', 100)
          : '<p>Insufficient data for chart</p>'}
      </div>
    </div>
  </div>

  <!-- REGIME ANALYSIS -->
  <h2>Market Regime Analysis</h2>
  <div class="two-col">
    <div class="section">
      <h3>Win Rate by Market Regime</h3>
      <div class="table-scroll">${regimeTable(metrics)}</div>
    </div>
    <div class="section">
      <h3>Regime Win Rate Chart</h3>
      <div class="chart-wrap">
        ${regimeBars.length > 0
          ? svgBarChart(regimeBars, 'Win Rate % by Regime (≥3 resolved trades)', 100)
          : '<p>Insufficient resolved trades per regime</p>'}
      </div>
    </div>
  </div>

  <!-- MTF AGREEMENT -->
  <h2>Multi-Timeframe Agreement (15m / 1h / 4h)</h2>
  <div class="section">
    <p style="margin-bottom:0.75rem">For each symbol, snapshots are binned by position (decile). The 15m, 1h, and 4h directions are compared. Win rate by agreement level shows whether timeframe alignment predicts outcomes.</p>
    <div class="table-scroll">${mtfTable(metrics)}</div>
  </div>

  <!-- LOSS BREAKDOWN -->
  <h2>Loss Categorization</h2>
  <div class="two-col">
    <div class="section">
      <h3>Loss Categories (${overall.lossCount} total losses)</h3>
      <div class="table-scroll">${lossCatTable(metrics)}</div>
    </div>
    <div class="section">
      <h3>Loss Category Chart</h3>
      <div class="chart-wrap">
        ${lossBars.length > 0
          ? svgBarChart(lossBars, '% of Total Losses by Category', Math.max(1, ...lossBars.map(b => b.value)))
          : '<p>No losses recorded</p>'}
      </div>
    </div>
  </div>

  <!-- PER-SYMBOL -->
  <h2>Per-Symbol Summary</h2>
  <div class="section">
    <div class="table-scroll">${perSymbolTable(metrics)}</div>
  </div>

  <!-- PER-TIMEFRAME -->
  <h2>Per-Timeframe Summary</h2>
  <div class="section">
    <div class="table-scroll">${perTimeframeTable(metrics)}</div>
  </div>

  <!-- DETAILED PER-DATASET -->
  <h2>Detailed Per-Dataset Results</h2>
  ${dashboards.map(d => {
    const act = d.overall.actionableTradeCount
    const wr  = d.overall.winRate
    const exp = d.overall.averageSetupRR !== null && wr !== null
      ? wr * d.overall.averageSetupRR - (1 - wr) * 1.0 : null
    return `
    <details>
      <summary style="cursor:pointer;padding:0.5rem 0.75rem;background:var(--bg3);border-radius:4px;margin:0.4rem 0;font-size:0.85rem">
        <strong>${d.symbol} / ${d.interval}</strong>
        &nbsp; snapshots:${d.overall.totalSnapshots}
        &nbsp; action:${act}
        &nbsp; win:${pct(wr)}
        &nbsp; exp:${num(exp)}R
      </summary>
      <div style="margin:0.25rem 0 0.75rem;padding:0 0.5rem">
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-top:0.5rem">
          <div class="stat-card"><div class="stat-label">Win Rate</div><div class="stat-value" style="color:${scoreColor(wr)}">${pct(wr)}</div></div>
          <div class="stat-card"><div class="stat-label">Avg Setup R:R</div><div class="stat-value">${num(d.overall.averageSetupRR)}</div></div>
          <div class="stat-card"><div class="stat-label">Top Phase</div><div class="stat-value" style="font-size:0.8rem">${d.topPerformingPhases[0] ?? '—'}</div></div>
          <div class="stat-card"><div class="stat-label">Common Failure</div><div class="stat-value" style="font-size:0.8rem">${d.mostCommonFailureReasons[0] ?? '—'}</div></div>
        </div>
      </div>
    </details>`
  }).join('')}

  <!-- FINAL ANSWER -->
  <h2>Final Answer: Would You Trust This Engine?</h2>
  <div class="section" style="border-color:${scoreCol}">
    <div style="font-size:1.1rem;font-weight:700;color:${scoreCol};margin-bottom:0.75rem">${esc(verdict)}</div>
    <p style="color:var(--text);font-size:0.85rem;margin-bottom:0.5rem">
      Based on ${overall.totalSnapshots} walk-forward snapshots across 10 symbols × 3 timeframes
      using synthetic multi-regime candle data covering all 9 market conditions,
      with no look-ahead bias, no AI assistance, and no manual overrides:
    </p>
    <ul class="details-list">
      <li>Win rate: <strong style="color:${scoreColor(overall.winRate)}">${pct(overall.winRate)}</strong> across ${overall.winCount + overall.lossCount} resolved trades</li>
      <li>Expectancy: <strong style="color:${overall.expectancy !== null && overall.expectancy >= 0 ? 'var(--green)' : 'var(--red)'}">${num(overall.expectancy)}R per trade</strong></li>
      <li>Signal rate: <strong>${pct(overall.signalRate, 0)}</strong> of snapshots produce an actionable trade signal</li>
      <li>Production readiness score: <strong style="color:${scoreCol}">${score}/100</strong></li>
    </ul>
    <p style="color:var(--muted);font-size:0.75rem;margin-top:1rem">
      Note: All validation used synthetic candles generated by a deterministic seeded RNG covering
      range, bull, distribution, high-volatility, bear, low-volatility, accumulation, breakout, and reversal regimes.
      Results reflect engine performance on pattern-based synthetic data, not live Binance market data.
    </p>
  </div>

</div><!-- end container -->

<script>
function toggleTheme() {
  const root = document.documentElement
  const current = root.getAttribute('data-theme')
  root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
}
</script>
</body>
</html>`
}
