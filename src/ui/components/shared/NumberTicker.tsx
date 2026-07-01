import { useEffect, useRef, useState } from 'react'

interface NumberTickerProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function NumberTicker({
  value,
  duration = 800,
  decimals = 2,
  prefix = '',
  suffix = '',
  className,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(value)
  const startRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = display
    startTimeRef.current = null

    function step(now: number) {
      if (!startTimeRef.current) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // cubic ease-out
      setDisplay(startRef.current + (value - startRef.current) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  const formatted = display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={className}>
      {prefix}{formatted}{suffix}
    </span>
  )
}
