import { clsx } from 'clsx'
import { useApiStatus } from '../../hooks/useApiStatus'

export function ApiStatusIndicator() {
  const status = useApiStatus()

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium select-none',
        status === 'connected' && 'bg-emerald-400/10 text-emerald-400',
        status === 'offline'   && 'bg-red-400/10 text-red-400',
        status === 'checking'  && 'bg-slate-400/10 text-slate-500',
      )}
    >
      <span
        className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', {
          'bg-emerald-400':            status === 'connected',
          'bg-red-400':                status === 'offline',
          'bg-slate-400 animate-pulse': status === 'checking',
        })}
      />
      {status === 'connected' && 'API Connected'}
      {status === 'offline'   && 'Offline'}
      {status === 'checking'  && 'Checking…'}
    </div>
  )
}
