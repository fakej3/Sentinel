import type { AIProvider, AIEnhancementInput, AIEnhancement, AIConfig } from '../types'

const DEFAULT_MODEL = 'gemini-1.5-flash'
const DEFAULT_MAX_TOKENS = 800
const DEFAULT_TEMPERATURE = 0.4
const DEFAULT_TIMEOUT_MS = 12_000
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: { message?: string }
}

function buildPrompt(input: AIEnhancementInput): string {
  return (
    `You are a professional crypto market analyst. Enhance the following analysis to be more insightful and actionable. ` +
    `Preserve all technical accuracy. Return ONLY a JSON object with keys "summary" and "conclusion" — no markdown fences.\n\n` +
    `SYMBOL: ${input.symbol} (${input.interval} timeframe)\n` +
    `HEADLINE: ${input.headline}\n` +
    `CONFIDENCE: ${input.confidenceScore.toFixed(1)}/10 (${input.confidenceGrade})\n\n` +
    `CURRENT SUMMARY:\n${input.summary}\n\n` +
    `CURRENT CONCLUSION:\n${input.conclusion}\n\n` +
    `Return JSON only:`
  )
}

function parseEnhancement(data: GeminiResponse, fallback: AIEnhancementInput): AIEnhancement {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { summary?: unknown; conclusion?: unknown }
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : fallback.summary
    const conclusion = typeof parsed.conclusion === 'string' && parsed.conclusion.trim().length > 0
      ? parsed.conclusion.trim()
      : fallback.conclusion
    return { summary, conclusion }
  } catch {
    return { summary: fallback.summary, conclusion: fallback.conclusion }
  }
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const
  readonly model: string

  private readonly apiKey: string
  private readonly maxTokens: number
  private readonly temperature: number
  private readonly timeoutMs: number

  constructor(config: Omit<AIConfig, 'provider'>) {
    this.apiKey = config.apiKey
    this.model = config.model ?? DEFAULT_MODEL
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  async enhance(input: AIEnhancementInput): Promise<AIEnhancement> {
    const url = `${GEMINI_BASE_URL}/${this.model}:generateContent`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: this.temperature,
          },
        }),
        signal: controller.signal,
      })

      const data = await response.json() as GeminiResponse

      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}: ${data.error?.message ?? response.statusText}`)
      }

      return parseEnhancement(data, input)
    } finally {
      clearTimeout(timer)
    }
  }
}
