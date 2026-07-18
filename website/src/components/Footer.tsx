import { GITHUB, RELEASES, BLOB } from '../constants'

function FooterLogo() {
  return (
    <a href="#top" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} aria-label="Sentinel — back to top">
      <div
        aria-hidden="true"
        style={{
          width: 30, height: 30, borderRadius: 7, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px var(--accent-glow)', flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2L13 8L8 14L3 8L8 2Z" fill="white" fillOpacity="0.85" />
          <path d="M8 5.5L11 8L8 10.5L5 8L8 5.5Z" fill="white" />
        </svg>
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Sentinel</span>
    </a>
  )
}

const COLS = [
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
      { label: 'Dev Roadmap', href: `${BLOB}/desktop/docs/ROADMAP.md` },
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
] as const

export function Footer() {
  return (
    <footer role="contentinfo" style={{ background: 'var(--ink)', borderTop: '1px solid var(--border)' }}>
      <div className="container" style={{ padding: '60px 24px 40px' }}>
        <div className="footer-grid" style={{ marginBottom: 48 }}>
          <div>
            <FooterLogo />
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, maxWidth: 280 }}>
              Local-first crypto analysis desktop app. Open source, MIT licensed.
              Runs entirely on your machine — no subscription, no cloud, no data leaving your device.
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

          {COLS.map(({ heading, links }) => (
            <div key={heading}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 14 }}>
                {heading}
              </p>
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

        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
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
