import { ROADMAP, ROADMAP_STATUS_STYLE, ROADMAP_STATUS_LABEL } from '../constants'
import { SectionHeader } from '../shared'

export function Roadmap() {
  return (
    <section
      id="roadmap"
      aria-labelledby="roadmap-heading"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="container section-pad">
        <SectionHeader
          id="roadmap-heading"
          eyebrow="Roadmap"
          title="Where Sentinel is going."
          subtitle="From a desktop app to a full analysis platform — built in public, shipped incrementally."
        />

        <div className="roadmap-scroller">
          <div
            className="roadmap-track"
            role="list"
            aria-label="Roadmap phases"
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', top: 30, left: 24, right: 24,
                height: 1, background: 'var(--border)', zIndex: 0,
              }}
            />

            {ROADMAP.map((phase, i) => {
              const st = ROADMAP_STATUS_STYLE[phase.status]
              const dotColor =
                phase.status === 'current' ? '#22c55e'
                : phase.status === 'active' ? '#2f7bff'
                : 'var(--border-strong)'

              return (
                <div
                  key={phase.phase}
                  role="listitem"
                  style={{
                    width: 220,
                    paddingRight: i < ROADMAP.length - 1 ? 24 : 0,
                    position: 'relative', zIndex: 1,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: dotColor,
                      border: '2px solid var(--ink)',
                      marginBottom: 20,
                      boxShadow: phase.status === 'current' ? '0 0 12px rgba(34,197,94,0.5)' : 'none',
                    }}
                  />

                  <div style={{
                    background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{phase.phase}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '2px 7px', borderRadius: 3,
                        ...st,
                      }}>
                        {ROADMAP_STATUS_LABEL[phase.status]}
                      </span>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, letterSpacing: '-0.01em' }}>{phase.title}</h3>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {phase.items.map(item => (
                        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: 'var(--text-dim)' }}>
                          <div
                            aria-hidden="true"
                            style={{
                              width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                              background: dotColor,
                              marginTop: 5,
                            }}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
