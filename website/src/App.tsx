import { useState, useEffect, useRef, useCallback } from 'react'

const GITHUB = 'https://github.com/fakej3/Sentinel'
const RELEASES = `${GITHUB}/releases`
const BLOB = `${GITHUB}/blob/main`

// ── DATA ──────────────────────────────────────────────────────────────────────

const STAGES = [
  { id: 1, name: 'Candle Fetch', desc: 'OHLCV data from Binance REST API — up to 1,000 candles per request.', category: 'Data' },
  { id: 2, name: 'Indicators', desc: 'EMA 9/21/50/200, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI.', category: 'Compute' },
  { id: 3, name: 'Market Structure', desc: 'HH/HL/LH/LL, Break of Structure, Change of Character, pullback identification.', category: 'Compute' },
  { id: 4, name: 'Support & Resistance', desc: 'Zone detection from pivots, strength scoring, confluence with indicator levels.', category: 'Compute' },
  { id: 5, name: 'Volume Analysis', desc: 'Buy/sell pressure ratios, climax detection, VWAP deviation, A/D, OBV divergence.', category: 'Compute' },
  { id: 6, name: 'Trend Synthesis', desc: 'Full trend label from 9 bull/bear/neutral conditions weighted across all modules.', category: 'Synthesis' },
  { id: 7, name: 'Evidence Builder', desc: 'Converts module output into typed evidence items: direction, impact, source stage.', category: 'Synthesis' },
  { id: 8, name: 'Validation', desc: 'Cross-module consistency checks, data quality gates, contradictory signal detection.', category: 'Validation' },
  { id: 9, name: 'Confidence Scoring', desc: 'Evidence-weighted score 0–10, letter grade A–F, trust rating from data completeness.', category: 'Scoring' },
  { id: 10, name: 'Trade Plan', desc: 'Entry zone, stop loss, three targets, risk/reward ratio, maturity and quality scores.', category: 'Output' },
  { id: 11, name: 'Writer', desc: 'Deterministic narrative from structured data. Optional Gemini AI for richer prose.', category: 'Output' },
]

const CATEGORY_COLOR: Record<string, string> = {
  Data: '#7a8ba8',
  Compute: '#2f7bff',
  Synthesis: '#a78bfa',
  Validation: '#f0a830',
  Scoring: '#22c55e',
  Output: '#e8edf5',
}

const FEATURES = [
  { tag: 'Architecture', title: 'No server. No account.', body: 'The entire 11-stage pipeline runs in-process inside the Tauri webview. Nothing to deploy, no subscription, no data leaving your machine.' },
  { tag: 'Privacy', title: 'Offline-first by design', body: 'Candle data fetched from Binance when connected — then everything else is local. Analysis results, history, and settings never leave your device.' },
  { tag: 'Indicators', title: '10+ built-in indicators', body: 'EMA 9/21/50/200, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI — all computed from first principles against raw candle data.' },
  { tag: 'Market Structure', title: 'Structural pattern detection', body: 'Higher highs, higher lows, lower highs, lower lows, Break of Structure, Change of Character, pullbacks, consolidation ranges — all rule-based.' },
  { tag: 'Confidence', title: 'Evidence-weighted scoring', body: 'Each module produces typed evidence items. The confidence engine aggregates them, detects contradictions, and outputs a score from 0–10 with a letter grade.' },
  { tag: 'Volume', title: 'Volume pressure analysis', body: 'Buy/sell volume ratios, volume climax detection, VWAP deviation, Accumulation/Distribution, OBV divergence from price — all computed, not approximated.' },
  { tag: 'S/R Zones', title: 'Dynamic support & resistance', body: 'Zone detection from pivot points and price reactions, strength scoring, and confluence mapping with EMA and VWAP levels.' },
  { tag: 'Trade Planning', title: 'Structured trade plans', body: 'Entry zone, stop loss, three profit targets, risk/reward ratio, maturity score, setup quality — every number derived from the pipeline, never invented.' },
  { tag: 'Timeframes', title: 'Full timeframe coverage', body: 'Any symbol across 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M candles from Binance spot and USD-M futures.' },
  { tag: 'History', title: 'Local analysis history', body: 'Every saved analysis is stored in local AppData. Review past setups, compare confidence across timeframes, and track how your edge evolves.' },
  { tag: 'AI Layer', title: 'Optional AI narration', body: 'After the deterministic pipeline finishes, Gemini can write richer prose. The AI only writes — it never calculates, decides, or invents a number.' },
  { tag: 'Open Source', title: 'MIT licensed — fully open', body: 'Audit every line of analysis logic. Fork it, self-host it, extend it. The entire pipeline is open to inspection and contribution.' },
]

const ROADMAP = [
  { phase: 'Now', title: 'Desktop v1', items: ['11-stage analysis pipeline', 'Binance spot + futures', 'Local history & persistence', 'Gemini AI narration', 'Windows / macOS / Linux'], status: 'current' },
  { phase: 'Next', title: 'Website', items: ['Public marketing site', 'Documentation portal', 'Download distribution', 'GitHub Pages hosting'], status: 'active' },
  { phase: 'Q3 2025', title: 'Mobile', items: ['iOS (SwiftUI)', 'Android (Kotlin)', 'Offline-first same pipeline', 'Optional desktop sync'], status: 'planned' },
  { phase: 'Q4 2025', title: 'Backend', items: ['Self-hostable server', 'Team analysis sharing', 'Webhook alerts', 'REST API'], status: 'planned' },
  { phase: '2026', title: 'API & Integrations', items: ['Developer REST API', 'TradingView bridge', 'Bybit + Coinbase', 'Custom indicator plugins'], status: 'future' },
  { phase: 'Future', title: 'More Exchanges', items: ['Bybit', 'Coinbase Advanced', 'OKX', 'Kraken', 'Hyperliquid'], status: 'future' },
]

