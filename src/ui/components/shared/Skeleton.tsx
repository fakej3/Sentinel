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

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <Skeleton rounded className="h-8 w-8 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function SkeletonPriceHeader() {
  return (
    <div className="px-6 py-4 border-b border-border-subtle space-y-3">
      <div className="flex items-center gap-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex items-end gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
      </div>
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
