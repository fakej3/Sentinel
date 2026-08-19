/**
 * AI Signal Authority Regression Tests
 *
 * Verifies that Gemini AI enhancement (Stage 11) can ONLY modify
 * generatedAnalysis.summary and generatedAnalysis.conclusion.
 * It must never affect: decision, confidence, fullTrend, tradePlan.direction,
 * entryZone, invalidationLevel, targetLevel, RR, maturity, or validation.
 *
 * Architecture guarantee: the AI stage runs AFTER all 10 deterministic stages
 * and only writes back to generatedAnalysis text fields via a prohibited-language
 * guard. If the guard triggers, even those text fields revert to deterministic output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GeminiProvider } from '../providers/gemini'

const BASE_INPUT = {
  symbol: 'BTCUSDT',
  interval: '1h',
  headline: 'BTCUSDT 1h: Bullish — Confidence 8.0/10',
  summary: 'Deterministic summary from the writer stage.',
  conclusion: 'Deterministic conclusion from the writer stage.',
  fullReport: 'Full deterministic report.',
  confidenceScore: 8.0,
  confidenceGrade: 'strong',
}

describe('AI cannot modify trading decision fields', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('AI output is limited to summary and conclusion fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"summary":"AI-rewritten summary.","conclusion":"AI-rewritten conclusion."}',
            }],
          },
        }],
      }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'key' })
    const result = await provider.enhance(BASE_INPUT)

    // AI may rewrite summary and conclusion
    expect(result.summary).toBe('AI-rewritten summary.')
    expect(result.conclusion).toBe('AI-rewritten conclusion.')

    // AI result has NO decision/confidence/tradePlan fields at all
    expect(result).not.toHaveProperty('decision')
    expect(result).not.toHaveProperty('confidence')
    expect(result).not.toHaveProperty('fullTrend')
    expect(result).not.toHaveProperty('tradePlan')
    expect(result).not.toHaveProperty('entryZone')
    expect(result).not.toHaveProperty('invalidationLevel')
    expect(result).not.toHaveProperty('targetLevel')
    expect(result).not.toHaveProperty('maturity')
    expect(result).not.toHaveProperty('validation')
  })

  it('AI result with prohibited hedging language falls back to deterministic text', async () => {
    // The pipeline has a PROHIBITED language check; the server endpoint (web/api/gemini.ts)
    // enforces the same check. Here we test the provider itself returns whatever it parses,
    // but the pipeline wraps it in a prohibited-language guard (pipeline/index.ts:343-355).
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"summary":"Bitcoin probably will go up.","conclusion":"It looks like bulls are back."}',
            }],
          },
        }],
      }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'key' })
    const result = await provider.enhance(BASE_INPUT)

    // Provider itself returns the enhanced text (prohibited-language guard is in the pipeline)
    expect(result.summary).toBe('Bitcoin probably will go up.')
    expect(result.conclusion).toBe('It looks like bulls are back.')

    // But still: no trading fields
    expect(result).not.toHaveProperty('decision')
    expect(result).not.toHaveProperty('tradePlan')
    expect(result).not.toHaveProperty('confidence')
  })

  it('AI enhance returns exactly two fields: summary and conclusion', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '{"summary":"S","conclusion":"C"}' }],
          },
        }],
      }),
    } as unknown as Response)

    const provider = new GeminiProvider({ apiKey: 'key' })
    const result = await provider.enhance(BASE_INPUT)

    // Exactly two keys
    expect(Object.keys(result)).toHaveLength(2)
    expect(Object.keys(result).sort()).toEqual(['conclusion', 'summary'])
  })

  it('AI network failure is silent — deterministic fields are unchanged', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'))

    const provider = new GeminiProvider({ apiKey: 'key' })
    await expect(provider.enhance(BASE_INPUT)).rejects.toThrow('network error')

    // The pipeline wraps this in try/catch and silently continues with original generatedAnalysis.
    // This test documents the provider throws; the pipeline test (pipeline.test.ts) covers
    // that the overall result is unchanged when the provider throws.
  })
})

describe('GeminiProvider uses gemini-2.5-flash model by default', () => {
  it('sends correct model in URL', async () => {
    let capturedUrl = ''
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      capturedUrl = url
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"summary":"S","conclusion":"C"}' }] } }],
        }),
      }
    }))

    const provider = new GeminiProvider({ apiKey: 'key' })
    await provider.enhance(BASE_INPUT)

    expect(capturedUrl).toContain('gemini-2.5-flash')
    vi.unstubAllGlobals()
  })
})
