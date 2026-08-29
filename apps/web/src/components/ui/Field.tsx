import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const FIELD =
  'mt-1 block w-full min-h-11 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted transition-colors duration-campo focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50'

interface CampoProps {
  id: string
  label: string
  hint?: string
}

export function Input({
  id,
  label,
  hint,
  className,
  ...rest
}: CampoProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input id={id} className={cn(FIELD, className)} {...rest} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function Select({
  id,
  label,
  hint,
  className,
  children,
  ...rest
}: CampoProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select id={id} className={cn(FIELD, className)} {...rest}>
        {children}
      </select>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function Textarea({
  id,
  label,
  hint,
  className,
  ...rest
}: CampoProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea id={id} className={cn(FIELD, className)} {...rest} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export const fieldClass = FIELD
