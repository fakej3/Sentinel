import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GeminiProvider } from '../providers/gemini'
import { createAIProvider } from '../index'

const BASE_INPUT = {
  symbol: 'BTCUSDT',
  interval: '1h',
  headline: 'BTCUSDT 1h: Bullish — Confidence 7.5/10',
  summary: 'Bitcoin shows strong upward momentum with RSI at 65.',
  conclusion: 'Bias is bullish with momentum support.',
  fullReport: 'Full report text here.',
  confidenceScore: 7.5,
  confidenceGrade: 'B',
}

// ── GeminiProvider ──────────────────────────────────────────────────────────

describe('GeminiProvider', () => {
  it('isAvailable returns true when apiKey is non-empty', () => {
    const p = new GeminiProvider({ apiKey: 'test-key' })
    expect(p.isAvailable()).toBe(true)
  })

  it('isAvailable returns false when apiKey is empty', () => {
    const p = new GeminiProvider({ apiKey: '' })
    expect(p.isAvailable()).toBe(false)
  })

  it('has name "gemini"', () => {
    const p = new GeminiProvider({ apiKey: 'key' })
    expect(p.name).toBe('gemini')
  })

  it('defaults to gemini-1.5-flash model', () => {
    const p = new GeminiProvider({ apiKey: 'key' })
    expect(p.model).toBe('gemini-1.5-flash')
  })

  it('uses custom model when provided', () => {
    const p = new GeminiProvider({ apiKey: 'key', model: 'gemini-pro' })
    expect(p.model).toBe('gemini-pro')
  })
})

// ── GeminiProvider.enhance — success path ────────────────────────────────────

describe('GeminiProvider.enhance — success path', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns enhanced summary and conclusion on valid JSON response', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"summary":"Enhanced summary.","conclusion":"Enhanced conclusion."}',
            }],
          },
        }],
      }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'test-key' })
    const result = await provider.enhance(BASE_INPUT)

    expect(result.summary).toBe('Enhanced summary.')
    expect(result.conclusion).toBe('Enhanced conclusion.')
  })

  it('strips markdown fences from JSON response', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '```json\n{"summary":"Enhanced.","conclusion":"Done."}\n```',
            }],
          },
        }],
      }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'test-key' })
    const result = await provider.enhance(BASE_INPUT)

    expect(result.summary).toBe('Enhanced.')
    expect(result.conclusion).toBe('Done.')
  })

  it('falls back to original values when API returns malformed JSON', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'not json at all' }] } }],
      }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'test-key' })
    const result = await provider.enhance(BASE_INPUT)

    expect(result.summary).toBe(BASE_INPUT.summary)
    expect(result.conclusion).toBe(BASE_INPUT.conclusion)
  })

  it('falls back to original values when API returns empty summary', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"summary":"","conclusion":"Enhanced."}' }] } }],
      }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'test-key' })
    const result = await provider.enhance(BASE_INPUT)

    expect(result.summary).toBe(BASE_INPUT.summary)
    expect(result.conclusion).toBe('Enhanced.')
  })

  it('throws on non-ok HTTP response', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Invalid API key' } }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'bad-key' })
    await expect(provider.enhance(BASE_INPUT)).rejects.toThrow('400')
  })
})

// ── createAIProvider factory ─────────────────────────────────────────────────

describe('createAIProvider', () => {
  it('returns a GeminiProvider for provider "gemini"', () => {
    const provider = createAIProvider({ provider: 'gemini', apiKey: 'key' })
    expect(provider.name).toBe('gemini')
  })

  it('throws for unknown provider', () => {
    expect(() =>
      createAIProvider({ provider: 'unknown' as 'gemini', apiKey: 'key' }),
    ).toThrow()
  })
})
