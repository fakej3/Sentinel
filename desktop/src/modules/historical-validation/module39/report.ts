/**
 * Module 39 — Trade Intelligence HTML report.
 *
 * Self-contained: no external resources, dark/light theme.
 */
import type { TradeIntelligenceReport } from './types'
import { LOSS_REASON_LABELS, WIN_REASON_LABELS } from './types'

// ── Formatting helpers ────────────────────────────────────────────────────────

function pct(n: number | null, d = 1): string {
  return n === null ? '—' : `${(n * 100).toFixed(d)}%`
}
function num(n: number | null, d = 2): string {
  return n === null ? '—' : n.toFixed(d)
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function signColor(v: number | null): string {
  if (v === null) return 'var(--txt-muted)'
  if (v > 0.05)  return 'var(--green)'
  if (v < -0.05) return 'var(--red)'
  return 'var(--txt-muted)'
}
function wrColor(v: number | null): string {
  if (v === null) return 'var(--txt-muted)'
  if (v >= 0.60) return 'var(--green)'
  if (v >= 0.45) return 'var(--yellow)'
  return 'var(--red)'
}

// ── SVG horizontal bar chart ──────────────────────────────────────────────────

interface Bar { label: string; value: number; color: string }

function hbar(bars: Bar[], title: string, max: number, width = 540, height?: number): string {
  const mL = 160, mR = 60, mT = 28, mB = 8
  const barH = 16, gap = 6
  const chartH = bars.length * (barH + gap)
  const h = height ?? (chartH + mT + mB)
  const chartW = width - mL - mR

  const rects = bars.map((b, i) => {
    const y = mT + i * (barH + gap)
    const w = Math.max(2, Math.round((b.value / Math.max(0.001, max)) * chartW))
    return `
      <text x="${mL - 6}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="11" fill="var(--txt-muted)">${esc(b.label)}</text>
      <rect x="${mL}" y="${y}" width="${w}" height="${barH}" fill="${b.color}" rx="2" opacity="0.85"/>
      <text x="${mL + w + 4}" y="${y + barH / 2 + 4}" font-size="11" fill="var(--txt)">${b.value.toFixed(1)}%</text>`
  }).join('')

  return `<div style="overflow-x:auto">
<svg width="${width}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%">
  <text x="${width / 2}" y="16" text-anchor="middle" font-size="12" font-weight="600" fill="var(--txt-muted)">${esc(title)}</text>
  <line x1="${mL}" y1="${mT}" x2="${mL}" y2="${h - mB}" stroke="var(--border)" stroke-width="1"/>
  ${rects}
</svg></div>`
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function th(...cells: string[]): string {
  return `<tr>${cells.map(c => `<th>${c}</th>`).join('')}</tr>`
}
function td(...cells: string[]): string {
  return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
}
function table(head: string, rows: string[], cls = ''): string {
  return `<div class="tbl-wrap"><table class="${cls}"><thead>${head}</thead><tbody>${rows.join('')}</tbody></table></div>`
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function section(id: string, title: string, body: string): string {
  return `<section id="${id}">
  <h2>${esc(title)}</h2>
  ${body}
</section>`
}

// ── Overview ──────────────────────────────────────────────────────────────────

function overviewSection(r: TradeIntelligenceReport): string {
  const stats = [
    ['Total Records',     String(r.totalRecords)],
    ['Actionable',        String(r.actionableCount)],
    ['Wins (TP hit)',     String(r.winCount)],
    ['Losses (SL hit)',   String(r.lossCount)],
    ['Neither',           String(r.neitherCount)],
    ['Overall Win Rate',  pct(r.overallWinRate)],
    ['Overall Expectancy', r.overallExpectancy !== null ? `${r.overallExpectancy.toFixed(3)}R` : '—'],
  ]
  const cards = stats.map(([k, v]) => `<div class="stat-card"><span class="stat-label">${esc(k)}</span><span class="stat-value">${esc(v)}</span></div>`).join('')
  return section('overview', 'Overview', `<div class="stat-grid">${cards}</div>`)
}

// ── Loss attribution ──────────────────────────────────────────────────────────

function lossSection(r: TradeIntelligenceReport): string {
  const total = r.lossCount
  if (total === 0) return section('loss', 'Loss Attribution', '<p class="empty">No losing trades.</p>')

  const rows   = r.lossAttribution
  const maxPct = rows[0]?.pct ?? 0

  const bars: Bar[] = rows.slice(0, 15).map(row => ({
    label: row.label,
    value: row.pct * 100,
    color: '#ef4444',
  }))

  const tableRows = rows.map(row =>
    td(esc(row.label), String(row.count), pct(row.pct), `<span style="color:${wrColor(null)}">${row.reason}</span>`),
  )

  return section('loss', 'Loss Attribution', `
    <p class="note">Multi-label: one losing trade may satisfy multiple reasons. Percentages are out of ${total} losing trades.</p>
    ${hbar(bars, 'Top 15 Loss Reasons (%)', maxPct * 100)}
    ${table(th('Reason', 'Count', '% of Losses', 'ID'), tableRows)}
  `)
}

// ── Win attribution ───────────────────────────────────────────────────────────

function winSection(r: TradeIntelligenceReport): string {
  const total = r.winCount
  if (total === 0) return section('win', 'Win Attribution', '<p class="empty">No winning trades.</p>')

  const rows   = r.winAttribution
  const maxPct = rows[0]?.pct ?? 0

  const bars: Bar[] = rows.slice(0, 15).map(row => ({
    label: row.label,
    value: row.pct * 100,
    color: '#22c55e',
  }))

  const tableRows = rows.map(row =>
    td(esc(row.label), String(row.count), pct(row.pct), `<code>${row.reason}</code>`),
  )

  return section('win', 'Win Attribution', `
    <p class="note">Multi-label: one winning trade may satisfy multiple reasons. Percentages are out of ${total} winning trades.</p>
    ${hbar(bars, 'Top 15 Win Reasons (%)', maxPct * 100)}
    ${table(th('Reason', 'Count', '% of Wins', 'ID'), tableRows)}
  `)
}

// ── Feature importance ────────────────────────────────────────────────────────

function importanceSection(r: TradeIntelligenceReport): string {
  const rows = r.featureImportance
  const maxScore = rows[0]?.importanceScore ?? 1

  const bars: Bar[] = rows.slice(0, 15).map(row => ({
    label: row.label,
    value: row.importanceScore,
    color: '#3b82f6',
  }))

  const tableRows = rows.map(row =>
    td(
      esc(row.label),
      pct(row.winRateActive, 1),
      String(row.nActive),
      pct(row.winRateInactive, 1),
      String(row.nInactive),
      num(row.lift, 2),
      num(row.importanceScore, 2),
    ),
  )

  return section('importance', 'Feature Importance', `
    <p class="note">Score = lift × log(n_active + 1). Higher score = more predictive signal.</p>
    ${hbar(bars, 'Top 15 Features by Importance Score', maxScore)}
    ${table(
      th('Feature', 'WR Active', 'N Active', 'WR Inactive', 'N Inactive', 'Lift', 'Score'),
      tableRows,
    )}
  `)
}

// ── Filter simulator ──────────────────────────────────────────────────────────

function filterSection(r: TradeIntelligenceReport): string {
  const rows = [...r.filterSimulations].sort(
    (a, b) => (b.expectancyDelta ?? -Infinity) - (a.expectancyDelta ?? -Infinity),
  )

  const tableRows = rows.map(row => {
    const delta = row.expectancyDelta
    const color = signColor(delta)
    const badge = row.improvesExpectancy
      ? '<span class="badge badge-green">✓ Improves</span>'
      : '<span class="badge badge-red">✗ Hurts</span>'
    return td(
      esc(row.label),
      pct(row.before.winRate),
      pct(row.after.winRate),
      `<span style="color:${color}">${num(delta, 3)}R</span>`,
      String(row.winsRemoved),
      String(row.lossesRemoved),
      row.selectivity !== null ? pct(row.selectivity) : '—',
      badge,
    )
  })

  return section('filters', 'Filter Simulator', `
    <p class="note">Optimization target: expectancy (E = WR × avg_RR − (1 − WR)). Sorted by expectancy delta descending.</p>
    ${table(
      th('Filter', 'WR Before', 'WR After', 'ΔExpectancy', 'Wins Removed', 'Losses Removed', 'Selectivity', 'Result'),
      tableRows,
    )}
  `)
}

// ── Combinations ─────────────────────────────────────────────────────────────

function combosSection(r: TradeIntelligenceReport): string {
  function comboRows(combos: typeof r.badCombinations): string {
    return combos.map(c =>
      td(
        c.labels.map(l => `<code>${esc(l)}</code>`).join(' + '),
        String(c.n),
        String(c.wins),
        String(c.losses),
        `<span style="color:${wrColor(c.winRate)}">${pct(c.winRate)}</span>`,
      ),
    ).join('')
  }

  const badTable = r.badCombinations.length > 0
    ? table(th('Signals', 'N', 'Wins', 'Losses', 'Win Rate'), [comboRows(r.badCombinations)])
    : '<p class="empty">No bad combinations found with ≥5 samples.</p>'

  const goodTable = r.goodCombinations.length > 0
    ? table(th('Signals', 'N', 'Wins', 'Losses', 'Win Rate'), [comboRows(r.goodCombinations)])
    : '<p class="empty">No good combinations found with ≥5 samples.</p>'

  return section('combos', 'Signal Combinations', `
    <h3>Bad Combinations (WR &lt; 40%)</h3>
    ${badTable}
    <h3 style="margin-top:1.5rem">Good Combinations (WR &gt; 60%)</h3>
    ${goodTable}
  `)
}

// ── Improvement candidates ────────────────────────────────────────────────────

function candidatesSection(r: TradeIntelligenceReport): string {
  if (r.improvementCandidates.length === 0) {
    return section('candidates', 'Recommended Filters', '<p class="empty">No evidence-backed improvements found in this dataset.</p>')
  }

  const strengthBadge = (s: string) => {
    const cls = s === 'strong' ? 'badge-green' : s === 'moderate' ? 'badge-yellow' : 'badge-gray'
    return `<span class="badge ${cls}">${esc(s)}</span>`
  }

  const tableRows = r.improvementCandidates.map(c =>
    td(
      esc(c.label),
      num(c.expectancyBefore, 3),
      num(c.expectancyAfter, 3),
      `<span style="color:var(--green)">+${num(c.expectancyDelta, 3)}R</span>`,
      pct(c.selectivity),
      String(c.winsRemoved),
      String(c.lossesRemoved),
      c.ciLow !== null ? `[${pct(c.ciLow)}, ${pct(c.ciHigh)}]` : '—',
      strengthBadge(c.evidenceStrength),
    ),
  )

  const recs = r.improvementCandidates.map(c =>
    `<li class="rec-item ${c.evidenceStrength === 'strong' ? 'rec-strong' : c.evidenceStrength === 'moderate' ? 'rec-moderate' : 'rec-weak'}">${esc(c.recommendation)}</li>`,
  ).join('')

  return section('candidates', 'Recommended Filters', `
    <p class="note">Only filters that remove proportionally more losers (selectivity &gt; 55%) and improve expectancy are shown. Confidence interval is 95% Wilson CI for post-filter win rate.</p>
    ${table(
      th('Filter', 'E Before', 'E After', 'ΔExpectancy', 'Selectivity', 'Wins Removed', 'Losses Removed', '95% CI', 'Evidence'),
      tableRows,
    )}
    <h3 style="margin-top:1.5rem">Recommendations</h3>
    <ul class="rec-list">${recs}</ul>
  `)
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  :root {
    --bg:        #0f172a;
    --bg-card:   #1e293b;
    --border:    #334155;
    --txt:       #e2e8f0;
    --txt-muted: #94a3b8;
    --green:     #22c55e;
    --red:       #ef4444;
    --yellow:    #f59e0b;
    --blue:      #3b82f6;
    --accent:    #38bdf8;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg:        #f1f5f9;
      --bg-card:   #ffffff;
      --border:    #cbd5e1;
      --txt:       #0f172a;
      --txt-muted: #64748b;
    }
  }
  :root[data-theme="light"] {
    --bg:        #f1f5f9;
    --bg-card:   #ffffff;
    --border:    #cbd5e1;
    --txt:       #0f172a;
    --txt-muted: #64748b;
  }
  :root[data-theme="dark"] {
    --bg:        #0f172a;
    --bg-card:   #1e293b;
    --border:    #334155;
    --txt:       #e2e8f0;
    --txt-muted: #94a3b8;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
    background: var(--bg);
    color: var(--txt);
    line-height: 1.5;
    padding: 0 1rem 4rem;
  }
  header {
    text-align: center;
    padding: 2.5rem 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2.5rem;
  }
  header h1 { font-size: 1.6rem; color: var(--accent); letter-spacing: 0.02em; }
  header p { color: var(--txt-muted); font-size: 0.85rem; margin-top: 0.4rem; }
  nav {
    display: flex; flex-wrap: wrap; gap: 0.4rem;
    justify-content: center; margin-bottom: 2rem;
  }
  nav a {
    color: var(--accent); text-decoration: none; font-size: 0.8rem;
    padding: 0.2rem 0.5rem; border: 1px solid var(--border); border-radius: 4px;
  }
  nav a:hover { background: var(--bg-card); }
  section { max-width: 900px; margin: 0 auto 3rem; }
  section h2 {
    font-size: 1.1rem; font-weight: 700; color: var(--accent);
    padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);
    margin-bottom: 1rem; letter-spacing: 0.03em;
  }
  section h3 { font-size: 0.95rem; font-weight: 600; color: var(--txt-muted); margin-bottom: 0.75rem; }
  .stat-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem;
  }
  .stat-card {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px;
    padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem;
  }
  .stat-label { font-size: 0.72rem; color: var(--txt-muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .stat-value { font-size: 1.15rem; font-weight: 700; color: var(--txt); font-variant-numeric: tabular-nums; }
  .note { font-size: 0.8rem; color: var(--txt-muted); margin-bottom: 0.75rem; }
  .empty { color: var(--txt-muted); font-style: italic; }
  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.75rem; }
  th, td { padding: 0.4rem 0.65rem; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
  th { color: var(--txt-muted); font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
  tr:hover td { background: var(--bg-card); }
  code { font-size: 0.78rem; color: var(--accent); }
  .badge {
    display: inline-block; font-size: 0.7rem; padding: 0.1rem 0.4rem;
    border-radius: 3px; font-weight: 600;
  }
  .badge-green  { background: rgba(34,197,94,0.15);  color: var(--green); }
  .badge-red    { background: rgba(239,68,68,0.15);   color: var(--red); }
  .badge-yellow { background: rgba(245,158,11,0.15);  color: var(--yellow); }
  .badge-gray   { background: rgba(148,163,184,0.15); color: var(--txt-muted); }
  .rec-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
  .rec-item {
    padding: 0.5rem 0.75rem; border-radius: 5px; font-size: 0.82rem;
    border-left: 3px solid;
  }
  .rec-strong   { border-color: var(--green);   background: rgba(34,197,94,0.07); }
  .rec-moderate { border-color: var(--yellow);  background: rgba(245,158,11,0.07); }
  .rec-weak     { border-color: var(--txt-muted); background: rgba(148,163,184,0.07); }
  svg text { font-family: inherit; }
`

// ── Full report ───────────────────────────────────────────────────────────────

export function generateTradeIntelligenceReport(r: TradeIntelligenceReport): string {
  const navLinks = [
    ['#overview',    'Overview'],
    ['#loss',        'Loss Attribution'],
    ['#win',         'Win Attribution'],
    ['#importance',  'Feature Importance'],
    ['#filters',     'Filter Simulator'],
    ['#combos',      'Combinations'],
    ['#candidates',  'Recommendations'],
  ].map(([href, label]) => `<a href="${href}">${label}</a>`).join('')

  const body = [
    overviewSection(r),
    lossSection(r),
    winSection(r),
    importanceSection(r),
    filterSection(r),
    combosSection(r),
    candidatesSection(r),
  ].join('\n')

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Module 39 — Trade Intelligence Lab</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>Trade Intelligence Lab</h1>
    <p>Module 39 · Evidence-Driven Optimization · Generated ${ts}</p>
  </header>
  <nav>${navLinks}</nav>
  ${body}
  <script>
    const root = document.documentElement
    const saved = localStorage.getItem('theme')
    if (saved) root.setAttribute('data-theme', saved)
  </script>
</body>
</html>`
}
