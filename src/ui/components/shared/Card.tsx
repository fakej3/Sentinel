import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  elevated?: boolean
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, elevated, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        elevated ? 'card-elevated' : 'card',
        hover && 'cursor-pointer hover:border-border-strong hover:shadow-card-hover transition-all duration-200',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

