import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONE: Record<AlertTone, string> = {
  info: 'border-line bg-surface text-ink',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
}

export function Alert({
  tone = 'info',
  role = 'status',
  className,
  children,
}: {
  tone?: AlertTone
  role?: 'status' | 'alert'
  className?: string
  children: ReactNode
}) {
  return (
    <p role={role} className={cn('rounded-lg border px-3 py-2 text-sm', TONE[tone], className)}>
      {children}
    </p>
  )
}
