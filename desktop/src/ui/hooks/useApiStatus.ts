import { useState, useEffect } from 'react'
import { getTransport, isTauriEnv } from '../transport'

export type ApiStatus = 'checking' | 'connected' | 'offline'

const POLL_INTERVAL_MS = 30_000

export function useApiStatus(): ApiStatus {
  // In desktop (TauriTransport), health() is always true — skip polling entirely
  const [status, setStatus] = useState<ApiStatus>(() => isTauriEnv() ? 'connected' : 'checking')

  useEffect(() => {
    if (isTauriEnv()) return  // engine is always local, no polling needed

    let cancelled = false
    const controller = new AbortController()

    async function poll() {
      const ok = await getTransport().health(controller.signal)
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
