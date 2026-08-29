import { cn } from '../../lib/cn'

export function FilterChips<T extends string>({
  opciones,
  valor,
  onChange,
  etiquetas,
}: {
  opciones: readonly T[]
  valor: T
  onChange: (v: T) => void
  etiquetas?: Partial<Record<T, string>>
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium capitalize',
            valor === o ? 'bg-primary text-white' : 'bg-surface border border-line text-muted',
          )}
        >
          {etiquetas?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}
