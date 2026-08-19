/**
 * Server-side Gemini AI enhancement endpoint.
 * The API key is read from the GEMINI_API_KEY environment variable (Vercel project settings),
 * never from client-supplied input. The browser sends only the analysis content to enhance.
 *
 * Vercel Edge Runtime — uses Web Request/Response API.
 */

export const config = { runtime: 'edge' }

const DEFAULT_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const PROHIBITED = ['probably', 'maybe', 'looks like', 'appears to', 'might suggest', 'seems like']

interface EnhancementInput {
  symbol: string
  interval: string
  headline: string
  summary: string
  conclusion: string
  fullReport: string
  confidenceScore: number
  confidenceGrade: string
}

interface EnhancementOutput {
  summary: string
  conclusion: string
}

function buildPrompt(input: EnhancementInput): string {
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // No key configured — inform client so it can gracefully skip AI enhancement
    return json({ error: 'AI enhancement not configured' }, 503)
  }

  let input: EnhancementInput
  try {
    input = (await req.json()) as EnhancementInput
    if (!input.symbol || !input.summary || !input.conclusion) {
      return json({ error: 'Missing required fields' }, 400)
    }
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL
  const url = `${GEMINI_BASE_URL}/${model}:generateContent`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
      }),
    })

    if (!response.ok) {
      return json({ error: `Gemini error ${response.status}` }, 502)
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

    let parsed: { summary?: unknown; conclusion?: unknown }
    try {
      parsed = JSON.parse(cleaned) as { summary?: unknown; conclusion?: unknown }
    } catch {
      return json({ error: 'Malformed AI response' }, 502)
    }

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : input.summary
    const conclusion =
      typeof parsed.conclusion === 'string' && parsed.conclusion.trim().length > 0
        ? parsed.conclusion.trim()
        : input.conclusion

    // Safety guard: reject hedging language that implies uncertain AI speculation
    const hasProhibited = PROHIBITED.some(
      phrase =>
        summary.toLowerCase().includes(phrase) || conclusion.toLowerCase().includes(phrase),
    )
    if (hasProhibited) {
      return json({ summary: input.summary, conclusion: input.conclusion })
    }

    const output: EnhancementOutput = { summary, conclusion }
    return json(output)
  } catch {
    return json({ error: 'Enhancement failed' }, 502)
  }
}
