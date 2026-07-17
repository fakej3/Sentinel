import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  rounded?: boolean
}

export function Skeleton({ className, rounded }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'bg-surface-600 animate-skeleton',
        rounded ? 'rounded-full' : 'rounded-md',
        className,
      )}
    />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('card p-4 space-y-3', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="p-4 space-y-4 animate-in">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
