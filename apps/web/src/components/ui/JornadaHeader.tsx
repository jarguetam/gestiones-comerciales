import { formatearFechaJornada } from '../../lib/jornada'

/** Header de jornada: fecha + % del día. Sin rail de acento. */
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
    <div className="rounded-lg border border-line bg-surface px-4 py-3" data-jornada="header">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">{formatearFechaJornada(fecha)}</h3>
        <p className="text-sm font-medium text-ink">
          {pct}% <span className="font-normal text-muted">completado</span>
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width] duration-campo" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {hechas} de {total} visitas de la jornada
      </p>
    </div>
  )
}
