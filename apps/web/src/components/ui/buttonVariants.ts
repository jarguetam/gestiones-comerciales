import { cn } from '../../lib/cn.ts'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  danger: 'bg-rose-700 text-white hover:bg-rose-800',
  ghost: 'bg-transparent text-ink hover:bg-canvas',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'w-full px-5 py-2.5 text-sm',
}

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(BASE, VARIANT[variant], SIZE[size], className)
}
