/**
 * Phase 2 — Professional Trading Validation HTML Report
 *
 * Generates a fully self-contained HTML page with Phase 4/5/6 analysis,
 * extended metrics (15 symbols × 4 timeframes), and professional insights.
 */
import type { CalibrationDashboard } from '../types.js'
import type { DatasetResult, ExtendedMetrics } from '../module38/extended-metrics.js'
import type { Phase4Result, Phase5Result, Phase6Result } from './run.js'

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
function fmtDate(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
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
function severityColor(s: string): string {
  if (s === 'critical') return '#ef4444'
  if (s === 'high')     return '#f97316'
  if (s === 'medium')   return '#f59e0b'
  return '#6b7280'
}
function priorityColor(p: string): string {
  if (p === 'high')   return '#ef4444'
  if (p === 'medium') return '#f59e0b'
  return '#22c55e'
}
function deltaColor(delta: number): string {
  if (delta >  0.05) return '#22c55e'
  if (delta < -0.05) return '#ef4444'
  return '#f59e0b'
}

// ── SVG sparkline bar chart ───────────────────────────────────────────────────

interface BarData { label: string; value: number; color?: string }

function svgBars(bars: BarData[], maxVal: number, w = 500, h = 200): string {
  const ml = 120, mr = 20, mt = 20, mb = 10
  const cw = w - ml - mr
  const ch = h - mt - mb
  const barH = Math.max(10, Math.floor(ch / Math.max(1, bars.length) * 0.72))
  const gap  = Math.max(3, Math.floor(ch / Math.max(1, bars.length) * 0.28))
  let out = ''
  for (let i = 0; i < bars.length; i++) {
    const { label, value, color = '#3b82f6' } = bars[i]
    const bw = Math.round((value / Math.max(0.001, maxVal)) * cw)
    const y  = mt + i * (barH + gap)
    out += `<text x="${ml - 5}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="10" fill="#9ca3af">${esc(label)}</text>`
    out += `<rect x="${ml}" y="${y}" width="${Math.max(2, bw)}" height="${barH}" fill="${color}" rx="2"/>`
    out += `<text x="${ml + Math.max(2, bw) + 4}" y="${y + barH / 2 + 4}" font-size="10" fill="#d1d5db">${value.toFixed(1)}%</text>`
  }
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;overflow:hidden">
    <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${h - mb}" stroke="#374151" stroke-width="1"/>
    ${out}
  </svg>`
}

// ── Confidence calibration ────────────────────────────────────────────────────

function confTable(dashboards: CalibrationDashboard[], phase5: Phase5Result): string {
  const BUCKET_ORDER = ['9-10','8-9','7-8','6-7','5-6','4-5','3-4','0-3']
  const bucketMap = new Map<string, { wins: number; losses: number; total: number }>()
  for (const d of dashboards) {
    for (const b of d.confidence.buckets) {
      const e = bucketMap.get(b.label) ?? { wins: 0, losses: 0, total: 0 }
      e.wins += b.wins; e.losses += b.losses; e.total += b.totalTrades
      bucketMap.set(b.label, e)
    }
  }
  // Also aggregate from '0-1','1-2','2-3' into '0-3' for display
  const low3 = { wins: 0, losses: 0, total: 0 }
  for (const lbl of ['0-1','1-2','2-3']) {
    const e = bucketMap.get(lbl)
    if (e) { low3.wins += e.wins; low3.losses += e.losses; low3.total += e.total }
  }
  if (low3.total > 0) bucketMap.set('0-3', low3)

  let rows = ''
  for (const label of BUCKET_ORDER) {
    const e = bucketMap.get(label)
    if (!e || e.total === 0) continue
    const resolved = e.wins + e.losses
    const wr = resolved > 0 ? e.wins / resolved : null

    // Look up overconfidence data
    const confCase = phase5.overconfidenceCases.find(c => c.bucket === label || c.confRange === label)
    const expected = confCase?.expectedWR
    const delta    = wr !== null && expected !== undefined ? wr - expected : null

    const deltaHtml = delta !== null
      ? `<span style="color:${deltaColor(delta)}">${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%</span>`
      : '—'

    rows += `<tr>
      <td style="font-weight:600">${label}</td>
      <td>${e.total}</td>
      <td>${e.wins}</td>
      <td>${e.losses}</td>
      <td style="color:${scoreColor(wr)};font-weight:600">${pct(wr)}</td>
      <td>${expected !== undefined ? pct(expected) : '—'}</td>
      <td>${deltaHtml}</td>
    </tr>`
  }
  return `<table class="dt">
    <thead><tr><th>Bucket</th><th>Trades</th><th>Wins</th><th>Losses</th><th>Actual WR</th><th>Expected WR</th><th>Delta</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Per-symbol table ──────────────────────────────────────────────────────────

function symbolTable(metrics: ExtendedMetrics): string {
  const bySymbol = new Map<string, typeof metrics.datasets[0][]>()
  for (const d of metrics.datasets) {
    const e = bySymbol.get(d.symbol) ?? []
    e.push(d)
    bySymbol.set(d.symbol, e)
  }

  const ORDER = [
    'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
    'ADAUSDT','DOGEUSDT','LINKUSDT','AVAXUSDT','SUIUSDT',
    'FETUSDT','ARBUSDT','OPUSDT','INJUSDT','PEPEUSDT',
  ]

  let rows = ''
  for (const sym of ORDER) {
    const datasets = bySymbol.get(sym)
    if (!datasets || datasets.length === 0) continue
    const w   = datasets.reduce((s, d) => s + d.winCount, 0)
    const l   = datasets.reduce((s, d) => s + d.lossCount, 0)
    const act = datasets.reduce((s, d) => s + d.actionableCount, 0)
    const tot = datasets.reduce((s, d) => s + d.totalSnapshots, 0)
    const wr  = w + l > 0 ? w / (w + l) : null
    const rrVals = datasets.map(d => d.avgSetupRR).filter((v): v is number => v !== null)
    const avgRR  = rrVals.length > 0 ? rrVals.reduce((s, v) => s + v, 0) / rrVals.length : null
    const exp    = wr !== null && avgRR !== null ? wr * avgRR - (1 - wr) * 1.0 : null

    rows += `<tr>
      <td style="font-weight:600">${sym}</td>
      <td>${tot}</td>
      <td>${act} (${pct(act / Math.max(1, tot), 0)})</td>
      <td>${w}</td><td>${l}</td>
      <td style="color:${scoreColor(wr)};font-weight:600">${pct(wr)}</td>
      <td>${num(avgRR)}</td>
      <td style="color:${exp !== null && exp >= 0 ? '#22c55e' : '#ef4444'}">${num(exp)}</td>
    </tr>`
  }
  return `<table class="dt">
    <thead><tr><th>Symbol</th><th>Snapshots</th><th>Actionable</th><th>Wins</th><th>Losses</th><th>Win Rate</th><th>Avg R:R</th><th>Expectancy</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Per-timeframe table ───────────────────────────────────────────────────────

function timeframeTable(metrics: ExtendedMetrics, phase5: Phase5Result): string {
  const tfMap = new Map<string, typeof metrics.datasets[0][]>()
  for (const d of metrics.datasets) {
    const e = tfMap.get(d.timeframe) ?? []
    e.push(d)
    tfMap.set(d.timeframe, e)
  }

  let rows = ''
  for (const tf of ['15m', '1h', '4h', '1d']) {
    const datasets = tfMap.get(tf)
    if (!datasets || datasets.length === 0) continue
    const w   = datasets.reduce((s, d) => s + d.winCount, 0)
    const l   = datasets.reduce((s, d) => s + d.lossCount, 0)
    const act = datasets.reduce((s, d) => s + d.actionableCount, 0)
    const tot = datasets.reduce((s, d) => s + d.totalSnapshots, 0)
    const wr  = w + l > 0 ? w / (w + l) : null
    const rrVals = datasets.map(d => d.avgSetupRR).filter((v): v is number => v !== null)
    const avgRR  = rrVals.length > 0 ? rrVals.reduce((s, v) => s + v, 0) / rrVals.length : null
    const exp    = wr !== null && avgRR !== null ? wr * avgRR - (1 - wr) * 1.0 : null
    const tfVerdict = phase5.timeframeVerdict.find(tv => tv.tf === tf)?.verdict ?? '—'

    rows += `<tr>
      <td style="font-weight:600">${tf}</td>
      <td>${tot}</td>
      <td>${act} (${pct(act / Math.max(1, tot), 0)})</td>
      <td>${w}</td><td>${l}</td>
      <td style="color:${scoreColor(wr)};font-weight:600">${pct(wr)}</td>
      <td>${num(avgRR)}</td>
      <td style="color:${exp !== null && exp >= 0 ? '#22c55e' : '#ef4444'}">${num(exp)}</td>
      <td style="font-size:0.78rem;color:var(--muted)">${esc(tfVerdict)}</td>
    </tr>`
  }
  return `<table class="dt">
    <thead><tr><th>Timeframe</th><th>Snapshots</th><th>Actionable</th><th>Wins</th><th>Losses</th><th>Win Rate</th><th>Avg R:R</th><th>Expectancy</th><th>Verdict</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Regime table ──────────────────────────────────────────────────────────────

function regimeTable(metrics: ExtendedMetrics): string {
  const sorted = [...metrics.regimeStats].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
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
  return `<table class="dt">
    <thead><tr><th>Market Regime</th><th>Snapshots</th><th>Actionable</th><th>Wins</th><th>Losses</th><th>Win Rate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Loss category table ───────────────────────────────────────────────────────

function lossCatTable(metrics: ExtendedMetrics): string {
  let rows = ''
  for (const r of metrics.lossCategoryBreakdown) {
    const isBad = ['bad_rr','stop_too_tight','target_unrealistic','late_entry'].includes(r.category)
    rows += `<tr>
      <td>${r.label}${isBad ? ' <span style="color:#f97316;font-size:0.75rem">[systemic]</span>' : ''}</td>
      <td>${r.count}</td>
      <td style="color:${r.pct > 20 ? '#ef4444' : r.pct > 10 ? '#f59e0b' : 'var(--text)'}">${r.pct.toFixed(1)}%</td>
    </tr>`
  }
  if (!rows) rows = `<tr><td colspan="3" style="text-align:center;color:var(--muted)">No losses recorded</td></tr>`
  return `<table class="dt">
    <thead><tr><th>Loss Category</th><th>Count</th><th>% of Losses</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── MTF table ────────────────────────────────────────────────────────────────

function mtfTable(metrics: ExtendedMetrics): string {
  const LABELS: Record<string, string> = {
    aligned:        'All timeframes aligned',
    mostly_aligned: 'Mostly aligned',
    mixed:          'Mixed signals',
    strong_conflict:'Strong conflict',
  }
  let rows = ''
  for (const r of metrics.mtfAgreementStats) {
    rows += `<tr>
      <td>${LABELS[r.agreement] ?? r.agreement}</td>
      <td>${r.count}</td><td>${r.wins}</td><td>${r.losses}</td>
      <td style="color:${scoreColor(r.winRate)};font-weight:600">${pct(r.winRate)}</td>
    </tr>`
  }
  if (!rows) rows = `<tr><td colspan="5" style="text-align:center;color:var(--muted)">Insufficient MTF data</td></tr>`
  return `<table class="dt">
    <thead><tr><th>MTF Agreement</th><th>Bins</th><th>Wins</th><th>Losses</th><th>Win Rate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Phase 4 weakness table ────────────────────────────────────────────────────

function phase4Table(phase4: Phase4Result): string {
  if (phase4.weaknesses.length === 0) {
    return '<p style="color:var(--muted)">No significant weaknesses identified.</p>'
  }
  let rows = ''
  for (const w of phase4.weaknesses) {
    rows += `<tr>
      <td><span style="color:${severityColor(w.severity)};font-weight:700;text-transform:uppercase;font-size:0.72rem">${w.severity}</span></td>
      <td style="font-weight:600">${esc(w.description)}</td>
      <td style="font-size:0.8rem;color:var(--muted)">${esc(w.evidence)}</td>
      <td>${w.sampleSize}</td>
      <td style="color:${scoreColor(w.winRate)}">${w.winRate !== null ? pct(w.winRate) : '—'}</td>
    </tr>`
  }
  return `<table class="dt">
    <thead><tr><th>Severity</th><th>Weakness</th><th>Evidence</th><th>Sample</th><th>Win Rate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Phase 5 category stats ────────────────────────────────────────────────────

function categoryTable(phase5: Phase5Result): string {
  let rows = ''
  for (const c of phase5.categoryStats) {
    if (c.trades < 3) continue
    rows += `<tr>
      <td>${esc(c.label)}</td>
      <td>${c.trades}</td>
      <td style="color:${scoreColor(c.winRate)};font-weight:600">${pct(c.winRate)}</td>
    </tr>`
  }
  return `<table class="dt">
    <thead><tr><th>Symbol Category</th><th>Resolved Trades</th><th>Win Rate</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ── Phase 6 proposals ────────────────────────────────────────────────────────

function proposalCards(phase6: Phase6Result): string {
  if (phase6.proposals.length === 0) {
    return '<div class="section"><p style="color:var(--muted)">No proposals generated — engine performance meets threshold.</p></div>'
  }
  return phase6.proposals.map(p => `
    <div class="section proposal-card" style="border-left:4px solid ${priorityColor(p.priority)}">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
        <span style="font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:12px;background:${priorityColor(p.priority)}22;color:${priorityColor(p.priority)};border:1px solid ${priorityColor(p.priority)}">
          ${p.priority.toUpperCase()} PRIORITY
        </span>
        <span style="font-size:0.7rem;color:var(--muted)">${p.id}</span>
        <strong style="font-size:0.95rem">${esc(p.title)}</strong>
      </div>
      <div class="proposal-grid">
        <div><div class="field-label">Weakness</div><div class="field-val">${esc(p.weakness)}</div></div>
        <div><div class="field-label">Evidence</div><div class="field-val">${esc(p.evidence)}</div></div>
        <div><div class="field-label">Code Location</div><div class="field-val code-ref">${esc(p.codeLocation)}</div></div>
        <div><div class="field-label">Proposed Change</div><div class="field-val">${esc(p.proposedChange)}</div></div>
        <div><div class="field-label">Expected Impact</div><div class="field-val" style="color:var(--green)">${esc(p.expectedImpact)}</div></div>
      </div>
    </div>
  `).join('')
}

// ── Quality gauges ────────────────────────────────────────────────────────────

function qualityGauge(score: number, label: string): string {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  const cx = 50, cy = 50, r = 38
  const circumf = 2 * Math.PI * r
  const arc = (score / 100) * circumf
  return `
    <div style="text-align:center;min-width:110px">
      <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="8"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
          stroke-dasharray="${arc} ${circumf - arc}"
          stroke-dashoffset="${circumf / 4}"
          stroke-linecap="round"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="18" font-weight="700" fill="${color}">${score}</text>
      </svg>
      <div style="font-size:0.75rem;color:var(--muted);margin-top:-0.5rem">${label}</div>
    </div>`
}

// ── Main report generator ─────────────────────────────────────────────────────

export function generatePhase2Report(
  results: DatasetResult[],
  metrics: ExtendedMetrics,
  dashboards: CalibrationDashboard[],
  phase4: Phase4Result,
  phase5: Phase5Result,
  phase6: Phase6Result,
): string {
  const { overall, productionReadinessScore: score, productionReadinessVerdict: verdict } = metrics
  const scoreCol = verdictColor(score)

  // Charts
  const confBars = (() => {
    const ORDER = ['9-10','8-9','7-8','6-7','5-6','4-5','3-4','0-3']
    const bMap = new Map<string, { wins: number; losses: number }>()
    for (const d of dashboards) {
      for (const b of d.confidence.buckets) {
        const e = bMap.get(b.label) ?? { wins: 0, losses: 0 }
        e.wins += b.wins; e.losses += b.losses
        bMap.set(b.label, e)
      }
    }
    const low3 = { wins: 0, losses: 0 }
    for (const lbl of ['0-1','1-2','2-3']) {
      const e = bMap.get(lbl); if (e) { low3.wins += e.wins; low3.losses += e.losses }
    }
    if (low3.wins + low3.losses > 0) bMap.set('0-3', low3)
    return ORDER.map(label => {
      const e = bMap.get(label); if (!e || e.wins + e.losses === 0) return null
      const wr = e.wins / (e.wins + e.losses)
      return { label, value: wr * 100, color: scoreColor(wr) }
    }).filter((b): b is NonNullable<typeof b> => b !== null)
  })()

  const regimeBars = metrics.regimeStats
    .filter(r => r.winCount + r.lossCount >= 3)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .map(r => ({
      label: r.label.replace(' / ', '/').replace(' (', '\n(').slice(0, 22),
      value: (r.winRate ?? 0) * 100,
      color: scoreColor(r.winRate),
    }))

  const lossBars = metrics.lossCategoryBreakdown.slice(0, 8).map(c => ({
    label: c.label,
    value: c.pct,
    color: '#f97316',
  }))

  const maxLossVal = Math.max(1, ...lossBars.map(b => b.value))

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sentinel Phase 2 — Professional Trading Validation</title>
<style>
:root {
  --bg:#0f1117; --bg2:#1a1d27; --bg3:#252836; --border:#2d3148;
  --text:#e2e8f0; --muted:#9ca3af; --accent:#3b82f6;
  --green:#22c55e; --yellow:#f59e0b; --red:#ef4444; --orange:#f97316;
}
@media (prefers-color-scheme: light) {
  :root { --bg:#f8fafc; --bg2:#fff; --bg3:#f1f5f9; --border:#e2e8f0; --text:#0f172a; --muted:#64748b }
}
:root[data-theme="light"] { --bg:#f8fafc; --bg2:#fff; --bg3:#f1f5f9; --border:#e2e8f0; --text:#0f172a; --muted:#64748b }
:root[data-theme="dark"]  { --bg:#0f1117; --bg2:#1a1d27; --bg3:#252836; --border:#2d3148; --text:#e2e8f0; --muted:#9ca3af }

*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'SF Mono','Cascadia Code','Consolas',monospace;background:var(--bg);color:var(--text);line-height:1.6}
h1{font-size:1.4rem;font-weight:800;letter-spacing:-.02em}
h2{font-size:1rem;font-weight:700;color:var(--accent);margin:2rem 0 .6rem;border-bottom:1px solid var(--border);padding-bottom:.35rem}
h3{font-size:.85rem;font-weight:600;margin:1rem 0 .4rem;color:var(--muted)}
p,li{font-size:.83rem;color:var(--muted)}
a{color:var(--accent);text-decoration:none}

.header{background:var(--bg2);border-bottom:1px solid var(--border);padding:1rem 2rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
.hm{font-size:.72rem;color:var(--muted)}
.badge{font-size:.68rem;padding:2px 8px;border-radius:12px;background:var(--bg3);border:1px solid var(--border);white-space:nowrap}
.container{max-width:1280px;margin:0 auto;padding:1.25rem 2rem}
.theme-toggle{margin-left:auto;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:3px 10px;border-radius:4px;cursor:pointer;font-size:.72rem}

.verdict-banner{border-radius:8px;padding:1.1rem 1.4rem;margin:1.25rem 0;background:var(--bg2);border:2px solid;display:grid;grid-template-columns:auto 1fr;gap:1rem;align-items:center}
.verdict-score{font-size:3rem;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.verdict-text{font-size:.95rem;font-weight:700}
.verdict-sub{font-size:.78rem;color:var(--muted);margin-top:.25rem}

.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin:.75rem 0}
.stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:.75rem}
.stat-label{font-size:.67rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.stat-value{font-size:1.3rem;font-weight:700;font-variant-numeric:tabular-nums;margin-top:.2rem}

.section{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:1.1rem 1.4rem;margin-bottom:1rem}
.proposal-card{margin-bottom:.8rem}
.proposal-grid{display:grid;gap:.6rem}
.field-label{font-size:.67rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:.15rem}
.field-val{font-size:.81rem;color:var(--text);line-height:1.5}
.code-ref{font-family:monospace;color:var(--accent);font-size:.78rem}

.dt{width:100%;border-collapse:collapse;font-size:.8rem;font-variant-numeric:tabular-nums}
.dt th{padding:.45rem .7rem;text-align:left;background:var(--bg3);color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}
.dt td{padding:.4rem .7rem;border-top:1px solid var(--border)}
.dt tr:hover td{background:var(--bg3)}
.ts{overflow-x:auto}

.two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media(max-width:720px){.two-col{grid-template-columns:1fr}}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem}
@media(max-width:900px){.three-col{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.three-col{grid-template-columns:1fr}}

.insight-list{list-style:none;padding:0}
.insight-list li{font-size:.82rem;padding:.3rem 0;color:var(--text);display:flex;gap:.5rem;border-top:1px solid var(--border)}
.insight-list li:first-child{border-top:none}
.insight-list li::before{content:'›';color:var(--accent);font-size:1rem;line-height:1.4;flex-shrink:0}

.gauge-row{display:flex;gap:1.5rem;flex-wrap:wrap;justify-content:center;padding:.5rem 0}
.chart-wrap{overflow-x:auto;padding:.5rem 0}
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Sentinel Phase 2</h1>
    <div class="hm">Professional Trading Validation — ${PHASE2_SYMBOLS_COUNT} symbols × 4 timeframes</div>
  </div>
  <span class="badge">15 symbols</span>
  <span class="badge">4 timeframes</span>
  <span class="badge">${overall.totalSnapshots.toLocaleString()} snapshots</span>
  <span class="badge">${fmtDate(Date.now())}</span>
  <button class="theme-toggle" onclick="toggleTheme()">Toggle Theme</button>
</div>

<div class="container">

<!-- ─── VERDICT ─────────────────────────────────────────────────────────── -->
<h2>Production Readiness Verdict</h2>
<div class="verdict-banner" style="border-color:${scoreCol}">
  <div class="verdict-score" style="color:${scoreCol}">${score}</div>
  <div>
    <div class="verdict-text" style="color:${scoreCol}">${esc(verdict)}</div>
    <div class="verdict-sub">Score out of 100 — win rate, expectancy, calibration, signal rate, loss quality</div>
  </div>
</div>

<!-- ─── EXECUTIVE SUMMARY ─────────────────────────────────────────────────── -->
<h2>Executive Summary</h2>
<div class="stats-grid">
  <div class="stat-card"><div class="stat-label">Total Snapshots</div><div class="stat-value">${overall.totalSnapshots.toLocaleString()}</div></div>
  <div class="stat-card"><div class="stat-label">Actionable Trades</div><div class="stat-value">${overall.actionableCount.toLocaleString()} <span style="font-size:.8rem;color:var(--muted)">(${pct(overall.signalRate, 0)})</span></div></div>
  <div class="stat-card"><div class="stat-label">Win Rate</div><div class="stat-value" style="color:${scoreColor(overall.winRate)}">${pct(overall.winRate)}</div></div>
  <div class="stat-card"><div class="stat-label">Avg Setup R:R</div><div class="stat-value">${num(overall.avgSetupRR)}</div></div>
  <div class="stat-card"><div class="stat-label">Expectancy</div><div class="stat-value" style="color:${overall.expectancy !== null && overall.expectancy >= 0 ? 'var(--green)' : 'var(--red)'}">${num(overall.expectancy)}R</div></div>
  <div class="stat-card"><div class="stat-label">Wins</div><div class="stat-value" style="color:var(--green)">${overall.winCount}</div></div>
  <div class="stat-card"><div class="stat-label">Losses</div><div class="stat-value" style="color:var(--red)">${overall.lossCount}</div></div>
  <div class="stat-card"><div class="stat-label">Inconclusive</div><div class="stat-value" style="color:var(--muted)">${overall.neitherCount}</div></div>
</div>

<!-- Scoring breakdown -->
<div class="section">
  <h3>Scoring Breakdown</h3>
  <ul class="insight-list">
    ${metrics.productionReadinessDetails.map(d => `<li>${esc(d)}</li>`).join('')}
  </ul>
</div>

<!-- ─── PHASE 5: PRO TRADER REVIEW ────────────────────────────────────────── -->
<h2>Phase 5 — Professional Trader Review</h2>

<div class="three-col">
  <div class="section">
    <h3>Pro-Grade Filter (conf ≥ 7, quality excellent/good)</h3>
    <div class="stats-grid" style="grid-template-columns:1fr 1fr">
      <div class="stat-card"><div class="stat-label">All Setups WR</div><div class="stat-value" style="color:${scoreColor(phase5.allSetups.winRate)}">${pct(phase5.allSetups.winRate)}</div></div>
      <div class="stat-card"><div class="stat-label">Pro-Grade WR</div><div class="stat-value" style="color:${scoreColor(phase5.proGradeSetups.winRate)}">${pct(phase5.proGradeSetups.winRate)}</div></div>
    </div>
    <p style="margin-top:.5rem;font-size:.78rem">${phase5.proGradeSetups.total} pro-grade trades / ${phase5.allSetups.total} total resolved</p>
  </div>
  <div class="section">
    <h3>Trade Quality Scores</h3>
    <div class="gauge-row">
      ${qualityGauge(phase5.entryQuality.score, 'Entry')}
      ${qualityGauge(phase5.stopQuality.score, 'Stop')}
      ${qualityGauge(phase5.targetQuality.score, 'Target')}
    </div>
    <p style="font-size:.75rem;text-align:center;margin-top:.25rem">Entry / Stop / Target placement quality (0–100)</p>
  </div>
  <div class="section">
    <h3>Symbol Category Win Rates</h3>
    <div class="ts">${categoryTable(phase5)}</div>
  </div>
</div>

<div class="section">
  <h3>Professional Trader Insights</h3>
  ${phase5.proInsights.length === 0
    ? '<p>No specific insights generated.</p>'
    : `<ul class="insight-list">${phase5.proInsights.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
  }
</div>

<div class="section">
  <h3>Stop Placement Analysis</h3>
  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card" style="border-color:var(--red)"><div class="stat-label">Too Tight (&lt;0.5%)</div><div class="stat-value" style="color:var(--red)">${phase5.stopQuality.tooTight}</div></div>
    <div class="stat-card" style="border-color:var(--green)"><div class="stat-label">Appropriate</div><div class="stat-value" style="color:var(--green)">${phase5.stopQuality.appropriate}</div></div>
    <div class="stat-card" style="border-color:var(--yellow)"><div class="stat-label">Wide (&gt;4%)</div><div class="stat-value" style="color:var(--yellow)">${phase5.stopQuality.tooWide}</div></div>
  </div>
</div>

<!-- ─── PHASE 4: WEAKNESS IDENTIFICATION ──────────────────────────────────── -->
<h2>Phase 4 — Weakness Identification</h2>
<div class="section">
  <div class="ts">${phase4Table(phase4)}</div>
</div>

<!-- ─── PHASE 6: PROPOSALS ────────────────────────────────────────────────── -->
<h2>Phase 6 — Evidence-Based Fix Proposals</h2>
<div class="section" style="margin-bottom:.5rem">
  <p style="font-size:.83rem;color:var(--text)">${esc(phase6.summary)}</p>
</div>
${proposalCards(phase6)}

<!-- ─── CONFIDENCE CALIBRATION ────────────────────────────────────────────── -->
<h2>Confidence Calibration</h2>
<div class="two-col">
  <div class="section">
    <h3>Win Rate vs Expected Win Rate by Confidence Bucket</h3>
    <div class="ts">${confTable(dashboards, phase5)}</div>
    <p style="margin-top:.5rem;font-size:.75rem">Delta = actual WR − expected WR. Negative = engine is overconfident at that score level.</p>
  </div>
  <div class="section">
    <h3>Calibration Chart</h3>
    <div class="chart-wrap">
      ${confBars.length > 0
        ? svgBars(confBars, 100, 480, Math.max(160, confBars.length * 24 + 40))
        : '<p>Insufficient data</p>'}
    </div>
  </div>
</div>

<!-- ─── REGIME ANALYSIS ───────────────────────────────────────────────────── -->
<h2>Market Regime Analysis</h2>
<div class="two-col">
  <div class="section">
    <h3>Win Rate by Regime</h3>
    <div class="ts">${regimeTable(metrics)}</div>
  </div>
  <div class="section">
    <h3>Regime Win Rate Chart</h3>
    <div class="chart-wrap">
      ${regimeBars.length > 0
        ? svgBars(regimeBars, 100, 480, Math.max(160, regimeBars.length * 26 + 40))
        : '<p>Insufficient resolved trades</p>'}
    </div>
  </div>
</div>

<!-- ─── MTF AGREEMENT ─────────────────────────────────────────────────────── -->
<h2>Multi-Timeframe Agreement</h2>
<div class="section">
  <p style="margin-bottom:.75rem">For each symbol, snapshots are binned by position (decile). Directions from all available timeframes are compared. Win rate by agreement level reveals whether timeframe alignment predicts outcomes.</p>
  <div class="ts">${mtfTable(metrics)}</div>
</div>

<!-- ─── LOSS BREAKDOWN ────────────────────────────────────────────────────── -->
<h2>Loss Categorization (${overall.lossCount} total losses)</h2>
<div class="two-col">
  <div class="section">
    <div class="ts">${lossCatTable(metrics)}</div>
  </div>
  <div class="section">
    <h3>Loss Category Chart</h3>
    <div class="chart-wrap">
      ${lossBars.length > 0
        ? svgBars(lossBars, maxLossVal, 480, Math.max(140, lossBars.length * 26 + 40))
        : '<p>No losses recorded</p>'}
    </div>
  </div>
</div>

<!-- ─── PER-SYMBOL ────────────────────────────────────────────────────────── -->
<h2>Per-Symbol Results (15 Symbols)</h2>
<div class="section"><div class="ts">${symbolTable(metrics)}</div></div>

<!-- ─── PER-TIMEFRAME ─────────────────────────────────────────────────────── -->
<h2>Per-Timeframe Results (15m / 1h / 4h / 1d)</h2>
<div class="section"><div class="ts">${timeframeTable(metrics, phase5)}</div></div>

<!-- ─── DETAILED DATASETS ─────────────────────────────────────────────────── -->
<h2>Detailed Per-Dataset Results (${results.length} datasets)</h2>
${dashboards.map(d => {
  const act = d.overall.actionableTradeCount
  const wr  = d.overall.winRate
  const exp = d.overall.averageSetupRR !== null && wr !== null
    ? wr * d.overall.averageSetupRR - (1 - wr) * 1.0 : null
  return `
  <details>
    <summary style="cursor:pointer;padding:.4rem .7rem;background:var(--bg3);border-radius:4px;margin:.3rem 0;font-size:.82rem">
      <strong>${d.symbol} / ${d.interval}</strong>
      &nbsp; snap:${d.overall.totalSnapshots}
      &nbsp; act:${act}
      &nbsp; WR:<span style="color:${scoreColor(wr)};font-weight:600">${pct(wr)}</span>
      &nbsp; exp:${num(exp)}R
    </summary>
    <div style="margin:.2rem 0 .6rem;padding:0 .5rem">
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-top:.4rem">
        <div class="stat-card"><div class="stat-label">Win Rate</div><div class="stat-value" style="color:${scoreColor(wr)}">${pct(wr)}</div></div>
        <div class="stat-card"><div class="stat-label">Avg Setup R:R</div><div class="stat-value">${num(d.overall.averageSetupRR)}</div></div>
        <div class="stat-card"><div class="stat-label">Top Phase</div><div class="stat-value" style="font-size:.75rem">${d.topPerformingPhases[0] ?? '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Common Failure</div><div class="stat-value" style="font-size:.75rem">${d.mostCommonFailureReasons[0] ?? '—'}</div></div>
      </div>
    </div>
  </details>`
}).join('')}

<!-- ─── FINAL VERDICT ─────────────────────────────────────────────────────── -->
<h2>Final Answer — Is the Engine Ready for Production?</h2>
<div class="section" style="border-color:${scoreCol}">
  <div style="font-size:1.05rem;font-weight:800;color:${scoreCol};margin-bottom:.75rem">${esc(verdict)}</div>
  <ul class="insight-list">
    <li>Win rate: <strong style="color:${scoreColor(overall.winRate)}">${pct(overall.winRate)}</strong> across ${overall.winCount + overall.lossCount} resolved trades (${overall.totalSnapshots} total snapshots)</li>
    <li>Expectancy: <strong style="color:${overall.expectancy !== null && overall.expectancy >= 0 ? 'var(--green)' : 'var(--red)'}">${num(overall.expectancy)}R per trade</strong></li>
    <li>Signal rate: <strong>${pct(overall.signalRate, 0)}</strong> of snapshots produce actionable trades</li>
    <li>Weaknesses found: <strong>${phase4.weaknesses.length}</strong> (${phase4.weaknesses.filter(w => w.severity === 'high' || w.severity === 'critical').length} high/critical)</li>
    <li>Proposals generated: <strong>${phase6.proposals.length}</strong> (${phase6.proposals.filter(p => p.priority === 'high').length} high priority)</li>
  </ul>
  <p style="color:var(--muted);font-size:.73rem;margin-top:.9rem">
    Validation used synthetic multi-regime candles (deterministic, seeded RNG) covering 9 market conditions
    across 15 symbols × 4 timeframes (60 datasets). No look-ahead bias, no live data.
    ${phase6.proposals.length > 0
      ? 'Proposals must be implemented and re-validated before production deployment.'
      : 'Engine meets production threshold based on current synthetic validation.'}
  </p>
</div>

</div><!-- container -->

<script>
const PHASE2_SYMBOLS_COUNT = 15
function toggleTheme() {
  const r = document.documentElement
  r.setAttribute('data-theme', r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
}
</script>
</body>
</html>`
    .replace('${PHASE2_SYMBOLS_COUNT}', '15')
}

const PHASE2_SYMBOLS_COUNT = 15
