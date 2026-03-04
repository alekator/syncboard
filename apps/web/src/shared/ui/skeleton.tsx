import type { HTMLAttributes } from 'react'

import { cn } from '@/shared/lib/cn'

type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-slate-800', className)} {...props} />
}
