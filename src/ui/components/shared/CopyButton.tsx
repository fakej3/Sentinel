import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  className?: string
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback silent fail
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={`btn-ghost p-1.5 ${className ?? ''}`}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied
        ? <Check size={13} className="text-emerald-400" />
        : <Copy size={13} className="text-slate-500" />
      }
    </button>
  )
}
