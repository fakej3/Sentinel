import { describe, it, expect } from 'vitest'
import { checkAnalyzeResponseMatches } from '../analyzeResponseGuard'

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