const FAQ = [
  { q: 'Why desktop-first and not a web app?', a: "A desktop app runs entirely on your machine — no server sees your analysis, API keys, or trading activity. The Tauri architecture gives us native performance, a local database, and the ability to work offline. A web app would require a backend, which would mean storing your data on someone else's server." },
  { q: 'Does Sentinel use AI to make trading decisions?', a: "No. The 11-stage pipeline is entirely deterministic. Indicators use published formulas. Market structure follows documented rules. Confidence is computed from evidence items using fixed weights. The optional Gemini integration is a writer — it receives the finished result and formats it into prose. It never drives the analysis." },
  { q: 'Does anything leave my machine?', a: "Two things: Binance API calls to fetch candle data, and Gemini API calls if you enable AI narration. Your analysis results, history, settings, and any API keys you configure are stored locally in AppData. Nothing is sent to Sentinel servers — there are no Sentinel servers." },
  { q: 'Which exchanges does Sentinel support?', a: "Currently Binance — both spot and USD-M futures pairs. Bybit, Coinbase Advanced, OKX, and Kraken support are on the roadmap. The architecture is exchange-agnostic; adding a new exchange means implementing a single fetch adapter." },
  { q: 'Why do I need a Gemini API key for AI narration?', a: "The Gemini key is stored locally and used to call Google's API directly from your machine. Sentinel never sees or proxies your key. If you don't add a key, the deterministic writer produces a complete analysis report without AI enhancement." },
  { q: 'Is Sentinel free? Will it always be free?', a: "Yes, and yes. Sentinel is MIT licensed. The core analysis engine will always be open source and free. Future premium features like backend sync or team sharing may be optional paid additions, but the desktop app itself stays free." },
  { q: 'How do I build from source?', a: "Clone the repo, install Rust and Node 20, then run `npm install && npm run tauri dev` from the `desktop/` directory. See CONTRIBUTING.md for the full setup guide. Building from source gives you a fully auditable, locally compiled binary." },
  { q: 'How is confidence calculated?', a: "Each analysis module produces typed evidence items with a direction (bull/bear/neutral) and impact level (strong/moderate/weak). The confidence engine sums bull vs bear evidence, weights by impact, checks for contradictions, and applies a data completeness penalty. Score is 0–10. Grade A = 8+, B = 6–8, C = 4–6, D = 2–4, F below 2." },
]

const DOCS_LINKS = [
  { title: 'Architecture', desc: 'Pipeline design, module contracts, data flow diagram', path: 'desktop/docs/ARCHITECTURE.md' },
  { title: 'Roadmap', desc: 'Planned features, phases, and delivery timeline', path: 'desktop/docs/ROADMAP.md' },
  { title: 'Versioning', desc: 'Release process, tagging convention, secret setup', path: 'desktop/docs/VERSIONING.md' },
  { title: 'Changelog', desc: 'What changed in each release, version by version', path: 'desktop/docs/CHANGELOG.md' },
  { title: 'Contributing', desc: 'Development setup, code style guide, PR process', path: 'CONTRIBUTING.md' },
]

// ── SHARED UTILITIES ──────────────────────────────────────────────────────────

const s = {
  container: { maxWidth: 1200, margin: '0 auto', padding: '0 24px' } as React.CSSProperties,
  sectionPad: { padding: '96px 24px' } as React.CSSProperties,
}

function SectionLabel({ children, color = 'var(--accent)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color, marginBottom: 12 }}>
      {children}
    </div>
  )
}

