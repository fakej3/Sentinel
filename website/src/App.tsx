import { useState } from 'react'

const GITHUB_URL = 'https://github.com/fakej3/Sentinel'

const PIPELINE_STAGES = [
  { id: 1, name: 'Candle Fetch', desc: 'OHLCV data from Binance REST API' },
  { id: 2, name: 'Indicators', desc: 'EMA, RSI, MACD, ATR, ADX, Bollinger, StochRSI, OBV, MFI, CCI' },
  { id: 3, name: 'Market Structure', desc: 'HH/HL/LH/LL detection, BOS, CHoCH, breakout, pullback' },
  { id: 4, name: 'Support & Resistance', desc: 'Zone detection, strength scoring, confluence mapping' },
  { id: 5, name: 'Volume Analysis', desc: 'Buy/sell pressure, climax detection, VWAP, A/D, OBV' },
  { id: 6, name: 'Trend Synthesis', desc: 'Full-trend label from 9 bull/bear/neutral conditions' },
  { id: 7, name: 'Evidence', desc: 'Structured evidence items with direction, impact, source' },
  { id: 8, name: 'Validation', desc: 'Cross-module consistency checks, data quality gates' },
  { id: 9, name: 'Confidence', desc: 'Evidence-weighted score 0–10, grade, trust rating' },
  { id: 10, name: 'Trade Plan', desc: 'Entry zone, stop, targets, risk/reward, maturity score' },
  { id: 11, name: 'Writer', desc: 'Deterministic narrative + optional Gemini AI enhancement' },
]

const FEATURES = [
  {
    tag: 'Architecture',
    title: 'No backend required',
    body: 'The entire 11-stage pipeline runs in-process inside the Tauri webview. No server to run, no subscription, no data leaving your machine.',
  },
  {
    tag: 'Analysis Engine',
    title: '10+ technical indicators',
    body: 'EMA, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI — all computed from first principles against Binance candle data.',
  },
  {
    tag: 'Market Structure',
    title: 'Structural pattern detection',
    body: 'Higher highs, higher lows, lower highs, lower lows, Break of Structure, Change of Character, pullbacks, and consolidation ranges.',
  },
  {
    tag: 'Confidence Engine',
    title: 'Evidence-weighted scoring',
    body: 'Each piece of analysis produces a directional evidence item. The confidence engine aggregates them, detects contradictions, and produces a score from 0–10.',
  },
  {
    tag: 'AI Layer',
    title: 'Optional AI narration',
    body: 'After the deterministic pipeline finishes, Gemini can enhance the written report. The AI only writes — it never calculates or decides.',
  },
  {
    tag: 'History',
    title: 'Local analysis history',
    body: 'Every analysis you save is stored locally in AppData. Review past setups, compare confidence across timeframes, track your analysis over time.',
  },
]

const TABS = ['Summary', 'Trade Plan', 'Evidence', 'Indicators', 'Structure', 'Volume', 'Validation', 'Writer', 'Overview']

function ConfidenceRing({ score }: { score: number }) {
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const arcFraction = Math.min(1, Math.max(0, score / 10))
  const dashLength = arcFraction * circumference * 0.75
  const gap = circumference - dashLength
  const center = size / 2
  const color = score >= 7 ? '#22c55e' : score >= 4 ? '#2f7bff' : '#ef4444'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-135deg)' }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#1e2a45" strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * 0.75} ${circumference}`} strokeLinecap="round" />
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dashLength} ${gap + circumference * 0.25}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <span className="mono" style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{score.toFixed(1)}</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>/10</span>
      </div>
    </div>
  )
}

function Chip({ children, color = 'default' }: { children: React.ReactNode; color?: 'green' | 'blue' | 'amber' | 'default' }) {
  const colors: Record<string, React.CSSProperties> = {
    green: { background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' },
    blue: { background: 'rgba(47,123,255,0.1)', color: '#2f7bff', borderColor: 'rgba(47,123,255,0.2)' },
    amber: { background: 'rgba(240,168,48,0.1)', color: '#f0a830', borderColor: 'rgba(240,168,48,0.2)' },
    default: { background: 'var(--surface-high)', color: 'var(--text-dim)', borderColor: 'var(--border)' },
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.03em', border: '1px solid', lineHeight: 1.6,
      ...colors[color],
    }}>{children}</span>
  )
}

