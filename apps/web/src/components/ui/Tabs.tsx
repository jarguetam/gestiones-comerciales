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
              'rounded-full px-3 py-1 text-xs font-medium capitalize',
              selected ? 'bg-primary text-white' : 'bg-surface border border-line text-muted',
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
