import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-canvas text-ink',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-rose-50 text-rose-800',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', TONE[tone], className)}
      {...rest}
    >
      {children}
    </span>
  )
}

export function toneDeEstado(estado?: string | null): BadgeTone {
  const e = (estado ?? '').toLowerCase()
  if (['aprobada', 'confirmado', 'firmada', 'enviado', 'activa', 'al día', 'ganado'].includes(e)) return 'success'
  if (['pendiente', 'programada', 'borrador', 'contactado', 'calificado'].includes(e)) return 'warning'
  if (['rechazada', 'rechazado', 'mora', 'perdido', 'anulada', 'error'].includes(e)) return 'danger'
  if (['completada', 'nuevo'].includes(e)) return 'primary'
  return 'neutral'
}
