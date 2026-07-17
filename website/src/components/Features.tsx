import { FEATURES } from '../constants'
import { SectionHeader } from '../shared'

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="container section-pad">
        <SectionHeader
          id="features-heading"
          eyebrow="Features"
          title="Everything you need. Nothing you don't."
          subtitle="Twelve capabilities — every one of them computed locally, from first principles, with documented sources."
        />
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 1,
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            listStyle: 'none',
          }}
        >
          {FEATURES.map((f) => (
            <li key={f.title}>
              <article
                style={{ background: 'var(--surface)', padding: '28px', height: '100%', transition: 'background 0.15s' }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                onMouseOut={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 10 }}>
                  {f.tag}
                </p>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.65 }}>{f.body}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
