import { logoUrlValido, monograma } from '../../lib/branding'
import { cn } from '../../lib/cn'

export function BrandMark({
  nombre,
  logoUrl,
  variant = 'light',
  compact = false,
}: {
  nombre: string
  logoUrl?: string
  variant?: 'light' | 'dark'
  compact?: boolean
}) {
  const src = logoUrlValido(logoUrl)
  const onDark = variant === 'dark'
  if (src) {
    return (
      <img
        src={src}
        alt={nombre}
        className={cn('object-contain', compact ? 'h-8 w-8' : 'h-9 max-w-[10rem]')}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-serif font-semibold',
        compact ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-base',
        onDark ? 'bg-white/10 text-[#F3EEE4]' : 'bg-primary text-white',
      )}
    >
      {monograma(nombre)}
    </span>
  )
}
