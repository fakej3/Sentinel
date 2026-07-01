import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../server'
import { PipelineError } from '../../modules/pipeline/index'
import { PIPELINE_VERSION } from '../../modules/pipeline/config'
import type { PipelineResult } from '../../modules/pipeline/types'
import type { AnalyzeFn } from '../types'

// ── Minimal PipelineResult stub for unit testing ────────────────────────────

function makePipelineResult(symbol = 'BTCUSDT', interval = '1h'): PipelineResult {
  return {
    candles: [],
    indicators: {} as PipelineResult['indicators'],
    marketStructure: {} as PipelineResult['marketStructure'],
    supportResistance: {} as PipelineResult['supportResistance'],
    volumeAnalysis: {} as PipelineResult['volumeAnalysis'],
    analysis: {} as PipelineResult['analysis'],
    validation: {} as PipelineResult['validation'],
    confidence: {} as PipelineResult['confidence'],
    generatedAnalysis: {} as PipelineResult['generatedAnalysis'],
    metadata: {
      symbol,
      interval: interval as PipelineResult['metadata']['interval'],
      candleCount: 200,
      timestamp: 1_000_000_000,
      executionTime: 42,
      version: PIPELINE_VERSION,
      timings: {
        fetch: 10,
        indicators: 5,
        marketStructure: 3,
        supportResistance: 3,
        volume: 3,
        analysis: 5,
        validation: 2,
        confidence: 1,
        writer: 5,
        total: 42,
      },
    },
  }
}

function mockAnalyze(result: PipelineResult): AnalyzeFn {
  return vi.fn().mockResolvedValue(result)
}

function throwingAnalyze(err: unknown): AnalyzeFn {
  return vi.fn().mockRejectedValue(err)
}

// ── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok and version', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', version: PIPELINE_VERSION })
  })

  it('version matches PIPELINE_VERSION', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).get('/health')
    expect(res.body.version).toBe(PIPELINE_VERSION)
  })

  it('includes X-Response-Time header', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).get('/health')
    expect(res.headers['x-response-time']).toMatch(/^\d+ms$/)
  })
})

// ── GET /version ─────────────────────────────────────────────────────────────

describe('GET /version', () => {
  it('returns 200 with version', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).get('/version')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ version: PIPELINE_VERSION })
  })

  it('version matches PIPELINE_VERSION', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).get('/version')
    expect(res.body.version).toBe(PIPELINE_VERSION)
  })
})

// ── POST /analyze — success ──────────────────────────────────────────────────

describe('POST /analyze — success', () => {
  it('returns 200 with PipelineResult on valid input', async () => {
    const result = makePipelineResult('BTCUSDT', '1h')
    const app = createApp(mockAnalyze(result))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.status).toBe(200)
    expect(res.body.metadata.symbol).toBe('BTCUSDT')
    expect(res.body.metadata.version).toBe(PIPELINE_VERSION)
  })

  it('returns the PipelineResult unchanged', async () => {
    const result = makePipelineResult('ETHUSDT', '4h')
    const app = createApp(mockAnalyze(result))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'ETHUSDT', interval: '4h' })
    expect(res.body.metadata.symbol).toBe('ETHUSDT')
    expect(res.body.metadata.interval).toBe('4h')
    expect(res.body.metadata.candleCount).toBe(200)
  })

  it('calls analyzeFn with uppercased symbol', async () => {
    const fn = mockAnalyze(makePipelineResult('BTCUSDT', '1h'))
    const app = createApp(fn)
    await request(app).post('/analyze').send({ symbol: 'btcusdt', interval: '1h' })
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'BTCUSDT', interval: '1h' }),
    )
  })

  it('passes candleLimit to analyzeFn when provided', async () => {
    const fn = mockAnalyze(makePipelineResult())
    const app = createApp(fn)
    await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h', candleLimit: 100 })
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ candleLimit: 100 }),
    )
  })

  it('passes config to analyzeFn when provided', async () => {
    const fn = mockAnalyze(makePipelineResult())
    const app = createApp(fn)
    const config = { minCandleCount: 75 }
    await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h', config })
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ config }),
    )
  })

  it('includes X-Response-Time header on success', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.headers['x-response-time']).toMatch(/^\d+ms$/)
  })

  it('response Content-Type is application/json', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('two identical requests produce identical response bodies', async () => {
    const result = makePipelineResult()
    const app = createApp(mockAnalyze(result))
    const body = { symbol: 'BTCUSDT', interval: '1h' }
    const r1 = await request(app).post('/analyze').send(body)
    const r2 = await request(app).post('/analyze').send(body)
    expect(r1.body).toEqual(r2.body)
  })
})

// ── POST /analyze — input validation ─────────────────────────────────────────

