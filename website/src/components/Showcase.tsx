import { useState } from 'react'
import { SectionHeader } from '../shared'

const TABS = ['Summary', 'Trade Plan', 'Evidence', 'Indicators', 'Structure', 'Volume', 'Validation', 'Writer', 'Overview'] as const
type Tab = typeof TABS[number]

const RECENT = [
  { symbol: 'BTC/USDT', tf: '4h', score: 7.8, trend: 'Bullish' },
  { symbol: 'ETH/USDT', tf: '1d', score: 5.2, trend: 'Neutral' },
  { symbol: 'SOL/USDT', tf: '1h', score: 6.4, trend: 'Bullish' },
  { symbol: 'BTC/USDT', tf: '1d', score: 8.1, trend: 'Strong Bull' },
  { symbol: 'LINK/USDT', tf: '4h', score: 3.1, trend: 'Bearish' },
] as const

const SUMMARY_CARDS = [
  { label: 'Trend', value: 'Strong Bullish', color: '#22c55e' },
  { label: 'Confidence', value: '7.8 / 10 (A)', color: '#22c55e' },
  { label: 'Market Structure', value: 'Uptrend — BOS', color: '#22c55e' },
  { label: 'Volume Pressure', value: '68% Buy', color: '#22c55e' },
  { label: 'Entry Zone', value: '$96,800–$97,200', color: 'var(--text)' },
  { label: 'Risk / Reward', value: '2.4 : 1', color: 'var(--text)' },
] as const

function scoreColor(score: number) {
  return score >= 7 ? '#22c55e' : score >= 4 ? '#2f7bff' : '#ef4444'
}

export function Showcase() {
  const [activeTab, setActiveTab] = useState<Tab>('Summary')
  const activeIdx = TABS.indexOf(activeTab)

  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="container section-pad">
        <SectionHeader
          id="showcase-heading"
          eyebrow="Desktop App"
          title="A full analysis suite. No browser tab required."
          subtitle="Nine views. Every angle of the analysis in one place, stored locally, available offline."
        />

        {/* Tab picker */}
        <div role="tablist" aria-label="Analysis view tabs" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 32 }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`showcase-panel`}
              id={`showcase-tab-${i}`}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: activeTab === tab ? 'var(--accent)' : 'var(--surface-raised)',
                color: activeTab === tab ? 'white' : 'var(--text-dim)',
                border: activeTab === tab ? '1px solid transparent' : '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
                minHeight: 36,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Mock desktop frame */}
        <div
          style={{
            background: 'var(--ink)', border: '1px solid var(--border-strong)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 32px 100px rgba(0,0,0,0.5)',
          }}
          role="tabpanel"
          id="showcase-panel"
          aria-labelledby={`showcase-tab-${activeIdx}`}
          aria-label={`${activeTab} view`}
        >
          {/* Window chrome */}
          <div style={{ background: '#0a0d14', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 5 }} aria-hidden="true">
              {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div aria-hidden="true" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
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
          <div className="showcase-body">
            {/* Sidebar */}
            <div className="showcase-sidebar" aria-hidden="true">
              <div style={{ padding: '0 12px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>
                Recent Analyses
              </div>
              {RECENT.map((item, i) => (
                <div
                  key={`${item.symbol}-${i}`}
                  style={{
                    padding: '9px 12px',
                    background: i === 0 ? 'var(--surface-high)' : 'transparent',
                    borderLeft: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{item.symbol}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: scoreColor(item.score) }}>
                      {item.score}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{item.tf} · {item.trend}</div>
                </div>
              ))}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px', minWidth: 0 }}>
              {/* Tab indicator row */}
              <div aria-hidden="true" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12, overflowX: 'auto' }}>
                {TABS.map((tab) => (
                  <div key={tab} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 3, flexShrink: 0,
                    background: activeTab === tab ? 'var(--accent)' : 'transparent',
                    color: activeTab === tab ? 'white' : 'var(--text-faint)',
                    fontWeight: activeTab === tab ? 600 : 400,
                  }}>
                    {tab}
                  </div>
                ))}
              </div>

              {/* Summary content */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {SUMMARY_CARDS.map(({ label, value, color }) => (
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
