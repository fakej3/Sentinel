import { GITHUB, RELEASES, LATEST_RELEASE } from '../constants'
import { SectionHeader, GitHubIcon, DownloadIcon } from '../shared'

const PLATFORMS = [
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
        <path d="M20 8c-1.2-1.5-3-2-5-2-1 0-2.5.8-3.5.8S9.5 6 8 6C5.5 6 3 8.5 3 12c0 4.5 3.5 10 6 10 1 0 2.5-1 3.5-1 1 0 2.5 1 3.5 1 2.5 0 6-5 6.5-9.5-.5-.5-2-1.5-2.5-3.5Z" fill="currentColor" />
        <path d="M16 4c.5-1.5 2.5-3 4-3-.5 2-1.5 3.5-4 3Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'Linux',
    formats: ['.deb (Debian / Ubuntu)', '.rpm (Fedora / RHEL)', '.AppImage (universal)'],
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <ellipse cx="14" cy="10" rx="5" ry="7" fill="currentColor" />
        <path d="M7 18c0 0-3 2-3 5h20c0-3-3-5-3-5-1-1-2-3-3-4H11c-1 1-2 3-4 4Z" fill="currentColor" opacity="0.8" />
        <circle cx="11" cy="9" r="1" fill="var(--ink)" />
        <circle cx="17" cy="9" r="1" fill="var(--ink)" />
      </svg>
    ),
  },
] as const

export function Downloads() {
  return (
    <section id="downloads" aria-labelledby="downloads-heading">
      <div className="container section-pad">
        <SectionHeader
          id="downloads-heading"
          eyebrow="Downloads"
          title="Available for Windows, macOS, and Linux."
          subtitle="Free. No account required. Runs offline after the first candle fetch."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 40 }}>
          {PLATFORMS.map(({ name, formats, icon }) => (
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
                <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{name}</h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {formats.map(f => (
                    <li key={f} style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={LATEST_RELEASE}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Download Sentinel for ${name} (opens GitHub Releases in new tab)`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface-high)', border: '1px solid var(--border-strong)',
                  color: 'var(--text)', transition: 'all 0.15s',
                  minHeight: 44,
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--accent)'
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'var(--surface-high)'
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
              >
                <DownloadIcon />
                Download for {name}
              </a>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '20px 24px', background: 'var(--surface-raised)',
          borderRadius: 8, border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          <GitHubIcon size={20} />
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, marginRight: 8 }}>Prefer to build from source?</span>
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}
            >
              Clone the repository →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
