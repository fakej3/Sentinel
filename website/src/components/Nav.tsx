import { useState, useEffect, useCallback } from 'react'
import { GITHUB } from '../constants'
import { GitHubIcon } from '../shared'

function SentinelLogo() {
  return (
    <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label="Sentinel — back to top">
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

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pipeline', href: '#pipeline' },
  { label: 'Downloads', href: '#downloads' },
  { label: 'Docs', href: '#docs' },
  { label: 'Roadmap', href: '#roadmap' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMenu = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [mobileOpen, closeMenu])

  const linkStyle: React.CSSProperties = {
    fontSize: 14, color: 'var(--text-dim)', fontWeight: 500,
    transition: 'color 0.15s', display: 'block', padding: '2px 0',
  }

  return (
    <>
      <nav
        id="top"
        aria-label="Main navigation"
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: scrolled ? 'rgba(10,13,20,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <div className="container" style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SentinelLogo />

          {/* Desktop links */}
          <ul className="nav-links" aria-label="Site sections">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <a
                  href={href}
                  style={linkStyle}
                  onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseOut={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Desktop GitHub button */}
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Sentinel on GitHub (opens in new tab)"
              className="nav-github-btn"
              style={{
                gap: 7, fontSize: 13, padding: '7px 16px', borderRadius: 7,
                background: 'var(--surface-raised)', border: '1px solid var(--border-strong)',
                color: 'var(--text)', fontWeight: 500, transition: 'border-color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
            >
              <GitHubIcon size={15} />
              GitHub
            </a>

            {/* Mobile hamburger */}
            <button
              className="nav-hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        id="mobile-nav-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`nav-mobile-overlay${mobileOpen ? ' open' : ''}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
          <SentinelLogo />
          <button
            onClick={closeMenu}
            aria-label="Close navigation menu"
            style={{
              background: 'none', border: '1px solid var(--border-strong)',
              borderRadius: 6, color: 'var(--text)', padding: 6,
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label="Mobile navigation" style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={closeMenu}
              style={{
                fontSize: 20, fontWeight: 600, color: 'var(--text)',
                padding: '12px 0', borderBottom: '1px solid var(--border)',
                display: 'block',
              }}
            >
              {label}
            </a>
          ))}
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
            style={{
              marginTop: 20, fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px', borderRadius: 8,
              background: 'var(--accent)', color: 'white',
              justifyContent: 'center',
            }}
          >
            <GitHubIcon size={16} />
            View on GitHub
          </a>
        </nav>
      </div>
    </>
  )
}
