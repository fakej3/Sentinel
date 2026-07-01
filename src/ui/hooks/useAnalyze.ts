import { useState, useCallback } from 'react'
import type { PipelineResult } from '../types'
import type { AnalyzeParams } from '../types'

interface AnalyzeState {
  data: PipelineResult | null
  loading: boolean
  error: string | null
}

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>({
    data: null,
    loading: false,
    error: null,
  })

  const analyze = useCallback(async (params: AnalyzeParams) => {
    setState({ data: null, loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: params.symbol.trim().toUpperCase(),
          interval: params.interval,
          candleLimit: params.candleLimit,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body as { error?: { message?: string } }).error?.message
          ?? `HTTP ${res.status}`
        throw new Error(msg)
      }

      const data = (await res.json()) as PipelineResult
      setState({ data, loading: false, error: null })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({ data: null, loading: false, error: message })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, analyze, reset }
}
