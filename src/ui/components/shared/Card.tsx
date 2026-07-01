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

interface CardHeaderProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function CardHeader({ icon, title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon && (
          <div className="text-slate-500 flex-shrink-0">{icon}</div>
        )}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  sub?: string
  colorClass?: string
  className?: string
}

export function StatCard({ icon, label, value, sub, colorClass = 'text-slate-200', className }: StatCardProps) {
  return (
    <Card className={clsx('p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-500 flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="section-label mb-1.5">{label}</p>
          <p className={clsx('text-lg font-semibold leading-tight mono-val', colorClass)}>
            {value}
          </p>
          {sub && (
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">{sub}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
