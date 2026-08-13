import { describe, it, expect } from 'vitest'
import { checkAnalyzeResponseMatches, checkAnalyzeWindowStaleness } from '../analyzeResponseGuard'

describe('checkAnalyzeResponseMatches', () => {
  it('returns null when symbol and interval both match', () => {
    const data = { metadata: { symbol: 'BTCUSDT', interval: '1h' } }
    expect(checkAnalyzeResponseMatches(data, 'BTCUSDT', '1h')).toBeNull()
  })

  it('normalises the requested symbol (trim + uppercase) before comparing', () => {
    const data = { metadata: { symbol: 'BTCUSDT', interval: '4h' } }
    expect(checkAnalyzeResponseMatches(data, ' btcusdt ', '4h')).toBeNull()
  })

  it('flags a mismatched symbol — a late response for a previously-analyzed pair', () => {
    const data = { metadata: { symbol: 'ETHUSDT', interval: '1h' } }
    const mismatch = checkAnalyzeResponseMatches(data, 'BTCUSDT', '1h')
    expect(mismatch).toEqual({
      requestedSymbol: 'BTCUSDT',
      requestedInterval: '1h',
      receivedSymbol: 'ETHUSDT',
      receivedInterval: '1h',
    })
  })

  it('flags a mismatched interval — a stale response for a different timeframe', () => {
    const data = { metadata: { symbol: 'BTCUSDT', interval: '1h' } }
    const mismatch = checkAnalyzeResponseMatches(data, 'BTCUSDT', '4h')
    expect(mismatch).toEqual({
      requestedSymbol: 'BTCUSDT',
      requestedInterval: '4h',
      receivedSymbol: 'BTCUSDT',
      receivedInterval: '1h',
    })
  })

  it('flags when both symbol and interval mismatch simultaneously', () => {
    const data = { metadata: { symbol: 'ETHUSDT', interval: '15m' } }
    const mismatch = checkAnalyzeResponseMatches(data, 'BTCUSDT', '1h')
    expect(mismatch).not.toBeNull()
    expect(mismatch!.receivedSymbol).toBe('ETHUSDT')
    expect(mismatch!.receivedInterval).toBe('15m')
  })

  it('interval comparison is case-sensitive / exact (no normalisation applied)', () => {
    // Interval strings are not user-typed free text like symbols — they come
    // from a fixed set of values, so no normalisation is applied to them.
    const data = { metadata: { symbol: 'BTCUSDT', interval: '1H' } }
    expect(checkAnalyzeResponseMatches(data, 'BTCUSDT', '1h')).not.toBeNull()
  })
})

// ── checkAnalyzeWindowStaleness ───────────────────────────────────────────────

const H1 = 3_600_000   // 1h interval in ms
const BASE = 1_700_000_000_000   // arbitrary base timestamp (ms)

describe('checkAnalyzeWindowStaleness', () => {
  it('returns null when metadata.window is absent (pre-field saved analysis)', () => {
    const meta = {} as { window?: { lastOpenTime: number } }
    expect(checkAnalyzeWindowStaleness(meta, BASE, H1)).toBeNull()
  })

  it('returns null when analysis and chart are on exactly the same candle', () => {
    const meta = { window: { lastOpenTime: BASE } }
    expect(checkAnalyzeWindowStaleness(meta, BASE, H1)).toBeNull()
  })

  it('returns null when analysis is exactly 1 interval behind the chart (acceptable race)', () => {
    // In web/HTTP mode the server fetches via REST while the chart streams via
    // WebSocket. A 1-candle lag is the worst-case normal race condition.
    const meta = { window: { lastOpenTime: BASE } }
    expect(checkAnalyzeWindowStaleness(meta, BASE + H1, H1)).toBeNull()
  })

  it('returns null when analysis is exactly 1 interval ahead of the chart', () => {
    // Symmetric tolerance: analysis candle slightly ahead also within tolerance.
    const meta = { window: { lastOpenTime: BASE + H1 } }
    expect(checkAnalyzeWindowStaleness(meta, BASE, H1)).toBeNull()
  })

  it('returns null at the exact 1-interval boundary (tolerance is inclusive)', () => {
    const meta = { window: { lastOpenTime: BASE - H1 } }
    expect(checkAnalyzeWindowStaleness(meta, BASE, H1)).toBeNull()
  })

  it('flags when analysis is more than 1 interval behind the chart', () => {
    // 2 candles behind → the analysis describes a genuinely older snapshot.
    const meta = { window: { lastOpenTime: BASE - 2 * H1 } }
    const warning = checkAnalyzeWindowStaleness(meta, BASE, H1)
    expect(warning).not.toBeNull()
    expect(warning!.analysisLastOpenTime).toBe(BASE - 2 * H1)
    expect(warning!.chartLastOpenTime).toBe(BASE)
    expect(warning!.driftMs).toBe(-2 * H1)
  })

  it('flags when analysis is more than 1 interval ahead of the chart', () => {
    // Should not normally happen — included for symmetry and to guard against
    // clock-skew scenarios where the server time leads the client.
    const meta = { window: { lastOpenTime: BASE + 2 * H1 } }
    const warning = checkAnalyzeWindowStaleness(meta, BASE, H1)
    expect(warning).not.toBeNull()
    expect(warning!.driftMs).toBe(2 * H1)
  })

  it('drift value is analysisLastOpenTime minus chartLastOpenTime', () => {
    const meta = { window: { lastOpenTime: BASE - 5 * H1 } }
    const warning = checkAnalyzeWindowStaleness(meta, BASE, H1)!
    expect(warning.driftMs).toBe(meta.window.lastOpenTime - BASE)
  })

  it('works correctly with 15m interval (900_000 ms tolerance)', () => {
    const M15 = 900_000
    const metaOk   = { window: { lastOpenTime: BASE - M15 } }
    const metaStale = { window: { lastOpenTime: BASE - 2 * M15 } }
    expect(checkAnalyzeWindowStaleness(metaOk,    BASE, M15)).toBeNull()
    expect(checkAnalyzeWindowStaleness(metaStale, BASE, M15)).not.toBeNull()
  })

  it('works correctly with 1d interval (86_400_000 ms tolerance)', () => {
    const D1 = 86_400_000
    const metaOk    = { window: { lastOpenTime: BASE - D1 } }
    const metaStale  = { window: { lastOpenTime: BASE - 2 * D1 } }
    expect(checkAnalyzeWindowStaleness(metaOk,    BASE, D1)).toBeNull()
    expect(checkAnalyzeWindowStaleness(metaStale, BASE, D1)).not.toBeNull()
  })
})
