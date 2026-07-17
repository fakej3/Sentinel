import type { CSSProperties, ReactNode } from 'react'

export const container: CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
}

export function SectionLabel({ children, color = 'var(--accent)' }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color, marginBottom: 12 }}>
      {children}
    </div>
  )
}

export function SectionHeader({
  id, eyebrow, title, subtitle, eyebrowColor,
}: {
  id: string
  eyebrow: string
  title: string
  subtitle?: string
  eyebrowColor?: string
}) {
  return (
    <div style={{ marginBottom: 56 }}>
      <SectionLabel color={eyebrowColor}>{eyebrow}</SectionLabel>
      {/* id goes on the h2 so aria-labelledby on the parent section resolves to the heading text */}
      <h2 id={id} style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 800, letterSpacing: '-0.025em', textWrap: 'balance' as never, lineHeight: 1.15 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ marginTop: 16, fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.7, maxWidth: 580 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0.5C3.86 0.5 0.5 3.86 0.5 8c0 3.32 2.15 6.14 5.14 7.14.38.07.52-.16.52-.36v-1.27c-2.1.46-2.54-.88-2.54-.88-.34-.87-.83-1.1-.83-1.1-.68-.46.05-.45.05-.45.75.05 1.15.77 1.15.77.67 1.15 1.76.82 2.19.63.07-.49.26-.82.47-1.01-1.67-.19-3.43-.84-3.43-3.73 0-.82.29-1.5.77-2.03-.08-.19-.33-.96.07-2 0 0 .63-.2 2.06.77.6-.17 1.24-.25 1.88-.25.64 0 1.28.08 1.88.25 1.43-.97 2.06-.77 2.06-.77.4 1.04.15 1.81.07 2 .48.53.77 1.21.77 2.03 0 2.9-1.77 3.54-3.45 3.73.27.23.51.69.51 1.39v2.06c0 .2.14.44.52.36C13.35 14.14 15.5 11.32 15.5 8c0-4.14-3.36-7.5-7.5-7.5z" />
    </svg>
  )
}

export function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
