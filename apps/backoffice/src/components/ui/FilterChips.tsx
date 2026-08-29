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
    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 md:flex-wrap" role="group">
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium capitalize transition-colors duration-campo',
            valor === o ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-muted',
          )}
        >
          {etiquetas?.[o] ?? o}
        </button>
      ))}
    </div>
  )
}