function MockAnalysisCard() {
  return (
    <div style={{
      background: 'var(--surface-raised)', border: '1px solid var(--border-strong)',
      borderRadius: 8, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16,
      boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>BTC/USDT</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>4h</span>
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>
            $97,420<span style={{ fontSize: 13, color: '#22c55e', marginLeft: 6, fontWeight: 600 }}>+2.4%</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Trend</div>
          <Chip color="green">Strong Bullish</Chip>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
        <ConfidenceRing score={7.8} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Key Evidence</div>
          {[
            { label: 'Price above all 4 EMAs', dir: 'bull' },
            { label: 'BOS confirmed — higher high', dir: 'bull' },
            { label: 'Volume 1.8× average confirms move', dir: 'bull' },
            { label: 'RSI 62 — moderate bullish', dir: 'bull' },
          ].map((ev) => (
            <div key={ev.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-dim)' }}>{ev.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Trade Plan</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Entry', value: '$96,800–$97,200' },
            { label: 'Stop', value: '$94,500' },
            { label: 'R:R', value: '2.4:1' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--surface-high)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <span key={t} style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 3, background: 'var(--surface-high)',
            color: 'var(--text-faint)', border: '1px solid var(--border)',
          }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

export function App() {
  const [pipelineExpanded, setPipelineExpanded] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,13,20,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L13 8L8 14L3 8L8 2Z" fill="white" fillOpacity="0.9" />
                <path d="M8 5L11 8L8 11L5 8L8 5Z" fill="white" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Sentinel</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="#pipeline" style={{ fontSize: 13, color: 'var(--text-dim)', transition: 'color 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}>Pipeline</a>
            <a href="#features" style={{ fontSize: 13, color: 'var(--text-dim)', transition: 'color 0.15s' }}
              onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}>Features</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 13, padding: '6px 14px', borderRadius: 6,
                background: 'var(--surface-raised)', border: '1px solid var(--border-strong)',
                color: 'var(--text)', fontWeight: 500, transition: 'border-color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}>
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 100px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center',
        }}>
          <div>
            <div style={{ marginBottom: 20 }}>
              <Chip color="amber">Free & Open Source — RC1</Chip>
            </div>
            <h1 style={{
              fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: 800, lineHeight: 1.07,
              letterSpacing: '-0.03em', textWrap: 'balance',
              background: 'linear-gradient(135deg, var(--text) 60%, var(--text-dim))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Professional crypto analysis. Runs on your machine.
            </h1>
            <p style={{ marginTop: 24, fontSize: 17, color: 'var(--text-dim)', lineHeight: 1.7, maxWidth: 480 }}>
              Sentinel runs a deterministic 11-stage analysis engine locally — no subscription,
              no cloud dependency, no data leaving your device. Optional AI narration via Gemini
              when you want it.
            </p>
            <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                  background: 'var(--accent)', color: 'white',
                  boxShadow: '0 0 20px var(--accent-glow), 0 1px 3px rgba(0,0,0,0.4)',
                  transition: 'opacity 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0.5C3.86 0.5 0.5 3.86 0.5 8c0 3.32 2.15 6.14 5.14 7.14.38.07.52-.16.52-.36v-1.27c-2.1.46-2.54-.88-2.54-.88-.34-.87-.83-1.1-.83-1.1-.68-.46.05-.45.05-.45.75.05 1.15.77 1.15.77.67 1.15 1.76.82 2.19.63.07-.49.26-.82.47-1.01-1.67-.19-3.43-.84-3.43-3.73 0-.82.29-1.5.77-2.03-.08-.19-.33-.96.07-2 0 0 .63-.2 2.06.77.6-.17 1.24-.25 1.88-.25.64 0 1.28.08 1.88.25 1.43-.97 2.06-.77 2.06-.77.4 1.04.15 1.81.07 2 .48.53.77 1.21.77 2.03 0 2.9-1.77 3.54-3.45 3.73.27.23.51.69.51 1.39v2.06c0 .2.14.44.52.36C13.35 14.14 15.5 11.32 15.5 8c0-4.14-3.36-7.5-7.5-7.5z"/>
                </svg>
                Download for Linux
              </a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                  background: 'transparent', color: 'var(--text)',
                  border: '1px solid var(--border-strong)',
                  transition: 'border-color 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}>
                View Source
              </a>
            </div>
            <div style={{ marginTop: 28, display: 'flex', gap: 24 }}>
              {[
                { value: '11', label: 'Pipeline stages' },
                { value: '10+', label: 'Indicators' },
                { value: '1521', label: 'Tests passing' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em' }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <MockAnalysisCard />
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', maxWidth: 1200, margin: '0 auto' }} />

      {/* Pipeline */}
      <section id="pipeline" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 12 }}>
            Analysis Engine
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em', textWrap: 'balance' }}>
            11 stages. Every number has a source.
          </h2>
          <p style={{ marginTop: 12, fontSize: 15, color: 'var(--text-dim)', maxWidth: 560 }}>
            The pipeline is deterministic. Each stage produces typed, documented output.
            The AI writer receives the finished result — it never drives the analysis.
          </p>
        </div>

        {/* Pipeline flow */}
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 0, minWidth: 'max-content', alignItems: 'stretch' }}>
            {PIPELINE_STAGES.slice(0, pipelineExpanded ? 11 : 6).map((stage, i, arr) => (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'stretch' }}>
                <div style={{
                  background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  padding: '14px 16px', width: 160,
                  borderLeft: i === 0 ? '1px solid var(--border)' : 'none',
                  position: 'relative',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Stage {stage.id}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>{stage.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{stage.desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--text-faint)', padding: '0 2px' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6 3l5 5-5 5V3z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {!pipelineExpanded && (
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--text-faint)', padding: '0 2px' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 3l5 5-5 5V3z" />
                  </svg>
                </div>
                <button
                  onClick={() => setPipelineExpanded(true)}
                  style={{
                    background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderLeft: 'none', padding: '14px 20px', width: 120,
                    color: 'var(--accent)', fontSize: 12, fontWeight: 600, lineHeight: 1.4,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                  <span>+5 more</span>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>Show all</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', maxWidth: 1200, margin: '0 auto' }} />

      {/* Features */}
      <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 12 }}>
            Features
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em', textWrap: 'balance' }}>
            Everything you need. Nothing you don't.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1, background: 'var(--border)', border: '1px solid var(--border)' }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: 'var(--ink)', padding: '28px 28px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 10 }}>
                {f.tag}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.3, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.65 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platforms */}
      <div style={{ borderTop: '1px solid var(--border)', maxWidth: 1200, margin: '0 auto' }} />
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 12 }}>
            Platforms
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Desktop. More coming.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { os: 'Linux', status: 'available', format: '.deb, .rpm, .AppImage' },
            { os: 'macOS', status: 'available', format: '.dmg (requires code signing)' },
            { os: 'Windows', status: 'available', format: '.msi, .exe installer' },
            { os: 'Mobile', status: 'planned', format: 'iOS + Android — roadmap' },
          ].map(({ os, status, format }) => (
            <div key={os} style={{
              background: 'var(--surface-raised)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '20px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{os}</span>
                <Chip color={status === 'available' ? 'green' : 'default'}>
                  {status === 'available' ? 'Available' : 'Planned'}
                </Chip>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{format}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Philosophy */}
      <div style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--signal)', marginBottom: 16 }}>
              Design Philosophy
            </div>
            <blockquote style={{
              fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 700, lineHeight: 1.35,
              letterSpacing: '-0.02em', color: 'var(--text)', textWrap: 'balance',
            }}>
              "The AI only writes. It never calculates, decides, or invents."
            </blockquote>
            <p style={{ marginTop: 20, fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              Every number in a Sentinel analysis has a deterministic source.
              Indicators come from published formulas. Evidence comes from
              documented rules. Confidence comes from those evidence items,
              weighted by documented factors. The AI receives the finished
              result and formats it into prose — nothing more.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { source: 'Binance REST API', output: 'Raw OHLCV candles' },
              { source: 'Published formulas', output: 'Technical indicators' },
              { source: 'Rule-defined conditions', output: 'Evidence items' },
              { source: 'Evidence + weights', output: 'Confidence score 0–10' },
              { source: 'Confidence + validation', output: 'Trade plan' },
              { source: 'Complete PipelineResult', output: 'AI-written report (optional)' },
            ].map(({ source, output }) => (
              <div key={source} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 4,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1 }}>{source}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2l4 4-4 4" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, textAlign: 'right' }}>{output}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', textWrap: 'balance', maxWidth: 640, margin: '0 auto' }}>
          Start analyzing. No account needed.
        </h2>
        <p style={{ marginTop: 16, fontSize: 16, color: 'var(--text-dim)', maxWidth: 440, margin: '16px auto 0' }}>
          Open source, MIT licensed. Download a release or clone the repo and run it yourself.
        </p>
        <div style={{ marginTop: 36, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 28px', borderRadius: 8, fontWeight: 700, fontSize: 15,
              background: 'var(--accent)', color: 'white',
              boxShadow: '0 0 30px var(--accent-glow)',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}>
            Download Latest Release
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 28px', borderRadius: 8, fontWeight: 700, fontSize: 15,
              background: 'transparent', color: 'var(--text)',
              border: '1px solid var(--border-strong)',
              transition: 'border-color 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}>
            View on GitHub
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Sentinel</span>
            <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>— Crypto Analysis Platform</span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <a href={`${GITHUB_URL}/blob/main/desktop/docs/CHANGELOG.md`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--text-dim)' }}>Changelog</a>
            <a href={`${GITHUB_URL}/blob/main/desktop/docs/ROADMAP.md`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--text-dim)' }}>Roadmap</a>
            <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--text-dim)' }}>MIT License</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--text-dim)' }}>GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
