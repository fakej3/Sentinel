import { useState, useEffect } from 'react'
import { checkHealth } from '../api'

export type ApiStatus = 'checking' | 'connected' | 'offline'

const POLL_INTERVAL_MS = 30_000

export function useApiStatus(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function poll() {
      const ok = await checkHealth(controller.signal)
      if (!cancelled) setStatus(ok ? 'connected' : 'offline')
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  return status
}
