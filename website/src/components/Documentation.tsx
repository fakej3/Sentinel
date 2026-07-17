import { DOCS_LINKS, BLOB, GITHUB } from '../constants'
import { SectionHeader } from '../shared'

export function Documentation() {
  return (
    <section id="docs" aria-labelledby="docs-heading">
      <div className="container section-pad">
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
              aria-label={`${title} documentation (opens in new tab)`}
              style={{
                display: 'block', padding: '20px 22px',
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: 8, transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.background = 'var(--surface-high)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--surface-raised)'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 7, letterSpacing: '-0.01em' }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>{desc}</div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Read →</div>
            </a>
          ))}

          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Sentinel on GitHub (opens in new tab)"
            style={{
              display: 'block', padding: '20px 22px',
              background: 'var(--surface-raised)', border: '1px solid var(--border)',
              borderRadius: 8, transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.background = 'var(--surface-high)'
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--surface-raised)'
            }}
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
