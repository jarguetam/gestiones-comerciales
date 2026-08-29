import { cn } from '../../lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-line/80', className)} />
}

export function TableSkeleton({ filas = 5, cols = 4 }: { filas?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="bg-[var(--gc-thead)] px-4 py-3">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="divide-y divide-line/70">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="grid gap-3 px-4 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((__, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function KpiSkeleton({ n = 4 }: { n?: number }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Cargando indicadores">
      {Array.from({ length: n }).map((_, i) => (
        <article key={i} className="rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
        </article>
      ))}
    </section>
  )
}
