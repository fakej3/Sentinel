import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { FAQ as FAQ_ITEMS } from '../constants'
import { SectionHeader, ChevronDown } from '../shared'

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const toggle = useCallback((i: number) => {
    setOpen(prev => prev === i ? null : i)
  }, [])

  const onKey = useCallback((e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[Math.min(i + 1, FAQ_ITEMS.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      itemRefs.current[Math.max(i - 1, 0)]?.focus()
    }
  }, [])

  return (
    <section id="faq" aria-labelledby="faq-heading">
      <div className="container section-pad">
        <SectionHeader
          id="faq-heading"
          eyebrow="FAQ"
          title="Common questions."
        />

        <div
          style={{
            maxWidth: 720,
            border: '1px solid var(--border)',
            borderRadius: 8, overflow: 'hidden',
          }}
        >
          {FAQ_ITEMS.map(({ q, a }, i) => {
            const isOpen = open === i
            return (
              <div key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <h3 style={{ margin: 0 }}>
                  <button
                    ref={el => { itemRefs.current[i] = el }}
                    onClick={() => toggle(i)}
                    onKeyDown={e => onKey(e, i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${i}`}
                    id={`faq-btn-${i}`}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '18px 20px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                      background: isOpen ? 'var(--surface-raised)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      transition: 'background 0.15s',
                      minHeight: 44,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{q}</span>
                    <div
                      aria-hidden="true"
                      style={{
                        flexShrink: 0, color: 'var(--text-dim)',
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <ChevronDown />
                    </div>
                  </button>
                </h3>
                <div
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  style={{
                    maxHeight: isOpen ? '400px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease',
                  }}
                >
                  <div style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.75 }}>
                    {a}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
