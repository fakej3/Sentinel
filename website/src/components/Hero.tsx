import { GITHUB, RELEASES } from '../constants'

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
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} role="img" aria-label={`Confidence score ${score.toFixed(1)} out of 10`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-135deg)' }} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={sw}
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={`${arc} ${gap + circ * 0.25}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${col}90)` }} />
      </svg>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 17, fontWeight: 800, color: col, lineHeight: 1 }}>{score.toFixed(1)}</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>/10</span>
      </div>
    </div>
  )
}

function HeroMockWindow() {
  const evidenceItems = [
    { label: 'Price above all 4 EMAs', dir: 'bull' },
    { label: 'BOS confirmed — higher high', dir: 'bull' },
    { label: 'Volume 1.8× average', dir: 'bull' },
    { label: 'RSI 62 — moderate bullish', dir: 'bull' },
    { label: 'StochRSI overbought — caution', dir: 'bear' },
  ] as const

  return (
    <figure
      aria-label="Sentinel desktop app showing a BTC/USDT 4h analysis with 7.8/10 confidence score, Strong Bullish trend, and a 2.4:1 risk/reward trade plan"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: 10, overflow: 'hidden', margin: 0,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* Window chrome */}
      <div style={{
        background: 'var(--ink)', borderBottom: '1px solid var(--border)',
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div aria-hidden="true" style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
          Sentinel — BTC/USDT · 4h
        </div>
      </div>

      {/* Tab bar */}
      <div aria-hidden="true" style={{
        background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)',
        display: 'flex', overflowX: 'auto', padding: '0 12px',
      }}>
        {['Summary', 'Trade Plan', 'Evidence', 'Indicators', 'Structure', 'Volume'].map((tab, i) => (
          <div key={tab} style={{
            padding: '8px 14px', fontSize: 12, fontWeight: i === 0 ? 600 : 400,
            color: i === 0 ? 'var(--text)' : 'var(--text-dim)',
            borderBottom: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
            whiteSpace: 'nowrap', flexShrink: 0,
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
              <span style={{ fontWeight: 700, fontSize: 15 }}>BTC/USDT</span>
              <span aria-hidden="true" style={{ color: 'var(--text-dim)', fontSize: 11 }}>4h · Binance</span>
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
              $97,420
              <span style={{ fontSize: 12, color: '#22c55e', marginLeft: 6, fontWeight: 600 }}>+2.4%</span>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)',
          }}>
            Strong Bullish
          </div>
        </div>

        {/* Confidence + evidence */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <ConfidenceRing score={7.8} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div aria-hidden="true" style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Evidence</div>
            {evidenceItems.map((ev) => (
              <div key={ev.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 5 }}>
                <div aria-hidden="true" style={{
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
          <div aria-hidden="true" style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Trade Plan</div>
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
                <div aria-hidden="true" style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                <div className="mono" style={{ fontSize: 11, fontWeight: 600, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" style={{ position: 'relative', overflow: 'hidden', paddingTop: 80, paddingBottom: 100 }}>
      {/* Dot grid */}
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

      <div className="container" style={{ position: 'relative' }}>
        <div className="hero-grid">
          {/* Left: copy */}
          <div>
            <div style={{
              display: 'inline-flex', padding: '4px 12px', borderRadius: 20,
              background: 'rgba(240,168,48,0.1)', color: 'var(--signal)',
              border: '1px solid rgba(240,168,48,0.2)',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.03em',
              marginBottom: 28,
            }}>
              Free &amp; Open Source — Early Access
            </div>

            <h1
              id="hero-heading"
              style={{
                fontSize: 'clamp(32px, 4.5vw, 60px)',
                fontWeight: 800, lineHeight: 1.06,
                letterSpacing: '-0.035em',
                textWrap: 'balance' as never,
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
                aria-label="Download Sentinel for free (opens GitHub Releases)"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                  background: 'var(--accent)', color: 'white',
                  boxShadow: '0 0 24px var(--accent-glow), 0 2px 6px rgba(0,0,0,0.3)',
                  transition: 'opacity 0.15s, transform 0.15s',
                  minHeight: 44,
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
                aria-label="View Sentinel source code on GitHub (opens in new tab)"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                  background: 'transparent', color: 'var(--text)',
                  border: '1px solid var(--border-strong)',
                  transition: 'border-color 0.15s',
                  minHeight: 44,
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              >
                View Source
              </a>
            </div>

            <dl style={{ marginTop: 36, display: 'flex', gap: 28 }}>
              {[
                { value: '11', label: 'pipeline stages' },
                { value: '10+', label: 'indicators' },
                { value: '0', label: 'servers required' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <dt className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em' }}>
                    {value}
                  </dt>
                  <dd style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: mock window */}
          <div>
            <HeroMockWindow />
          </div>
        </div>
      </div>
    </section>
  )
}
