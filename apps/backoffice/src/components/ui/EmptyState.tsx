import type { ReactNode } from 'react'
import { EMPTY_STATE_ROOT } from './emptyStateModel'
import { Button } from './Button'

export function EmptyState({
  titulo,
  descripcion,
  cta,
}: {
  titulo: string
  descripcion?: string
  cta?: { etiqueta: string; onClick: () => void }
}) {
  return (
    <div className={EMPTY_STATE_ROOT}>
      <h3 className="font-serif text-xl text-ink">{titulo}</h3>
      {descripcion ? <p className="mt-2 text-sm text-muted">{descripcion}</p> : null}
      {cta ? (
        <div className="mt-4">
          <Button onClick={cta.onClick}>{cta.etiqueta}</Button>
        </div>
      ) : null}
    </div>
  )
}

export function EmptyStateInline({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-muted">{children}</div>
}
