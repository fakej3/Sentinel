import { useCallback } from 'react'
import { useRef } from 'react'
import { useLocalStorage } from './useLocalStorage'

export const CHART_HEIGHT_MIN = 300
export const CHART_HEIGHT_MAX = 900
export const CHART_HEIGHT_DEFAULT = 560

export function clampSize(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function useResizablePanel(
  storageKey: string,
  defaultSize: number,
  min: number,
  max: number,
) {
  const [size, setSize] = useLocalStorage(storageKey, defaultSize)
  const containerRef = useRef<HTMLDivElement>(null)

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return
      const startY = e.clientY
      const startH = containerRef.current.getBoundingClientRect().height

      const onMove = (me: MouseEvent) => {
        if (!containerRef.current) return
        const next = clampSize(startH + (me.clientY - startY), min, max)
        containerRef.current.style.height = `${next}px`
      }

      const onUp = (ue: MouseEvent) => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setSize(clampSize(startH + (ue.clientY - startY), min, max))
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
      e.preventDefault()
    },
    [min, max, setSize],
  )

  return { size, containerRef, startDrag }
}
