import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Tabs({
  tabs,
  valor,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  valor: string
  onChange: (id: string) => void
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const selected = valor === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`tab-${t.id}`}
            onClick={() => onChange(t.id)}
            className={cn(
              'min-h-11 rounded-full border px-4 text-sm font-medium capitalize transition-colors duration-campo',
              selected ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-muted',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, valor, children }: { id: string; valor: string; children: ReactNode }) {
  if (valor !== id) return null
  return (
    <div role="tabpanel" aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  )
}
