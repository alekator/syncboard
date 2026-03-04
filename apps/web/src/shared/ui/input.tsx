import * as React from 'react'

import { cn } from '@/shared/lib/cn'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus-visible:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))

Input.displayName = 'Input'
