interface ResizeDividerProps {
  onMouseDown: (e: React.MouseEvent) => void
}

export function ResizeDivider({ onMouseDown }: ResizeDividerProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize chart panel"
      onMouseDown={onMouseDown}
      className="flex-shrink-0 h-1.5 cursor-ns-resize group relative flex items-center justify-center
                 border-y border-border-subtle hover:border-blue-500/30 transition-colors duration-150 select-none"
    >
      <div className="w-8 h-0.5 rounded-full bg-border-strong group-hover:bg-blue-500/40 transition-colors duration-150" />
    </div>
  )
}
