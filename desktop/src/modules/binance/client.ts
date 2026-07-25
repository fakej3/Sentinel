import { SPOT_BASE_URL, FUTURES_BASE_URL, REQUEST_TIMEOUT_MS } from './constants'

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

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { msg?: string }
      if (import.meta.env.DEV) console.debug('[Binance] ✗', response.status, url, body)
      throw new BinanceApiError(
        body.msg ?? `HTTP ${response.status}`,
        response.status,
        url,
      )
    }

    if (import.meta.env.DEV) console.debug('[Binance] ✓', response.status, url)
    return response.json() as Promise<T>
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof BinanceApiError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (import.meta.env.DEV) console.debug('[Binance] ✗ timeout', url)
      throw new BinanceApiError('Request timed out', undefined, url)
    }
    if (import.meta.env.DEV) console.debug('[Binance] ✗ network', err, url)
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
