import { useState, useCallback, useRef, useEffect } from 'react'
import { getTransport, SentinelApiError } from '../transport'
import type { PipelineResult } from '@ui/types'
import type { AnalyzeParams } from '@ui/types'

const STAGES: Array<{ label: string; delayMs: number }> = [
  { label: 'Fetching candles…',     delayMs:    0 },
  { label: 'Computing indicators…', delayMs:  600 },
  { label: 'Market structure…',     delayMs: 1100 },
  { label: 'Volume analysis…',      delayMs: 1500 },
  { label: 'Support & Resistance…', delayMs: 1900 },
  { label: 'Confidence scoring…',   delayMs: 2400 },
  { label: 'Trade planning…',       delayMs: 2900 },
  { label: 'Writing analysis…',     delayMs: 3400 },
]

interface AnalyzeState {
  data: PipelineResult | null
  loading: boolean
  stage: string | null
  error: string | null
  errorDetail: string | undefined
}

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>({
    data: null, loading: false, stage: null, error: null, errorDetail: undefined,
  })

  const abortRef  = useRef<AbortController | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(id => clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => () => {
    clearTimers()
    abortRef.current?.abort()
  }, [clearTimers])

  const analyze = useCallback(async (params: AnalyzeParams) => {
    abortRef.current?.abort()
    clearTimers()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ data: null, loading: true, stage: STAGES[0].label, error: null, errorDetail: undefined })

    for (const s of STAGES.slice(1)) {
      const id = setTimeout(() => {
        setState(prev => prev.loading ? { ...prev, stage: s.label } : prev)
      }, s.delayMs)
      timersRef.current.push(id)
    }

    try {
      const data = await getTransport().analyze(
        params.symbol,
        params.interval,
        params.candleLimit !== undefined ? { candleLimit: params.candleLimit } : undefined,
        controller.signal,
      )

      if (controller.signal.aborted) return null

      clearTimers()
      setState({ data, loading: false, stage: null, error: null, errorDetail: undefined })
      return data
    } catch (err) {
      clearTimers()
      if (controller.signal.aborted) {
        if (abortRef.current === controller) {
          setState(prev => ({ ...prev, loading: false, stage: null }))
        }
        return null
      }

      const friendly = err instanceof SentinelApiError ? err.friendly
        : err instanceof Error ? err.message
        : 'Unknown error'
      const detail = err instanceof SentinelApiError ? err.detail : undefined

      setState({ data: null, loading: false, stage: null, error: friendly, errorDetail: detail })
      return null
    }
  }, [clearTimers])

  const cancel = useCallback(() => {
    clearTimers()
    abortRef.current?.abort()
    abortRef.current = null
    setState(prev => prev.loading ? { ...prev, loading: false, stage: null } : prev)
  }, [clearTimers])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, stage: null, error: null, errorDetail: undefined })
  }, [])

  const loadData = useCallback((result: PipelineResult) => {
    clearTimers()
    abortRef.current?.abort()
    abortRef.current = null
    setState({ data: result, loading: false, stage: null, error: null, errorDetail: undefined })
  }, [clearTimers])

  return { ...state, analyze, cancel, reset, loadData }
}
