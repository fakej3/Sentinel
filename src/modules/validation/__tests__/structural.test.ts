import { describe, it, expect } from 'vitest'
import { checkStructural } from '../validate/structural'
import { DEFAULT_VALIDATION_CONFIG } from '../config'
import { makeValidResult, makeStructure, makeSupportResistance, makePriceZone } from './helpers'
import type { StructureEvent } from '../../market-structure/types'

function makeBOSEvent(index: number, direction: 'bullish' | 'bearish' = 'bullish'): StructureEvent {
  return { type: 'BOS', index, timestamp: index * 3_600_000, level: 100, direction }
}

function makeCHOCHEvent(index: number, direction: 'bullish' | 'bearish' = 'bearish'): StructureEvent {
  return { type: 'CHOCH', index, timestamp: index * 3_600_000, level: 90, direction }
}

describe('checkStructural', () => {
  it('returns no issues for a fully valid result', () => {
    const result = makeValidResult()
    expect(checkStructural(result, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  it('returns no issues when there are zones with valid geometry', () => {
    const zone = makePriceZone('support', 80)
    const result = makeValidResult({
      supportResistance: makeSupportResistance({
        zones: [zone],
        activeSupport: [zone],
      }),
    })
    expect(checkStructural(result, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  it('flags a zone where lower > center', () => {
    const zone = makePriceZone('support', 80)
    // Make lower > center: center=80, lower=82 (violation)
    const badZone = { ...zone, lower: 82, upper: 85, center: 80, width: 3 }
    const result = makeValidResult({
      supportResistance: makeSupportResistance({ zones: [badZone] }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field.includes('lower'))).toBe(true)
  })

  it('flags a zone where center > upper', () => {
    const zone = makePriceZone('resistance', 100)
    const badZone = { ...zone, center: 105, lower: 99, upper: 101, width: 2 }
    const result = makeValidResult({
      supportResistance: makeSupportResistance({ zones: [badZone] }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field.includes('center'))).toBe(true)
  })

  it('flags a zone where lower >= upper', () => {
    const zone = makePriceZone('support', 80)
    const badZone = { ...zone, lower: 81, upper: 81, center: 81, width: 0 }
    const result = makeValidResult({
      supportResistance: makeSupportResistance({ zones: [badZone] }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.message.includes('no width'))).toBe(true)
  })

  it('flags activeSupport containing a zone of type resistance', () => {
    const zone = makePriceZone('resistance', 80) // wrong type in activeSupport
    const result = makeValidResult({
      supportResistance: makeSupportResistance({
        zones: [zone],
        activeSupport: [zone],
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i =>
      i.field.startsWith('supportResistance.activeSupport') &&
      i.message.includes("type 'resistance'")
    )).toBe(true)
  })

  it('flags activeSupport containing a broken zone', () => {
    const zone = { ...makePriceZone('support', 80), broken: true }
    const result = makeValidResult({
      supportResistance: makeSupportResistance({
        zones: [zone],
        activeSupport: [zone],
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i =>
      i.field.startsWith('supportResistance.activeSupport') &&
      i.message.includes('broken')
    )).toBe(true)
  })

  it('flags activeResistance containing a zone of type support', () => {
    const zone = makePriceZone('support', 120) // wrong type in activeResistance
    const result = makeValidResult({
      supportResistance: makeSupportResistance({
        zones: [zone],
        activeResistance: [zone],
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i =>
      i.field.startsWith('supportResistance.activeResistance') &&
      i.message.includes("type 'support'")
    )).toBe(true)
  })

  it('flags bos.detected true when bos.events is empty', () => {
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [], last: null }, // detected but no events
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'marketStructure.bos.detected')).toBe(true)
  })

  it('flags bos.detected false when bos.events has entries', () => {
    const e1 = makeBOSEvent(10)
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: false, events: [e1], last: e1 }, // not detected but has events
        events: [e1],
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'marketStructure.bos.detected')).toBe(true)
  })

  it('flags choch.detected true when choch.events is empty', () => {
    const result = makeValidResult({
      marketStructure: makeStructure({
        choch: { detected: true, events: [], last: null },
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'marketStructure.choch.detected')).toBe(true)
  })

  it('flags bos.last not matching the final event in bos.events', () => {
    const e1 = makeBOSEvent(10)
    const e2 = makeBOSEvent(20)
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [e1, e2], last: e1 }, // last should be e2
        events: [e1, e2],
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'marketStructure.bos.last')).toBe(true)
  })

  it('flags bos.last non-null when bos is not detected', () => {
    const e1 = makeBOSEvent(10)
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: false, events: [], last: e1 }, // last should be null
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'marketStructure.bos.last')).toBe(true)
  })

  it('flags BOS events in non-chronological order', () => {
    const e1 = makeBOSEvent(20)
    const e2 = makeBOSEvent(10) // index 10 comes after 20 — wrong
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [e1, e2], last: e2 },
        events: [e1, e2],
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field.startsWith('marketStructure.bos.events'))).toBe(true)
  })

  it('flags events array count not matching bos + choch event totals', () => {
    const e1 = makeBOSEvent(10)
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [e1], last: e1 },
        choch: { detected: false, events: [], last: null },
        events: [], // wrong: should contain e1
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field === 'marketStructure.events')).toBe(true)
  })

  it('flags events array in non-chronological order', () => {
    const e1 = makeBOSEvent(20)
    const e2 = makeCHOCHEvent(10) // CHOCH at index 10 appears after BOS at index 20
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [e1], last: e1 },
        choch: { detected: true, events: [e2], last: e2 },
        events: [e1, e2], // wrong order
      }),
    })
    const issues = checkStructural(result, DEFAULT_VALIDATION_CONFIG)
    expect(issues.some(i => i.field.startsWith('marketStructure.events'))).toBe(true)
  })

  it('does not flag valid BOS + CHOCH events in correct chronological order', () => {
    const e1 = makeBOSEvent(10)
    const e2 = makeCHOCHEvent(20)
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [e1], last: e1 },
        choch: { detected: true, events: [e2], last: e2 },
        events: [e1, e2],
      }),
    })
    expect(checkStructural(result, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  // ── HIGH-01 regression: structural equality survives object copies and JSON round-trips ──

  it('does not flag bos.last when it is a shallow copy of the final event (structural equality)', () => {
    const e1 = makeBOSEvent(10)
    const e1copy = { ...e1 } // different object reference, identical fields
    const result = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [e1], last: e1copy },
        events: [e1],
      }),
    })
    expect(checkStructural(result, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  it('does not flag choch.last when it is a shallow copy of the final event (structural equality)', () => {
    const e1 = makeCHOCHEvent(15)
    const e1copy = { ...e1 }
    const result = makeValidResult({
      marketStructure: makeStructure({
        choch: { detected: true, events: [e1], last: e1copy },
        events: [e1],
      }),
    })
    expect(checkStructural(result, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  it('does not flag bos.last after a JSON round-trip (deserialization breaks reference equality)', () => {
    const e1 = makeBOSEvent(10)
    const resultBefore = makeValidResult({
      marketStructure: makeStructure({
        bos: { detected: true, events: [e1], last: e1 },
        events: [e1],
      }),
    })
    // Simulate Module 12 serialize → deserialize
    const resultAfter = JSON.parse(JSON.stringify(resultBefore)) as typeof resultBefore
    // After JSON round-trip, bos.last and bos.events[0] are different object references
    // but structurally identical — the validator must not flag this
    expect(checkStructural(resultAfter, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })

  it('does not flag choch.last after a JSON round-trip', () => {
    const e1 = makeCHOCHEvent(20)
    const resultBefore = makeValidResult({
      marketStructure: makeStructure({
        choch: { detected: true, events: [e1], last: e1 },
        events: [e1],
      }),
    })
    const resultAfter = JSON.parse(JSON.stringify(resultBefore)) as typeof resultBefore
    expect(checkStructural(resultAfter, DEFAULT_VALIDATION_CONFIG)).toHaveLength(0)
  })
})
