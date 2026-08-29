import { formatearFechaJornada } from '../../lib/jornada'

/** Header de jornada: fecha grande + % del día en una línea. */
export function JornadaHeader({
  fecha,
  pct,
  hechas,
  total,
}: {
  fecha: string
  pct: number
  hechas: number
  total: number
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5" data-jornada="header">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-3xl tracking-tight text-ink md:text-4xl">{formatearFechaJornada(fecha)}</h3>
        <p className="text-sm font-semibold text-ink">
          {pct}% <span className="font-medium text-muted">completado</span>
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width] duration-campo" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {hechas} de {total} visitas de la jornada
      </p>
    </div>
  )
}
