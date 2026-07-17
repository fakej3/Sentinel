import { GITHUB, BLOB } from '../constants'
import { SectionLabel, GitHubIcon } from '../shared'

const FACTS = [
  { label: 'License', value: 'MIT — no restrictions', accent: '#22c55e' },
  { label: 'Pipeline', value: 'Fully open source', accent: '#22c55e' },
  { label: 'Backend', value: 'None — runs locally', accent: '#22c55e' },
  { label: 'Telemetry', value: 'Zero — none collected', accent: '#22c55e' },
  { label: 'Price', value: 'Free — always will be', accent: '#22c55e' },
  { label: 'Contributions', value: 'Welcome — see CONTRIBUTING.md', accent: 'var(--accent)' },
] as const

export function OpenSource() {
  return (
    <section
      id="oss"
      aria-labelledby="oss-heading"
      style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="container section-pad">
        <div className="two-col-grid" style={{ gap: 64, alignItems: 'center' }}>
          <div>
            <SectionLabel color="var(--signal)">Open Source</SectionLabel>
            <h2
              id="oss-heading"
              style={{ fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, textWrap: 'balance' as never }}
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
                aria-label="View Sentinel on GitHub (opens in new tab)"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 22px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  background: 'var(--accent)', color: 'white',
                  boxShadow: '0 0 20px var(--accent-glow)',
                  transition: 'opacity 0.15s',
                  minHeight: 44,
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseOut={e => (e.currentTarget.style.opacity = '1')}
              >
                <GitHubIcon size={16} />
                View on GitHub
              </a>
              <a
                href={`${BLOB}/CONTRIBUTING.md`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Read contributing guide (opens in new tab)"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  background: 'transparent', color: 'var(--text)',
                  border: '1px solid var(--border-strong)',
                  transition: 'border-color 0.15s',
                  minHeight: 44,
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              >
                Contributing Guide
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FACTS.map(({ label, value, accent }) => (
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
