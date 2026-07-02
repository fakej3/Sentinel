import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyze, checkHealth, SentinelApiError } from '../api'
import type { PipelineResult } from '../types'
import { PIPELINE_VERSION } from '../../modules/pipeline/config'

// ── fetch mock setup ──────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', mockFetch)

function mockOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function mockError(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: String(status),
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function makePipelineResult(symbol = 'BTCUSDT'): PipelineResult {
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
      interval: '1h' as PipelineResult['metadata']['interval'],
      candleCount: 200,
      timestamp: 1_000_000,
      executionTime: 42,
      version: PIPELINE_VERSION,
      timings: { fetch: 10, indicators: 5, marketStructure: 3, supportResistance: 3, volume: 3, analysis: 5, validation: 2, confidence: 1, writer: 5, total: 42 },
    },
  }
}

// Helper: run fn and assert it throws SentinelApiError, then return the error
async function catchApiError(fn: () => Promise<unknown>): Promise<SentinelApiError> {
  try {
    await fn()
    throw new Error('Expected SentinelApiError but function resolved')
  } catch (e) {
    if (e instanceof SentinelApiError) return e
    throw e
  }
}

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── analyze() — success ───────────────────────────────────────────────────────

describe('analyze() — success', () => {
  it('returns PipelineResult on 200', async () => {
    const expected = makePipelineResult()
    mockFetch.mockResolvedValue(mockOk(expected))

    const result = await analyze('BTCUSDT', '1h')

    expect(result.metadata.symbol).toBe('BTCUSDT')
    expect(result.metadata.version).toBe(PIPELINE_VERSION)
  })

  it('upcases the symbol before sending', async () => {
    mockFetch.mockResolvedValue(mockOk(makePipelineResult()))
    await analyze('btcusdt', '1h')

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as { symbol: string }
    expect(body.symbol).toBe('BTCUSDT')
  })

  it('sends candleLimit when provided', async () => {
    mockFetch.mockResolvedValue(mockOk(makePipelineResult()))
    await analyze('BTCUSDT', '1h', { candleLimit: 100 })

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as { candleLimit: number }
    expect(body.candleLimit).toBe(100)
  })

  it('omits candleLimit when not provided', async () => {
    mockFetch.mockResolvedValue(mockOk(makePipelineResult()))
    await analyze('BTCUSDT', '1h')

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>
    expect('candleLimit' in body).toBe(false)
  })

  it('posts to /analyze endpoint', async () => {
    mockFetch.mockResolvedValue(mockOk(makePipelineResult()))
    await analyze('BTCUSDT', '1h')

    expect(mockFetch.mock.calls[0][0]).toMatch(/\/analyze$/)
  })
})

// ── analyze() — HTTP errors ───────────────────────────────────────────────────

describe('analyze() — HTTP errors', () => {
  it('throws SentinelApiError with kind=http on 500', async () => {
    mockFetch.mockResolvedValue(mockError(500, { error: { code: 'internal_error', message: 'crash' } }))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.kind).toBe('http')
    expect(err.status).toBe(500)
  })

  it('exposes server error code on 502 fetch_failure', async () => {
    mockFetch.mockResolvedValue(mockError(502, { error: { code: 'fetch_failure', message: 'upstream down' } }))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.kind).toBe('http')
    expect(err.status).toBe(502)
    expect(err.code).toBe('fetch_failure')
  })

  it('friendly message differs from raw HTTP text on 502', async () => {
    mockFetch.mockResolvedValue(mockError(502, {}))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.friendly).not.toMatch(/^HTTP 502/)
    expect(err.friendly.length).toBeGreaterThan(10)
  })

  it('throws SentinelApiError with kind=http on 400', async () => {
    mockFetch.mockResolvedValue(mockError(400, { error: { code: 'invalid_request', message: 'bad symbol' } }))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.kind).toBe('http')
    expect(err.status).toBe(400)
  })

  it('populates detail from server error message', async () => {
    mockFetch.mockResolvedValue(mockError(422, { error: { code: 'insufficient_candles', message: 'only 10 candles' } }))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.detail).toContain('10 candles')
  })
})

// ── analyze() — network failure ───────────────────────────────────────────────

describe('analyze() — network failure', () => {
  it('throws SentinelApiError with kind=network when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.kind).toBe('network')
  })

  it('friendly message mentions backend server', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.friendly).toMatch(/backend|server|API/i)
  })

  it('preserves original error in detail', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.detail).toContain('Failed to fetch')
  })
})

// ── analyze() — request cancellation ─────────────────────────────────────────

describe('analyze() — request cancellation', () => {
  it('throws SentinelApiError with kind=abort when signal is aborted', async () => {
    const controller = new AbortController()

    mockFetch.mockImplementation(() =>
      new Promise<Response>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      }),
    )

    const promise = analyze('BTCUSDT', '1h', undefined, controller.signal)
    controller.abort()

    const err = await catchApiError(() => promise)
    expect(err.kind).toBe('abort')
  })

  it('passes the AbortSignal through to fetch', async () => {
    const controller = new AbortController()
    mockFetch.mockResolvedValue(mockOk(makePipelineResult()))
    await analyze('BTCUSDT', '1h', undefined, controller.signal)

    const opts = mockFetch.mock.calls[0][1] as RequestInit
    expect(opts.signal).toBe(controller.signal)
  })
})

// ── analyze() — malformed response ───────────────────────────────────────────

describe('analyze() — malformed response', () => {
  it('throws SentinelApiError with kind=parse when JSON is invalid', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as unknown as Response)

    const err = await catchApiError(() => analyze('BTCUSDT', '1h'))
    expect(err.kind).toBe('parse')
  })
})

// ── checkHealth() ─────────────────────────────────────────────────────────────

describe('checkHealth()', () => {
  it('returns true when /health responds with 200', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response)

    const ok = await checkHealth()
    expect(ok).toBe(true)
  })

  it('calls the /health endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response)
    await checkHealth()

    expect(mockFetch.mock.calls[0][0]).toMatch(/\/health$/)
  })

  it('returns false when fetch rejects (offline)', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const ok = await checkHealth()
    expect(ok).toBe(false)
  })

  it('returns false when /health responds with non-200', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 } as Response)

    const ok = await checkHealth()
    expect(ok).toBe(false)
  })

  it('passes AbortSignal to fetch when provided', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response)
    const controller = new AbortController()
    await checkHealth(controller.signal)

    const opts = mockFetch.mock.calls[0][1] as RequestInit
    expect(opts?.signal).toBe(controller.signal)
  })
})
