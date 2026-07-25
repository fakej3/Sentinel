import { SPOT_BASE_URL, FUTURES_BASE_URL, REQUEST_TIMEOUT_MS } from './constants'
import { logRequestStart, logRequestSuccess, logRequestError } from './netlog'

export class BinanceApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
  ) {
    super(message)
    this.name = 'BinanceApiError'
  }
}

async function request<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (import.meta.env.DEV) console.debug('[Binance] →', url)

  const logId = logRequestStart(url)
  let hadResponse = false

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    hadResponse = true

    // Capture raw body before consuming it so the netlog has the preview
    const rawText = await response.text()
    const bodyPreview = rawText.slice(0, 500)

    // Capture all response headers as a plain object
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => { headers[key] = value })

    if (!response.ok) {
      let msg: string
      try {
        const json = JSON.parse(rawText) as { msg?: string }
        msg = json.msg ?? `HTTP ${response.status}`
      } catch {
        msg = `HTTP ${response.status}`
      }
      if (import.meta.env.DEV) console.debug('[Binance] ✗', response.status, url)
      logRequestSuccess(logId, response.status, headers, bodyPreview)
      throw new BinanceApiError(msg, response.status, url)
    }

    if (import.meta.env.DEV) console.debug('[Binance] ✓', response.status, url)
    logRequestSuccess(logId, response.status, headers, bodyPreview)
    return JSON.parse(rawText) as T
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof BinanceApiError) throw err

    if (err instanceof DOMException && err.name === 'AbortError') {
      if (import.meta.env.DEV) console.debug('[Binance] ✗ timeout', url)
      logRequestError(logId, new Error('Request timed out'), hadResponse)
      throw new BinanceApiError('Request timed out', undefined, url)
    }

    if (import.meta.env.DEV) console.debug('[Binance] ✗ network', err, url)
    logRequestError(logId, err, hadResponse)
    throw new BinanceApiError(
      err instanceof Error ? err.message : 'Network error',
      undefined,
      url,
    )
  }
}

function buildUrl(base: string, path: string, params: Record<string, string | number>): string {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  )
  return `${base}${path}?${query}`
}

export function spotRequest<T>(path: string, params: Record<string, string | number>): Promise<T> {
  return request<T>(buildUrl(SPOT_BASE_URL, path, params))
}

export function futuresRequest<T>(path: string, params: Record<string, string | number>): Promise<T> {
  return request<T>(buildUrl(FUTURES_BASE_URL, path, params))
}
