import { useState, useCallback } from 'react'
import { STAGES, CATEGORY_COLOR } from '../constants'
import { SectionHeader, ChevronDown } from '../shared'

export function Pipeline() {
  const [expanded, setExpanded] = useState<number | null>(null)

  const toggle = useCallback((id: number) => {
    setExpanded(prev => prev === id ? null : id)
  }, [])

  return (
    <section id="pipeline" aria-labelledby="pipeline-heading">
      <div className="container section-pad">
        <SectionHeader
          id="pipeline-heading"
          eyebrow="Analysis Engine"
          title="11 stages. Every number has a source."
          subtitle="The pipeline is deterministic. Each stage produces typed, documented output. The AI writer receives the finished result — it never drives the analysis."
        />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {STAGES.map((stage, i) => {
            const isLast = i === STAGES.length - 1
            const isOpen = expanded === stage.id
            const catColor = CATEGORY_COLOR[stage.category] ?? 'var(--text-dim)'

            return (
              <div key={stage.id} style={{ position: 'relative' }}>
                {!isLast && (
                  <div className="pipeline-connector" aria-hidden="true" />
                )}

                <h3 style={{ margin: 0 }}>
                  <button
                    onClick={() => toggle(stage.id)}
                    aria-expanded={isOpen}
                    aria-controls={`stage-body-${stage.id}`}
                    id={`stage-btn-${stage.id}`}
                    style={{
                      width: '100%', textAlign: 'left',
                      background: isOpen ? 'var(--surface-raised)' : 'transparent',
                      border: 'none', borderRadius: 8,
                      padding: '12px 16px 12px 0',
                      display: 'flex', alignItems: 'flex-start', gap: 16,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      position: 'relative', zIndex: 1,
                    }}
                  >
                    {/* Stage number */}
                    <div
                      aria-hidden="true"
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'var(--ink)', border: '1px solid var(--border-strong)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, color: catColor,
                        fontSize: 13, fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {String(stage.id).padStart(2, '0')}
                    </div>

                    <div style={{ flex: 1, paddingTop: 6, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>{stage.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                          background: `${catColor}18`, color: catColor,
                        }}>
                          {stage.category}
                        </span>
                      </div>
                    </div>

                    <div
                      aria-hidden="true"
                      style={{
                        marginTop: 10, color: 'var(--text-faint)', flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <ChevronDown />
                    </div>
                  </button>
                </h3>

                <div
                  id={`stage-body-${stage.id}`}
                  role="region"
                  aria-labelledby={`stage-btn-${stage.id}`}
                  hidden={!isOpen}
                  style={{
                    paddingLeft: 60, paddingRight: 16, paddingBottom: isOpen ? 12 : 0,
                    fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6,
                    overflow: 'hidden',
                  }}
                >
                  {stage.desc}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 40, padding: '20px 24px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: 'var(--text)' }}>Deterministic.</strong>{' '}
            Given the same candle data, the pipeline always produces the same output — to the decimal point.
            Confidence scores, trade plans, and evidence items are reproducible. The Gemini AI layer is opt-in and does not affect any computed values.
          </p>
        </div>
      </div>
    </section>
  )
}
