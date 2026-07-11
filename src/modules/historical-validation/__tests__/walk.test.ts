import { describe, it, expect } from 'vitest'
import { walkCandles } from '../walk'
import { runHistoricalValidation } from '../index'
import { generateTextReport } from '../text-report'
import type { Candle } from '../../binance/types'

// ── Synthetic candle factory ──────────────────────────────────────────────────
// Reused from benchmark/__tests__/helpers with a bullish trend shape
// so trade plans are actionable in at least some snapshots.

function makeCandles(count: number, basePrice = 50_000): Candle[] {
  const candles: Candle[] = []
  let price = basePrice
  for (let i = 0; i < count; i++) {
    const move  = Math.sin(i * 0.2) * (basePrice * 0.002)
    price = Math.max(basePrice * 0.5, price + move)
    const range = Math.abs(Math.cos(i * 0.3)) * (basePrice * 0.001) + basePrice * 0.0005
    const high  = price + range
    const low   = Math.max(0.01, price - range)
    const volume = 1000 + Math.abs(Math.sin(i * 0.15)) * 500
    const taker  = volume * (0.5 + Math.sin(i * 0.1) * 0.1)
    candles.push({
      openTime:        i * 3_600_000,
      closeTime:       i * 3_600_000 + 3_599_999,
      open:            Math.max(0.01, price - move / 2),
      high,
      low,
      close:           price,
      volume,
      quoteVolume:     price * volume,
      trades:          100,
      takerBuyVolume:  taker,
      takerSellVolume: volume - taker,
    })
  }
  return candles
}

// ─────────────────────────────────────────────────────────────────────────────

describe('walkCandles', () => {
  it('produces records when given enough candles', async () => {
    const candles = makeCandles(120)
    const records = await walkCandles('BTCUSDT', '1h', candles, {
      minCandleCount: 50,
      stepSize: 20,
      forwardLookBars: 10,
    })
    // Should produce snapshots at indices 50, 70, 90, 110 = 4 records
    expect(records.length).toBeGreaterThan(0)
  }, 30_000)

  it('returns no records when candles < minCandleCount', async () => {
    const candles = makeCandles(30)
    const records = await walkCandles('BTCUSDT', '1h', candles, {
      minCandleCount: 50,
      stepSize: 10,
      forwardLookBars: 5,
    })
    expect(records).toHaveLength(0)
  }, 10_000)

  it('each record has the expected shape', async () => {
    const candles = makeCandles(80)
    const records = await walkCandles('BTCUSDT', '1h', candles, {
      minCandleCount: 50,
      stepSize: 30,
      forwardLookBars: 5,
    })
    for (const r of records) {
      expect(r.snapshot.id).toBeTruthy()
      expect(r.snapshot.symbol).toBe('BTCUSDT')
      expect(r.snapshot.interval).toBe('1h')
      expect(r.snapshot.pipeline).toBeDefined()
      expect(['bullish', 'bearish', 'neutral']).toContain(r.snapshot.direction)
      expect(['tp_hit', 'sl_hit', 'neither', 'no_trade']).toContain(r.outcome.result)
    }
  }, 15_000)

  it('is deterministic — same inputs produce same records', async () => {
    const candles = makeCandles(80)
    const cfg = { minCandleCount: 50, stepSize: 30, forwardLookBars: 5 }
    const r1 = await walkCandles('BTCUSDT', '1h', candles, cfg)
    const r2 = await walkCandles('BTCUSDT', '1h', candles, cfg)
    expect(r1.length).toBe(r2.length)
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i].outcome.result).toBe(r2[i].outcome.result)
      expect(r1[i].snapshot.pipeline.confidence.score)
        .toBeCloseTo(r2[i].snapshot.pipeline.confidence.score, 6)
    }
  }, 30_000)
})

// ─────────────────────────────────────────────────────────────────────────────

describe('runHistoricalValidation', () => {
  it('returns a CalibrationDashboard with the expected shape', async () => {
    const candles = makeCandles(120)
    const dashboard = await runHistoricalValidation('BTCUSDT', '1h', candles, {
      minCandleCount: 50,
      stepSize: 20,
      forwardLookBars: 10,
    })

    expect(dashboard.symbol).toBe('BTCUSDT')
    expect(dashboard.interval).toBe('1h')
    expect(dashboard.totalCandlesAnalyzed).toBe(120)
    expect(dashboard.overall.totalSnapshots).toBeGreaterThan(0)
    expect(dashboard.confidence.buckets).toHaveLength(10)
    expect(dashboard.trust.tiers).toHaveLength(3)
    expect(dashboard.postValidation.totalChecked).toBeGreaterThan(0)
    // All post checks must pass — post is built from same pipeline data
    expect(dashboard.postValidation.failCount).toBe(0)
  }, 30_000)

  it('generateTextReport produces a non-empty markdown string', async () => {
    const candles = makeCandles(120)
    const dashboard = await runHistoricalValidation('BTCUSDT', '1h', candles, {
      minCandleCount: 50,
      stepSize: 20,
      forwardLookBars: 10,
    })
    const report = generateTextReport(dashboard)
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(100)
    expect(report).toContain('Calibration Report')
    expect(report).toContain('Overall Statistics')
    expect(report).toContain('Confidence Calibration')
    expect(report).toContain('Trust Validation')
    expect(report).toContain('Trade Plan Statistics')
    expect(report).toContain('Binance Post Validation')
  }, 30_000)
})
