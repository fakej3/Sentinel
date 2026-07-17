/**
 * Module 41 — HTML comparison report.
 *
 * Generates a self-contained HTML page showing:
 *   - Trade Maturity Score tier breakdown (WR, expectancy, profit factor)
 *   - Before vs After engine comparison
 *   - Distribution of rejected trades by setup quality
 *   - Component breakdown of saved losses (why they were immature)
 */
import type { TierStats, EngineStats } from './run'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number | null, d = 1): string {
  return n === null ? '—' : `${(n * 100).toFixed(d)}%`
}
function num(n: number | null, d = 2): string {
  return n === null ? '—' : n.toFixed(d)
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TIER_COLORS: Record<string, string> = {
  immature:   '#ef4444',
  early:      '#f97316',
  developing: '#eab308',
  mature:     '#22c55e',
  peak:       '#38bdf8',
}
const TIER_LABELS: Record<string, string> = {
  immature: 'Immature', early: 'Early', developing: 'Developing', mature: 'Mature', peak: 'Peak',
}

// ── SVG score bar ─────────────────────────────────────────────────────────────

function svgScoreBar(value: number, max: number, color: string, width = 200): string {
  const w = Math.round((value / max) * width)
  return `<svg width="${width}" height="12" style="vertical-align:middle">
    <rect x="0" y="2" width="${width}" height="8" rx="4" fill="#1e293b"/>
    <rect x="0" y="2" width="${w}" height="8" rx="4" fill="${color}"/>
  </svg>`
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function wrCell(wr: number | null): string {
  if (wr === null) return '<td style="color:#475569">—</td>'
  const color = wr >= 0.90 ? '#22c55e' : wr >= 0.75 ? '#86efac' : wr >= 0.60 ? '#f59e0b' : '#ef4444'
  return `<td style="color:${color};font-weight:600">${pct(wr)}</td>`
}

function exCell(ex: number | null): string {
  if (ex === null) return '<td style="color:#475569">—</td>'
  const color = ex >= 2.0 ? '#22c55e' : ex >= 1.0 ? '#86efac' : ex >= 0.0 ? '#f59e0b' : '#ef4444'
  return `<td style="color:${color};font-weight:600">${num(ex, 3)}</td>`
}

function pfCell(pf: number | null): string {
  if (pf === null) return '<td style="color:#475569">—</td>'
  const color = pf >= 4.0 ? '#22c55e' : pf >= 2.0 ? '#86efac' : pf >= 1.0 ? '#f59e0b' : '#ef4444'
  const display = pf === Infinity ? '∞' : num(pf)
  return `<td style="color:${color};font-weight:600">${display}</td>`
}

// ── Sections ──────────────────────────────────────────────────────────────────

function tierTable(tiers: TierStats[]): string {
  const rows = tiers.map(t => {
    const col = TIER_COLORS[t.tier] ?? '#6b7280'
    const lbl = TIER_LABELS[t.tier] ?? t.tier
    const badge = `<span style="background:${col}22;color:${col};border:1px solid ${col}44;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600">${lbl}</span>`
    return `<tr>
      <td>${badge}</td>
      <td style="color:#64748b">${esc(t.scoreRange)}</td>
      <td style="color:#94a3b8;text-align:center">${t.tradeCount}</td>
      <td style="color:#22c55e;text-align:center">${t.wins}</td>
      <td style="color:#ef4444;text-align:center">${t.losses}</td>
      ${wrCell(t.winRate)}
      <td style="color:#94a3b8">${num(t.avgSetupRR)}</td>
      ${exCell(t.expectancy)}
      ${pfCell(t.profitFactor)}
    </tr>`
  }).join('')
  return `
  <table class="data-table">
    <thead>
      <tr>
        <th>Tier</th><th>Score</th><th>Trades</th><th>W</th><th>L</th>
        <th>Win Rate</th><th>Avg RR</th><th>Expectancy</th><th>Profit Factor</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

function engineRow(e: EngineStats, highlight = false): string {
  const style = highlight ? 'background:#0f2027;border-left:3px solid #22c55e' : ''
  return `<tr style="${style}">
    <td style="font-weight:600;color:#e2e8f0">${esc(e.label)}</td>
    <td style="text-align:center;color:#94a3b8">${e.tradeCount}</td>
    <td style="text-align:center;color:#22c55e">${e.wins}</td>
    <td style="text-align:center;color:#ef4444">${e.losses}</td>
    ${wrCell(e.winRate)}
    ${exCell(e.expectancy)}
    ${pfCell(e.profitFactor)}
    <td style="color:#94a3b8">${num(e.avgSetupRR)}</td>
    <td style="color:#f59e0b;text-align:center">${e.rejectedCount}</td>
    <td style="color:#22c55e;text-align:center">${e.savedLosses}</td>
  </tr>`
}

function delta(before: number | null, after: number | null, higherBetter = true): string {
  if (before === null || after === null) return '<span style="color:#475569">—</span>'
  const d = after - before
  if (Math.abs(d) < 0.0001) return '<span style="color:#64748b">±0</span>'
  const sign = d > 0 ? '+' : ''
  const color = (d > 0) === higherBetter ? '#22c55e' : '#ef4444'
  return `<span style="color:${color};font-weight:600">${sign}${d.toFixed(3)}</span>`
}

function componentBar(label: string, value: number, max: number, color: string): string {
  return `<div style="margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;margin-bottom:2px">
      <span style="font-size:11px;color:#94a3b8">${label}</span>
      <span style="font-size:11px;color:#64748b">${value.toFixed(1)}/${max}</span>
    </div>
    ${svgScoreBar(value, max, color, 360)}
  </div>`
}

// ── Full report ───────────────────────────────────────────────────────────────

export function generateModule41Report(data: {
  tierStats: TierStats[]
  before: EngineStats
  after: EngineStats
  rejectedByQuality: Record<string, number>
  savedLossComponents: { avgMomentum: number; avgVolume: number; avgTrend: number; avgStructure: number; avgConfidence: number }
}): string {
  const { tierStats, before, after, rejectedByQuality, savedLossComponents } = data

  const wrLift = before.winRate !== null && after.winRate !== null
    ? ((after.winRate - before.winRate) * 100).toFixed(2) + ' pp'
    : '—'
  const exLift = before.expectancy !== null && after.expectancy !== null
    ? (after.expectancy - before.expectancy > 0 ? '+' : '') +
      (after.expectancy - before.expectancy).toFixed(3)
    : '—'
  const exLiftColor = before.expectancy !== null && after.expectancy !== null && after.expectancy > before.expectancy
    ? '#22c55e' : '#ef4444'

  const qualityOrder = ['excellent', 'good', 'average', 'poor', 'avoid', 'no_setup']
  const qualityColors: Record<string, string> = {
    excellent: '#22c55e', good: '#86efac', average: '#f59e0b',
    poor: '#f97316', avoid: '#ef4444', no_setup: '#6b7280',
  }
  const rejectedRows = qualityOrder
    .filter(q => rejectedByQuality[q] !== undefined)
    .map(q => {
      const n = rejectedByQuality[q]
      const col = qualityColors[q] ?? '#6b7280'
      return `<tr>
        <td><span style="color:${col};font-weight:600">${q}</span></td>
        <td style="text-align:center;color:#94a3b8">${n}</td>
      </tr>`
    }).join('')

  const generated = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  const winBlockedCount = after.rejectedCount - after.savedLosses
  const selectivity = after.rejectedCount > 0
    ? `${((after.savedLosses / after.rejectedCount) * 100).toFixed(1)}%`
    : '—'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Module 41 — Trade Maturity Score Validation</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #21262d;
    --text: #c9d1d9; --muted: #6e7681; --accent: #38bdf8;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size: 13px; line-height: 1.6; padding: 32px 24px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px; }
  h2 { font-size: 16px; font-weight: 600; color: #e2e8f0; margin: 32px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  h3 { font-size: 13px; font-weight: 600; color: #94a3b8; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .05em; }
  .meta { font-size: 11px; color: var(--muted); margin-bottom: 28px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .data-table th { text-align: left; padding: 8px 10px; color: #475569; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--border); }
  .data-table td { padding: 8px 10px; border-bottom: 1px solid #1e2634; }
  .data-table tr:last-child td { border-bottom: none; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 12px; margin-bottom: 20px; }
  .kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; }
  .kpi-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
  .kpi-value { font-size: 22px; font-weight: 700; color: #e2e8f0; }
  .kpi-sub { font-size: 11px; color: #475569; margin-top: 2px; }
  .highlight-card { background: #0f2027; border: 1px solid #22c55e44; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media(max-width:600px) { .two-col { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Module 41 — Trade Maturity Score Validation</h1>
<p class="meta">Generated ${generated} · Walk-forward validation: 10 symbols × 3 timeframes × 540 candles per regime</p>

<h2>1. Maturity Tier Breakdown</h2>
<div class="card">
  <p style="font-size:12px;color:#64748b;margin-bottom:14px">
    Resolved (tp_hit + sl_hit) actionable trades sliced by maturity score tier.
    Evidence drives every threshold — score averages: wins 59.9, losses 47.6.
  </p>
  ${tierTable(tierStats)}
</div>

<h2>2. Before vs After — Immature Gate</h2>
<div class="highlight-card">
  <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px">
    <div>
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">WR change</div>
      <div style="font-size:18px;font-weight:700;color:${exLiftColor}">${wrLift}</div>
    </div>
    <div>
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Expectancy change</div>
      <div style="font-size:18px;font-weight:700;color:${exLiftColor}">${exLift}</div>
    </div>
    <div>
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Gate selectivity</div>
      <div style="font-size:18px;font-weight:700;color:#f59e0b">${selectivity}</div>
    </div>
    <div>
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Losses blocked</div>
      <div style="font-size:18px;font-weight:700;color:#22c55e">${after.savedLosses}</div>
    </div>
    <div>
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Wins blocked</div>
      <div style="font-size:18px;font-weight:700;color:#ef4444">${winBlockedCount}</div>
    </div>
  </div>
  <p style="font-size:11px;color:#64748b">
    Gate selectivity = losses blocked / total rejected.
    100% means every rejected trade was a loss — pure improvement.
    Wins blocked = cost of the gate.
  </p>
</div>

<div class="card">
  <table class="data-table">
    <thead>
      <tr>
        <th>Engine</th><th>Trades</th><th>W</th><th>L</th>
        <th>Win Rate</th><th>Expectancy</th><th>Profit Factor</th>
        <th>Avg RR</th><th>Rejected</th><th>Saved Losses</th>
      </tr>
    </thead>
    <tbody>
      ${engineRow(before)}
      ${engineRow(after, true)}
      <tr style="background:#0a1628">
        <td style="color:#64748b;font-style:italic">Delta</td>
        <td style="text-align:center">${delta(before.tradeCount, after.tradeCount, false)}</td>
        <td style="text-align:center">${delta(before.wins, after.wins, false)}</td>
        <td style="text-align:center">${delta(before.losses, after.losses, false)}</td>
        <td>${delta(before.winRate, after.winRate)}</td>
        <td>${delta(before.expectancy, after.expectancy)}</td>
        <td>${delta(before.profitFactor, after.profitFactor)}</td>
        <td>${delta(before.avgSetupRR, after.avgSetupRR)}</td>
        <td>—</td><td>—</td>
      </tr>
    </tbody>
  </table>
</div>

<h2>3. Rejected Trade Distribution</h2>
<div class="two-col">
  <div class="card">
    <h3>By Setup Quality</h3>
    <table class="data-table">
      <thead><tr><th>Quality</th><th style="text-align:center">Count</th></tr></thead>
      <tbody>${rejectedRows || '<tr><td colspan="2" style="color:#475569;text-align:center">None rejected</td></tr>'}</tbody>
    </table>
  </div>

  <div class="card">
    <h3>Saved Loss Component Breakdown</h3>
    <p style="font-size:11px;color:#64748b;margin-bottom:12px">
      Average component scores of the ${after.savedLosses} losses the Immature gate blocked.
      The lowest components reveal <em>why</em> these setups failed.
    </p>
    ${componentBar('Momentum (max 25)', savedLossComponents.avgMomentum, 25, '#ef4444')}
    ${componentBar('Volume (max 20)',   savedLossComponents.avgVolume,   20, '#f97316')}
    ${componentBar('Trend (max 20)',    savedLossComponents.avgTrend,    20, '#eab308')}
    ${componentBar('Structure (max 20)',savedLossComponents.avgStructure,20, '#a78bfa')}
    ${componentBar('Confidence (max 15)',savedLossComponents.avgConfidence,15,'#38bdf8')}
  </div>
</div>

<h2>4. Evidence Summary</h2>
<div class="card">
  <p style="font-size:12px;color:#94a3b8;line-height:1.8">
    The Trade Maturity Score combines five evidence-backed components derived from Module 38/39 walk-forward validation:
  </p>
  <ul style="font-size:12px;color:#94a3b8;margin-top:10px;padding-left:18px;line-height:2.0">
    <li><strong style="color:#e2e8f0">Momentum (0–25)</strong>: MACD+RSI alignment. 80% of losses had momentum failure. Full alignment lifts WR by 1.066–1.103×.</li>
    <li><strong style="color:#e2e8f0">Volume (0–20)</strong>: OBV direction + relative volume. OBV confirming = #1 feature (lift 1.175). Low relVol (&lt;0.7) in 20% of losses.</li>
    <li><strong style="color:#e2e8f0">Trend (0–20)</strong>: Trend strength tier. 70–80% of losses had weak/ranging trend. Moderate+ lift = 1.085×.</li>
    <li><strong style="color:#e2e8f0">Structure (0–20)</strong>: CHoCH + BOS detection. CHoCH lift = 1.102×. 80% of losses had failed CHoCH. Weak structure in 50% of losses.</li>
    <li><strong style="color:#e2e8f0">Confidence (0–15)</strong>: Engine confidence score tier. Score ≥8.5 lifts WR by 1.090×.</li>
  </ul>
  <p style="font-size:11px;color:#475569;margin-top:12px">
    Factors evaluated but rejected: liquidity sweep (no data), pullback completeness (not measurable without price pattern detection),
    trend exhaustion (captured by weak trend + structure), volatility expansion/contraction (captured by ADX + Bollinger — already encoded in confidence).
  </p>
</div>

</body>
</html>`
}
