import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONE: Record<AlertTone, string> = {
  info: 'border-line bg-surface text-ink',
  success: 'border-ok/40 bg-surface text-ok',
  warning: 'border-warn/40 bg-surface text-warn',
  danger: 'border-danger/40 bg-surface text-danger',
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