function SectionHeader({
  id, eyebrow, title, subtitle, eyebrowColor,
}: { id?: string; eyebrow: string; title: string; subtitle?: string; eyebrowColor?: string }) {
  return (
    <div id={id} style={{ marginBottom: 56 }}>
      <SectionLabel color={eyebrowColor}>{eyebrow}</SectionLabel>
      <h2 style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', textWrap: 'balance', lineHeight: 1.15 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ marginTop: 16, fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.7, maxWidth: 580 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ── NAV ───────────────────────────────────────────────────────────────────────

function NavLogo() {
  return (
    <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label="Sentinel home">
      <div style={{
        width: 30, height: 30, borderRadius: 7, background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 16px var(--accent-glow)',
        flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2L13 8L8 14L3 8L8 2Z" fill="white" fillOpacity="0.85" />
          <path d="M8 5.5L11 8L8 10.5L5 8L8 5.5Z" fill="white" />
        </svg>
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Sentinel</span>
    </a>
  )
}

function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Pipeline', href: '#pipeline' },
    { label: 'Downloads', href: '#downloads' },
    { label: 'Docs', href: '#docs' },
    { label: 'Roadmap', href: '#roadmap' },
  ]

  return (
    <nav
      id="top"
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: scrolled ? 'rgba(10,13,20,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 0.2s, backdrop-filter 0.2s, border-color 0.2s',
      }}
    >
      <div style={{ ...s.container, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <NavLogo />

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} role="list">
          {links.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              role="listitem"
              style={{ fontSize: 14, color: 'var(--text-dim)', transition: 'color 0.15s', fontWeight: 500 }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              {label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Sentinel on GitHub"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 13, padding: '7px 16px', borderRadius: 7,
              background: 'var(--surface-raised)', border: '1px solid var(--border-strong)',
              color: 'var(--text)', fontWeight: 500, transition: 'border-color 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0.5C3.86 0.5 0.5 3.86 0.5 8c0 3.32 2.15 6.14 5.14 7.14.38.07.52-.16.52-.36v-1.27c-2.1.46-2.54-.88-2.54-.88-.34-.87-.83-1.1-.83-1.1-.68-.46.05-.45.05-.45.75.05 1.15.77 1.15.77.67 1.15 1.76.82 2.19.63.07-.49.26-.82.47-1.01-1.67-.19-3.43-.84-3.43-3.73 0-.82.29-1.5.77-2.03-.08-.19-.33-.96.07-2 0 0 .63-.2 2.06.77.6-.17 1.24-.25 1.88-.25.64 0 1.28.08 1.88.25 1.43-.97 2.06-.77 2.06-.77.4 1.04.15 1.81.07 2 .48.53.77 1.21.77 2.03 0 2.9-1.77 3.54-3.45 3.73.27.23.51.69.51 1.39v2.06c0 .2.14.44.52.36C13.35 14.14 15.5 11.32 15.5 8c0-4.14-3.36-7.5-7.5-7.5z"/>
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </nav>
  )
}

// ── HERO ──────────────────────────────────────────────────────────────────────

function ConfidenceRing({ score }: { score: number }) {
  const size = 76
  const sw = 5.5
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const arc = Math.min(1, score / 10) * circ * 0.75
  const gap = circ - arc
  const c = size / 2
  const col = score >= 7 ? '#22c55e' : score >= 4 ? '#2f7bff' : '#ef4444'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-label={`Confidence score ${score}/10`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-135deg)' }} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={sw}
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={`${arc} ${gap + circ * 0.25}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${col}90)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 17, fontWeight: 800, color: col, lineHeight: 1 }}>{score.toFixed(1)}</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>/10</span>
      </div>
    </div>
  )
}

function MockWindow() {
  const evidenceItems = [
    { label: 'Price above all 4 EMAs', dir: 'bull' },
    { label: 'BOS confirmed — higher high', dir: 'bull' },
    { label: 'Volume 1.8× average', dir: 'bull' },
    { label: 'RSI 62 — moderate bullish', dir: 'bull' },
    { label: 'StochRSI overbought — caution', dir: 'bear' },
  ]

  return (
    <div
      role="img"
      aria-label="Sentinel desktop app showing BTC/USDT analysis with 7.8/10 confidence score"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* Window chrome */}
      <div style={{
        background: 'var(--ink)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)',
          fontWeight: 500, letterSpacing: '-0.01em',
        }}>
          Sentinel — BTC/USDT · 4h
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 0, overflowX: 'auto', padding: '0 12px',
      }}>
        {['Summary', 'Trade Plan', 'Evidence', 'Indicators', 'Structure', 'Volume'].map((tab, i) => (
          <div key={tab} style={{
            padding: '8px 14px', fontSize: 12, fontWeight: i === 0 ? 600 : 400,
            color: i === 0 ? 'var(--text)' : 'var(--text-dim)',
            borderBottom: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
            whiteSpace: 'nowrap', cursor: 'default',
          }}>
            {tab}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>BTC/USDT</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>4h · Binance</span>
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
              $97,420
              <span style={{ fontSize: 12, color: '#22c55e', marginLeft: 6, fontWeight: 600 }}>+2.4%</span>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)',
            letterSpacing: '0.02em',
          }}>
            Strong Bullish
          </div>
        </div>

        {/* Confidence + evidence */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <ConfidenceRing score={7.8} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Evidence</div>
            {evidenceItems.map((ev) => (
              <div key={ev.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 5 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: ev.dir === 'bull' ? '#22c55e' : '#ef4444',
                }} />
                <span style={{ color: 'var(--text-dim)' }}>{ev.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trade plan */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Trade Plan</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[
              { label: 'Entry', value: '$96,800–$97,200', color: 'var(--text)' },
              { label: 'Stop', value: '$94,500', color: '#ef4444' },
              { label: 'R:R', value: '2.4 : 1', color: '#22c55e' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'var(--surface-high)', padding: '7px 10px',
                borderRadius: 4, border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                <div className="mono" style={{ fontSize: 11, fontWeight: 600, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 80,
        paddingBottom: 100,
      }}
    >
      {/* Dot grid background */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 100% at 50% 0%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 100% at 50% 0%, black 40%, transparent 100%)',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />

      {/* Accent glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 400,
          background: 'radial-gradient(ellipse, rgba(47,123,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ ...s.container, position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* Left: copy */}
          <div>
            <div style={{
              display: 'inline-flex', padding: '4px 12px', borderRadius: 20,
              background: 'rgba(240,168,48,0.1)', color: 'var(--signal)',
              border: '1px solid rgba(240,168,48,0.2)',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.03em',
              marginBottom: 28,
            }}>
              Free & Open Source — Early Access
            </div>

            <h1
              id="hero-heading"
              style={{
                fontSize: 'clamp(34px, 4.5vw, 60px)',
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: '-0.035em',
                textWrap: 'balance',
              }}
            >
              Crypto analysis.{' '}
              <span style={{ color: 'var(--accent)' }}>On your machine.</span>
            </h1>

            <p style={{ marginTop: 24, fontSize: 17, color: 'var(--text-dim)', lineHeight: 1.75, maxWidth: 460 }}>
              Sentinel runs a deterministic 11-stage analysis pipeline entirely on your machine.
              No subscription. No cloud. No data leaving your device.
            </p>

            <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a
                href={RELEASES}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                  background: 'var(--accent)', color: 'white',
                  boxShadow: '0 0 24px var(--accent-glow), 0 2px 6px rgba(0,0,0,0.3)',
                  transition: 'opacity 0.15s, transform 0.15s',
                  border: 'none',
                }}
                onMouseOver={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = '' }}
              >
                Download Free
              </a>
              <a
                href={GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                  background: 'transparent', color: 'var(--text)',
                  border: '1px solid var(--border-strong)',
                  transition: 'border-color 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              >
                View Source
              </a>
            </div>

            <div style={{ marginTop: 36, display: 'flex', gap: 28 }}>
              {[
                { value: '11', label: 'pipeline stages' },
                { value: '10+', label: 'indicators' },
                { value: '0', label: 'servers required' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em' }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: mock app window */}
          <div>
            <MockWindow />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FEATURES ──────────────────────────────────────────────────────────────────

function FeatureGrid() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          eyebrow="Features"
          title="Everything you need. Nothing you don't."
          subtitle="Twelve capabilities — every one of them computed locally, from first principles, with documented sources."
        />
        <div
          id="features-heading"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 2 }}
          role="list"
        >
          {FEATURES.map((f) => (
            <article
              key={f.title}
              role="listitem"
              style={{ background: 'var(--surface)', padding: '28px 28px', transition: 'background 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
              onMouseOut={e => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 10 }}>
                {f.tag}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.65 }}>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── PIPELINE ──────────────────────────────────────────────────────────────────

function PipelineSection() {
  const [expanded, setExpanded] = useState<number | null>(null)

  const toggle = useCallback((id: number) => {
    setExpanded(prev => prev === id ? null : id)
  }, [])

  return (
    <section id="pipeline" aria-labelledby="pipeline-heading">
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          id="pipeline-heading"
          eyebrow="Analysis Engine"
          title="11 stages. Every number has a source."
          subtitle="The pipeline is deterministic. Each stage produces typed, documented output. The AI writer receives the finished result — it never drives the analysis."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }} role="list" aria-label="Pipeline stages">
          {STAGES.map((stage, i) => {
            const isLast = i === STAGES.length - 1
            const isOpen = expanded === stage.id
            const catColor = CATEGORY_COLOR[stage.category] ?? 'var(--text-dim)'

            return (
              <div key={stage.id} role="listitem" style={{ position: 'relative' }}>
                {/* Connecting line */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute', left: 22, top: 52, bottom: -4,
                      width: 1, background: 'var(--border)',
                      zIndex: 0,
                    }}
                  />
                )}

                <button
                  onClick={() => toggle(stage.id)}
                  aria-expanded={isOpen}
                  aria-controls={`stage-${stage.id}-body`}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: isOpen ? 'var(--surface-raised)' : 'transparent',
                    border: 'none', borderRadius: 8,
                    padding: '12px 16px 12px 0',
                    display: 'flex', alignItems: 'flex-start', gap: 16,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    position: 'relative', zIndex: 1,
                  }}
                >
                  {/* Stage number bubble */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'var(--ink)', border: '1px solid var(--border-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    color: catColor,
                    fontSize: 13, fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {String(stage.id).padStart(2, '0')}
                  </div>

                  <div style={{ flex: 1, paddingTop: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>{stage.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '2px 6px', borderRadius: 3,
                        background: `${catColor}18`, color: catColor,
                      }}>
                        {stage.category}
                      </span>
                    </div>
                    <div
                      id={`stage-${stage.id}-body`}
                      style={{
                        fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6,
                        maxHeight: isOpen ? '100px' : '0',
                        overflow: 'hidden',
                        transition: 'max-height 0.25s ease',
                      }}
                    >
                      {stage.desc}
                    </div>
                  </div>

                  {/* Chevron */}
                  <div style={{
                    marginTop: 10, color: 'var(--text-faint)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 40, padding: '20px 24px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: 'var(--text)' }}>Deterministic.</strong>{' '}
            Given the same candle data, the pipeline always produces the same output — to the decimal point.
            Confidence scores, trade plans, and evidence items are reproducible. The Gemini AI layer is opt-in and does not affect any computed values.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── SHOWCASE ──────────────────────────────────────────────────────────────────

function ShowcaseSection() {
  const tabs = ['Summary', 'Trade Plan', 'Evidence', 'Indicators', 'Structure', 'Volume', 'Validation', 'Writer', 'Overview']
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          id="showcase-heading"
          eyebrow="Desktop App"
          title="A full analysis suite. No browser tab required."
          subtitle="Nine views. Every angle of the analysis in one place, stored locally, available offline."
        />

        {/* Tab picker */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 32 }} role="tablist" aria-label="Analysis views">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === i}
              aria-controls={`showcase-panel-${i}`}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: activeTab === i ? 'var(--accent)' : 'var(--surface-raised)',
                color: activeTab === i ? 'white' : 'var(--text-dim)',
                border: activeTab === i ? '1px solid transparent' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Mock desktop frame */}
        <div
          style={{
            background: 'var(--ink)',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 32px 100px rgba(0,0,0,0.5)',
          }}
          role="tabpanel"
          id={`showcase-panel-${activeTab}`}
          aria-label={`${tabs[activeTab]} view`}
        >
          {/* Chrome */}
          <div style={{ background: '#0a0d14', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
              {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                fontSize: 12, color: 'var(--text-dim)', fontWeight: 500,
                background: 'var(--surface-raised)', padding: '3px 16px',
                borderRadius: 4, border: '1px solid var(--border)',
              }}>
                Sentinel
              </div>
            </div>
          </div>

          {/* App body */}
          <div style={{ display: 'flex', height: 400 }}>
            {/* Sidebar */}
            <div style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--surface-raised)', padding: '12px 0', flexShrink: 0 }}>
              <div style={{ padding: '0 12px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>
                Recent Analyses
              </div>
              {[
                { symbol: 'BTC/USDT', tf: '4h', score: 7.8, trend: 'Bullish' },
                { symbol: 'ETH/USDT', tf: '1d', score: 5.2, trend: 'Neutral' },
                { symbol: 'SOL/USDT', tf: '1h', score: 6.4, trend: 'Bullish' },
                { symbol: 'BTC/USDT', tf: '1d', score: 8.1, trend: 'Strong Bull' },
                { symbol: 'LINK/USDT', tf: '4h', score: 3.1, trend: 'Bearish' },
              ].map((item, i) => (
                <div
                  key={`${item.symbol}-${i}`}
                  style={{
                    padding: '9px 12px', cursor: 'default',
                    background: i === 0 ? 'var(--surface-high)' : 'transparent',
                    borderLeft: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{item.symbol}</span>
                    <span className="mono" style={{
                      fontSize: 11, fontWeight: 700,
                      color: item.score >= 7 ? '#22c55e' : item.score >= 4 ? '#2f7bff' : '#ef4444',
                    }}>
                      {item.score}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{item.tf} · {item.trend}</div>
                </div>
              ))}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {/* Tab indicator */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                {tabs.map((tab, i) => (
                  <div key={tab} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 3,
                    background: i === activeTab ? 'var(--accent)' : 'transparent',
                    color: i === activeTab ? 'white' : 'var(--text-faint)',
                    fontWeight: i === activeTab ? 600 : 400,
                  }}>
                    {tab}
                  </div>
                ))}
              </div>

              {/* Summary view content */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Trend', value: 'Strong Bullish', color: '#22c55e' },
                  { label: 'Confidence', value: '7.8 / 10 (A)', color: '#22c55e' },
                  { label: 'Market Structure', value: 'Uptrend — BOS', color: '#22c55e' },
                  { label: 'Volume Pressure', value: '68% Buy', color: '#22c55e' },
                  { label: 'Entry Zone', value: '$96,800–$97,200', color: 'var(--text)' },
                  { label: 'Risk / Reward', value: '2.4 : 1', color: 'var(--text)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: 'var(--surface-raised)', padding: '12px 14px',
                    borderRadius: 6, border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                      {label}
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600, color }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, padding: '14px', background: 'var(--surface-raised)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                BTC/USDT is trending strongly bullish on the 4-hour timeframe. Price has broken above the 21 EMA with confirmed volume, and market structure shows a clear sequence of higher highs and higher lows. The most recent candle close established a new Break of Structure. With 7.8/10 confidence, the bias favors continuation to the upside…
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── DOWNLOADS ─────────────────────────────────────────────────────────────────

function DownloadsSection() {
  const platforms = [
    {
      name: 'Windows',
      formats: ['.msi installer', '.exe setup'],
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" />
          <rect x="15" y="3" width="10" height="10" rx="1" fill="currentColor" />
          <rect x="3" y="15" width="10" height="10" rx="1" fill="currentColor" />
          <rect x="15" y="15" width="10" height="10" rx="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      name: 'macOS',
      formats: ['.dmg universal', 'Apple Silicon + Intel'],
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M20 8c-1.2-1.5-3-2-5-2-1 0-2.5.8-3.5.8S9.5 6 8 6C5.5 6 3 8.5 3 12c0 4.5 3.5 10 6 10 1 0 2.5-1 3.5-1 1 0 2.5 1 3.5 1 2.5 0 6-5 6.5-9.5-.5-.5-2-1.5-2.5-3.5Z" fill="currentColor"/>
          <path d="M16 4c.5-1.5 2.5-3 4-3-.5 2-1.5 3.5-4 3Z" fill="currentColor"/>
        </svg>
      ),
    },
    {
      name: 'Linux',
      formats: ['.deb (Debian/Ubuntu)', '.rpm (Fedora/RHEL)', '.AppImage (universal)'],
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <ellipse cx="14" cy="10" rx="5" ry="7" fill="currentColor" />
          <path d="M7 18c0 0-3 2-3 5h20c0-3-3-5-3-5-1-1-2-3-3-4H11c-1 1-2 3-4 4Z" fill="currentColor" opacity="0.8"/>
          <circle cx="11" cy="9" r="1" fill="var(--ink)" />
          <circle cx="17" cy="9" r="1" fill="var(--ink)" />
        </svg>
      ),
    },
  ]

  return (
    <section id="downloads" aria-labelledby="downloads-heading">
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          id="downloads-heading"
          eyebrow="Downloads"
          title="Available for Windows, macOS, and Linux."
          subtitle="Free. No account. Runs offline after first candle fetch."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 40 }}>
          {platforms.map(({ name, formats, icon }) => (
            <div
              key={name}
              style={{
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '28px 24px',
                display: 'flex', flexDirection: 'column', gap: 16,
                transition: 'border-color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ color: 'var(--text-dim)' }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {formats.map(f => (
                    <div key={f} style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <a
                href={RELEASES}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Download Sentinel for ${name}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface-high)', border: '1px solid var(--border-strong)',
                  color: 'var(--text)', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'white' }}
                onMouseOut={e => { e.currentTarget.style.background = 'var(--surface-high)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Download for {name}
              </a>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="var(--text-dim)" aria-hidden="true">
            <path d="M8 0.5C3.86 0.5 0.5 3.86 0.5 8c0 3.32 2.15 6.14 5.14 7.14.38.07.52-.16.52-.36v-1.27c-2.1.46-2.54-.88-2.54-.88-.34-.87-.83-1.1-.83-1.1-.68-.46.05-.45.05-.45.75.05 1.15.77 1.15.77.67 1.15 1.76.82 2.19.63.07-.49.26-.82.47-1.01-1.67-.19-3.43-.84-3.43-3.73 0-.82.29-1.5.77-2.03-.08-.19-.33-.96.07-2 0 0 .63-.2 2.06.77.6-.17 1.24-.25 1.88-.25.64 0 1.28.08 1.88.25 1.43-.97 2.06-.77 2.06-.77.4 1.04.15 1.81.07 2 .48.53.77 1.21.77 2.03 0 2.9-1.77 3.54-3.45 3.73.27.23.51.69.51 1.39v2.06c0 .2.14.44.52.36C13.35 14.14 15.5 11.32 15.5 8c0-4.14-3.36-7.5-7.5-7.5z"/>
          </svg>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, marginRight: 8 }}>Prefer to build from source?</span>
            <a href={GITHUB} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}>
              Clone the repository →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── WHY SENTINEL ──────────────────────────────────────────────────────────────

function WhySentinelSection() {
  const pillars = [
    {
      title: 'Deterministic by design',
      body: 'Every indicator uses its published formula. Every evidence item has a documented rule. Given the same candle data, you always get the same result — to the decimal. No randomness, no heuristics, no hidden weights.',
      symbol: '≡',
    },
    {
      title: 'The AI only writes',
      body: 'Gemini receives a fully computed PipelineResult and converts it to prose. It does not calculate, does not decide, and cannot invent a number. Every value in the report has a deterministic source in the pipeline.',
      symbol: '✦',
    },
    {
      title: 'Your data stays local',
      body: "There are no Sentinel servers. Analysis results, history, API keys, and settings are stored in your machine's AppData. The only outbound calls are to Binance (for candles) and Google (if you enable Gemini).",
      symbol: '◎',
    },
    {
      title: 'Auditable pipeline',
      body: 'Every stage of the analysis is open source. You can read the code that produced each indicator, each evidence item, each confidence score. Nothing is behind an API or proprietary black box.',
      symbol: '⬡',
    },
  ]

  return (
    <section
      id="why"
      aria-labelledby="why-heading"
      style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          id="why-heading"
          eyebrow="Philosophy"
          eyebrowColor="var(--signal)"
          title="Trust the numbers. Know their source."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          {pillars.map(({ title, body, symbol }) => (
            <article key={title} style={{
              padding: '28px 28px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--ink)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: 'var(--text-dim)',
                marginBottom: 16,
              }}>
                {symbol}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>{title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>{body}</p>
            </article>
          ))}
        </div>

        {/* Data flow diagram */}
        <div style={{ marginTop: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 20 }}>
            Where each value comes from
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 680 }}>
            {[
              { source: 'Binance REST API', arrow: '→', output: 'Raw OHLCV candles', color: 'var(--text-dim)' },
              { source: 'Published formulas', arrow: '→', output: 'Technical indicators', color: '#2f7bff' },
              { source: 'Documented rules', arrow: '→', output: 'Market structure + evidence', color: '#a78bfa' },
              { source: 'Evidence + weights', arrow: '→', output: 'Confidence score 0–10', color: '#22c55e' },
              { source: 'Confidence + validation', arrow: '→', output: 'Trade plan', color: '#22c55e' },
              { source: 'Complete PipelineResult', arrow: '→', output: 'AI-written report (optional)', color: 'var(--text-dim)' },
            ].map(({ source, arrow, output, color }) => (
              <div key={source} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 4,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-dim)', flex: '0 0 210px' }}>{source}</span>
                <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>{arrow}</span>
                <span style={{ fontSize: 13, color, fontWeight: 500 }}>{output}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── DOCUMENTATION ─────────────────────────────────────────────────────────────

function DocumentationSection() {
  return (
    <section id="docs" aria-labelledby="docs-heading">
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          id="docs-heading"
          eyebrow="Documentation"
          title="Read the source. Understand the engine."
          subtitle="Everything about how Sentinel works is documented alongside the code."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 32 }}>
          {DOCS_LINKS.map(({ title, desc, path }) => (
            <a
              key={title}
              href={`${BLOB}/${path}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${title} documentation`}
              style={{
                display: 'block', padding: '20px 22px',
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: 8, transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-high)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 7, letterSpacing: '-0.01em' }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>{desc}</div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Read →</div>
            </a>
          ))}

          {/* GitHub card */}
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Sentinel on GitHub"
            style={{
              display: 'block', padding: '20px 22px',
              background: 'var(--surface-raised)', border: '1px solid var(--border)',
              borderRadius: 8, transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-high)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 7, letterSpacing: '-0.01em' }}>GitHub</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>Source code, issues, pull requests, releases</div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Open on GitHub →</div>
          </a>
        </div>
      </div>
    </section>
  )
}

// ── ROADMAP ───────────────────────────────────────────────────────────────────

const ROADMAP_STATUS_STYLE: Record<string, React.CSSProperties> = {
  current: { color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' },
  active: { color: '#2f7bff', background: 'rgba(47,123,255,0.1)', border: '1px solid rgba(47,123,255,0.2)' },
  planned: { color: '#f0a830', background: 'rgba(240,168,48,0.08)', border: '1px solid rgba(240,168,48,0.2)' },
  future: { color: 'var(--text-dim)', background: 'var(--surface-high)', border: '1px solid var(--border)' },
}

const ROADMAP_STATUS_LABEL: Record<string, string> = {
  current: 'Current',
  active: 'In Progress',
  planned: 'Planned',
  future: 'Future',
}

function RoadmapSection() {
  return (
    <section
      id="roadmap"
      aria-labelledby="roadmap-heading"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          id="roadmap-heading"
          eyebrow="Roadmap"
          title="Where Sentinel is going."
          subtitle="From a desktop app to a full analysis platform — built in public, shipped incrementally."
        />

        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div
            style={{ display: 'flex', gap: 0, minWidth: 'max-content', position: 'relative' }}
            role="list"
            aria-label="Roadmap phases"
          >
            {/* Connector line */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', top: 30, left: 24, right: 24,
                height: 1, background: 'var(--border)',
                zIndex: 0,
              }}
            />

            {ROADMAP.map((phase, i) => {
              const st = ROADMAP_STATUS_STYLE[phase.status]
              return (
                <div
                  key={phase.phase}
                  role="listitem"
                  style={{
                    width: 220, paddingRight: i < ROADMAP.length - 1 ? 24 : 0,
                    position: 'relative', zIndex: 1,
                  }}
                >
                  {/* Phase dot */}
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: phase.status === 'current' ? '#22c55e' : phase.status === 'active' ? '#2f7bff' : 'var(--border-strong)',
                    border: '2px solid var(--ink)',
                    marginBottom: 20,
                    boxShadow: phase.status === 'current' ? '0 0 12px rgba(34,197,94,0.5)' : 'none',
                  }} aria-hidden="true" />

                  <div style={{
                    background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{phase.phase}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '2px 7px', borderRadius: 3,
                        ...st,
                      }}>
                        {ROADMAP_STATUS_LABEL[phase.status]}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, letterSpacing: '-0.01em' }}>{phase.title}</div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {phase.items.map(item => (
                        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: 'var(--text-dim)' }}>
                          <div
                            style={{
                              width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                              background: phase.status === 'current' ? '#22c55e' : phase.status === 'active' ? '#2f7bff' : 'var(--text-faint)',
                              marginTop: 5,
                            }}
                            aria-hidden="true"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const toggle = useCallback((i: number) => {
    setOpen(prev => prev === i ? null : i)
  }, [])

  const onKey = useCallback((e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[Math.min(i + 1, FAQ.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      itemRefs.current[Math.max(i - 1, 0)]?.focus()
    }
  }, [])

  return (
    <section id="faq" aria-labelledby="faq-heading">
      <div style={{ ...s.container, ...s.sectionPad }}>
        <SectionHeader
          id="faq-heading"
          eyebrow="FAQ"
          title="Common questions."
        />

        <div
          style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
          role="list"
          aria-label="Frequently asked questions"
        >
          {FAQ.map(({ q, a }, i) => {
            const isOpen = open === i
            return (
              <div key={i} role="listitem" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <button
                  ref={el => { itemRefs.current[i] = el }}
                  onClick={() => toggle(i)}
                  onKeyDown={e => onKey(e, i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '18px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    background: isOpen ? 'var(--surface-raised)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{q}</span>
                  <div style={{
                    flexShrink: 0, color: 'var(--text-dim)',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  style={{
                    maxHeight: isOpen ? '300px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease',
                  }}
                >
                  <div style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.75 }}>
                    {a}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── OPEN SOURCE ───────────────────────────────────────────────────────────────

function OpenSourceSection() {
  return (
    <section
      id="oss"
      aria-labelledby="oss-heading"
      style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div style={{ ...s.container, ...s.sectionPad }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <SectionLabel color="var(--signal)">Open Source</SectionLabel>
            <h2
              id="oss-heading"
              style={{ fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, textWrap: 'balance' }}
            >
              Built in public.
              <br />MIT licensed.
            </h2>
            <p style={{ marginTop: 20, fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.75 }}>
              The complete analysis pipeline — every formula, every rule, every weight — is open source.
              Audit it, fork it, extend it. Contributions are welcome.
            </p>
            <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a
                href={GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 22px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: 'var(--accent)', color: 'white',
                  boxShadow: '0 0 20px var(--accent-glow)',
                  transition: 'opacity 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0.5C3.86 0.5 0.5 3.86 0.5 8c0 3.32 2.15 6.14 5.14 7.14.38.07.52-.16.52-.36v-1.27c-2.1.46-2.54-.88-2.54-.88-.34-.87-.83-1.1-.83-1.1-.68-.46.05-.45.05-.45.75.05 1.15.77 1.15.77.67 1.15 1.76.82 2.19.63.07-.49.26-.82.47-1.01-1.67-.19-3.43-.84-3.43-3.73 0-.82.29-1.5.77-2.03-.08-.19-.33-.96.07-2 0 0 .63-.2 2.06.77.6-.17 1.24-.25 1.88-.25.64 0 1.28.08 1.88.25 1.43-.97 2.06-.77 2.06-.77.4 1.04.15 1.81.07 2 .48.53.77 1.21.77 2.03 0 2.9-1.77 3.54-3.45 3.73.27.23.51.69.51 1.39v2.06c0 .2.14.44.52.36C13.35 14.14 15.5 11.32 15.5 8c0-4.14-3.36-7.5-7.5-7.5z"/>
                </svg>
                View on GitHub
              </a>
              <a
                href={`${GITHUB}/blob/main/CONTRIBUTING.md`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  background: 'transparent', color: 'var(--text)',
                  border: '1px solid var(--border-strong)',
                  transition: 'border-color 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              >
                Contributing Guide
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'License', value: 'MIT — no restrictions', accent: '#22c55e' },
              { label: 'Pipeline', value: 'Fully open source', accent: '#22c55e' },
              { label: 'Backend', value: 'None — runs locally', accent: '#22c55e' },
              { label: 'Telemetry', value: 'Zero — none collected', accent: '#22c55e' },
              { label: 'Price', value: 'Free — always will be', accent: '#22c55e' },
              { label: 'Contributions', value: 'Welcome — see CONTRIBUTING.md', accent: 'var(--accent)' },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--ink)',
                border: '1px solid var(--border)', borderRadius: 4,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: accent }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FOOTER ────────────────────────────────────────────────────────────────────

function Footer() {
  const cols = [
    {
      heading: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Pipeline', href: '#pipeline' },
        { label: 'Downloads', href: '#downloads' },
        { label: 'Roadmap', href: '#roadmap' },
        { label: 'FAQ', href: '#faq' },
      ],
    },
    {
      heading: 'Docs',
      links: [
        { label: 'Architecture', href: `${BLOB}/desktop/docs/ARCHITECTURE.md` },
        { label: 'Changelog', href: `${BLOB}/desktop/docs/CHANGELOG.md` },
        { label: 'Versioning', href: `${BLOB}/desktop/docs/VERSIONING.md` },
        { label: 'Roadmap', href: `${BLOB}/desktop/docs/ROADMAP.md` },
        { label: 'Contributing', href: `${BLOB}/CONTRIBUTING.md` },
      ],
    },
    {
      heading: 'GitHub',
      links: [
        { label: 'Repository', href: GITHUB },
        { label: 'Releases', href: RELEASES },
        { label: 'Issues', href: `${GITHUB}/issues` },
        { label: 'Pull Requests', href: `${GITHUB}/pulls` },
        { label: 'License (MIT)', href: `${BLOB}/LICENSE` },
      ],
    },
  ]

  return (
    <footer role="contentinfo" style={{ background: 'var(--ink)', borderTop: '1px solid var(--border)' }}>
      <div style={{ ...s.container, padding: '60px 24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(3, 1fr)', gap: 40, marginBottom: 48 }}>
          {/* Brand */}
          <div>
            <NavLogo />
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, maxWidth: 280 }}>
              Local-first crypto analysis desktop app. Open source, MIT licensed.
              Runs entirely on your machine — no subscription, no cloud, no data leaving your device.
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <div style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)',
              }}>
                MIT License
              </div>
              <div style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: 'rgba(47,123,255,0.1)', color: '#2f7bff', border: '1px solid rgba(47,123,255,0.2)',
              }}>
                Open Source
              </div>
            </div>
          </div>

          {/* Link columns */}
          {cols.map(({ heading, links }) => (
            <div key={heading}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 14 }}>
                {heading}
              </div>
              <nav aria-label={`${heading} links`}>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      <a
                        href={href}
                        target={href.startsWith('http') ? '_blank' : undefined}
                        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        style={{ fontSize: 13, color: 'var(--text-dim)', transition: 'color 0.15s' }}
                        onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
                        onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            © {new Date().getFullYear()} Sentinel. MIT License.
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            No cookies. No tracking. No servers.
          </span>
        </div>
      </div>
    </footer>
  )
}

// ── APP ───────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <>
      <a
        href="#hero-heading"
        style={{
          position: 'absolute', top: -100, left: 0, zIndex: 9999,
          padding: '8px 16px', background: 'var(--accent)', color: 'white',
          fontWeight: 600, fontSize: 14, borderRadius: 4,
          transition: 'top 0.1s',
        }}
        onFocus={e => (e.currentTarget.style.top = '8px')}
        onBlur={e => (e.currentTarget.style.top = '-100px')}
      >
        Skip to main content
      </a>

      <Nav />

      <main id="main-content">
        <Hero />
        <FeatureGrid />
        <PipelineSection />
        <ShowcaseSection />
        <DownloadsSection />
        <WhySentinelSection />
        <DocumentationSection />
        <RoadmapSection />
        <FAQSection />
        <OpenSourceSection />
      </main>

      <Footer />
    </>
  )
}
