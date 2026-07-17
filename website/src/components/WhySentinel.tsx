import { SectionHeader } from '../shared'

const PILLARS = [
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
] as const

const FLOW_ROWS = [
  { source: 'Binance REST API',      output: 'Raw OHLCV candles',            color: 'var(--text-dim)' },
  { source: 'Published formulas',    output: 'Technical indicators',          color: '#2f7bff' },
  { source: 'Documented rules',      output: 'Market structure + evidence',   color: '#a78bfa' },
  { source: 'Evidence + weights',    output: 'Confidence score 0–10',         color: '#22c55e' },
  { source: 'Confidence + validation', output: 'Trade plan',                  color: '#22c55e' },
  { source: 'Complete PipelineResult', output: 'AI-written report (optional)', color: 'var(--text-dim)' },
] as const

export function WhySentinel() {
  return (
    <section
      id="why"
      aria-labelledby="why-heading"
      style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="container section-pad">
        <SectionHeader
          id="why-heading"
          eyebrow="Philosophy"
          eyebrowColor="var(--signal)"
          title="Trust the numbers. Know their source."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
          {PILLARS.map(({ title, body, symbol }) => (
            <article key={title} style={{
              padding: '28px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--ink)',
            }}>
              <div
                aria-hidden="true"
                style={{
                  width: 40, height: 40, borderRadius: 8, background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'var(--text-dim)',
                  marginBottom: 16,
                }}
              >
                {symbol}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>{title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>{body}</p>
            </article>
          ))}
        </div>

        {/* Data flow diagram */}
        <div style={{ marginTop: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 20 }}>
            Where each value comes from
          </p>
          <div className="flow-table" role="list" aria-label="Data flow: source to output">
            {FLOW_ROWS.map(({ source, output, color }) => (
              <div key={source} className="flow-row" role="listitem">
                <span className="flow-source">{source}</span>
                <span className="flow-arrow" aria-hidden="true">→</span>
                <span className="flow-output" style={{ color }}>{output}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
