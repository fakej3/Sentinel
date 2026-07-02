import { useState, useCallback, useRef } from 'react'
import { analyze as apiAnalyze, SentinelApiError } from '../api'
import type { PipelineResult } from '../types'
import type { AnalyzeParams } from '../types'

interface AnalyzeState {
  data: PipelineResult | null
  loading: boolean
  error: string | null
  errorDetail: string | undefined
}

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>({
    data: null,
    loading: false,
    error: null,
    errorDetail: undefined,
  })

  const abortRef = useRef<AbortController | null>(null)

  const analyze = useCallback(async (params: AnalyzeParams) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ data: null, loading: true, error: null, errorDetail: undefined })

    try {
      const data = await apiAnalyze(
        params.symbol,
        params.interval,
        params.candleLimit !== undefined ? { candleLimit: params.candleLimit } : undefined,
        controller.signal,
      )

      if (controller.signal.aborted) return null

      setState({ data, loading: false, error: null, errorDetail: undefined })
      return data
    } catch (err) {
      if (controller.signal.aborted) {
        setState(prev => ({ ...prev, loading: false }))
        return null
      }

      const friendly = err instanceof SentinelApiError ? err.friendly
        : err instanceof Error ? err.message
        : 'Unknown error'
      const detail = err instanceof SentinelApiError ? err.detail : undefined

      setState({ data: null, loading: false, error: friendly, errorDetail: detail })
      return null
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState(prev => prev.loading ? { ...prev, loading: false } : prev)
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, errorDetail: undefined })
  }, [])

  return { ...state, analyze, cancel, reset }
}