describe('POST /analyze — input validation', () => {
  it('returns 400 when symbol is missing', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/analyze').send({ interval: '1h' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_request')
  })

  it('returns 400 when symbol is an empty string', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/analyze').send({ symbol: '', interval: '1h' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_request')
  })

  it('returns 400 when symbol is a number', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/analyze').send({ symbol: 123, interval: '1h' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when interval is missing', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_request')
  })

  it('returns 400 when interval is not a valid Timeframe', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '99h' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_request')
  })

  it('returns 400 when candleLimit is zero', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h', candleLimit: 0 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when candleLimit is negative', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h', candleLimit: -10 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when candleLimit is a non-integer', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h', candleLimit: 1.5 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when candleLimit exceeds MAX_CANDLE_LIMIT', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h', candleLimit: 9999 })
    expect(res.status).toBe(400)
  })

  it('returns 400 when config is an array', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h', config: [] })
    expect(res.status).toBe(400)
  })

  it('returns 400 when config is a string', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .send({ symbol: 'BTCUSDT', interval: '1h', config: 'bad' })
    expect(res.status).toBe(400)
  })

  it('error response body has error.code and error.message', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/analyze').send({ interval: '1h' })
    expect(res.body).toHaveProperty('error.code')
    expect(res.body).toHaveProperty('error.message')
    expect(typeof res.body.error.code).toBe('string')
    expect(typeof res.body.error.message).toBe('string')
  })

  it('includes X-Response-Time header on validation failure', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/analyze').send({ interval: '1h' })
    expect(res.headers['x-response-time']).toMatch(/^\d+ms$/)
  })

  it('accepts all valid timeframe values', async () => {
    const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
    const app = createApp(mockAnalyze(makePipelineResult()))
    for (const interval of validIntervals) {
      const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval })
      expect(res.status).toBe(200)
    }
  })
})

// ── POST /analyze — PipelineError mapping ────────────────────────────────────

describe('POST /analyze — PipelineError mapping', () => {
  it('maps configuration_error to 400', async () => {
    const err = new PipelineError('configuration_error', 'pipeline', 'symbol is required')
    const app = createApp(throwingAnalyze(err))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('configuration_error')
    expect(res.body.error.message).toBe('symbol is required')
    expect(res.body.error.module).toBe('pipeline')
  })

  it('maps fetch_failure to 404', async () => {
    const err = new PipelineError('fetch_failure', 'binance', 'Symbol FAKEUSDT not found')
    const app = createApp(throwingAnalyze(err))
    const res = await request(app).post('/analyze').send({ symbol: 'FAKEUSDT', interval: '1h' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('fetch_failure')
  })

  it('maps insufficient_candles to 422', async () => {
    const err = new PipelineError('insufficient_candles', 'binance', 'Insufficient candles: need 50, got 5')
    const app = createApp(throwingAnalyze(err))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('insufficient_candles')
  })

  it('maps validation_failure to 422', async () => {
    const err = new PipelineError('validation_failure', 'validation', 'Critical validation failed')
    const app = createApp(throwingAnalyze(err))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('validation_failure')
  })

  it('maps internal_module_failure to 500', async () => {
    const err = new PipelineError('internal_module_failure', 'indicators', 'Unexpected crash')
    const app = createApp(throwingAnalyze(err))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('internal_module_failure')
    expect(res.body.error.module).toBe('indicators')
  })

  it('error response includes module field from PipelineError', async () => {
    const err = new PipelineError('fetch_failure', 'binance', 'timeout')
    const app = createApp(throwingAnalyze(err))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.body.error.module).toBe('binance')
  })

  it('includes X-Response-Time header on PipelineError', async () => {
    const err = new PipelineError('fetch_failure', 'binance', 'timeout')
    const app = createApp(throwingAnalyze(err))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.headers['x-response-time']).toMatch(/^\d+ms$/)
  })
})

// ── POST /analyze — unexpected errors ────────────────────────────────────────

describe('POST /analyze — unexpected errors', () => {
  it('returns 500 for generic Error', async () => {
    const app = createApp(throwingAnalyze(new Error('Something broke')))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('internal_error')
    expect(res.body.error.message).toBe('Something broke')
  })

  it('returns 500 for non-Error thrown value', async () => {
    const app = createApp(throwingAnalyze('string error'))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('internal_error')
  })

  it('error response has consistent shape on unexpected error', async () => {
    const app = createApp(throwingAnalyze(new Error('crash')))
    const res = await request(app).post('/analyze').send({ symbol: 'BTCUSDT', interval: '1h' })
    expect(res.body).toHaveProperty('error.code')
    expect(res.body).toHaveProperty('error.message')
  })
})

// ── Malformed JSON ────────────────────────────────────────────────────────────

describe('malformed JSON', () => {
  it('returns 400 when body is not valid JSON', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .set('Content-Type', 'application/json')
      .send('{ not valid json }')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_json')
  })

  it('error message explains the JSON parse failure', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app)
      .post('/analyze')
      .set('Content-Type', 'application/json')
      .send('{bad}')
    expect(res.body.error.message).toMatch(/json/i)
  })
})

// ── Unknown routes ────────────────────────────────────────────────────────────

describe('unknown routes', () => {
  it('returns 404 for GET /unknown', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).get('/unknown')
    expect(res.status).toBe(404)
  })

  it('returns 404 for POST /not-a-route', async () => {
    const app = createApp(mockAnalyze(makePipelineResult()))
    const res = await request(app).post('/not-a-route').send({})
    expect(res.status).toBe(404)
  })
})
