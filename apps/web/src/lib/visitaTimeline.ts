export type EstadoVisita = 'programada' | 'completada' | 'aprobada' | 'rechazada' | 'anulada'

export type PasoTimeline = {
  clave: string
  etiqueta: string
  fase: 'hecho' | 'actual' | 'pendiente'
  /** Solo si hay un timestamp real en la fila; nunca se inventa. */
  cuando?: string | null
  /** Dato auxiliar (GPS) sin atribuirle hora. */
  detalle?: string | null
}

export interface MetaTimelineVisita {
  creadoEn?: string | null
  completadaEn?: string | null
  revisadaEn?: string | null
  latitud?: number | null
  longitud?: number | null
}

function gpsDetalle(meta?: MetaTimelineVisita): string | null {
  if (meta?.latitud == null || meta?.longitud == null) return null
  return `${Number(meta.latitud).toFixed(4)}, ${Number(meta.longitud).toFixed(4)}`
}

/** Línea de tiempo de W-03. Check-in solo aparece si hay lat/lng; sin timestamp de check-in en schema. */
export function lineaTiempoVisita(estado?: string | null, meta?: MetaTimelineVisita): PasoTimeline[] {
  const actual = (estado ?? 'programada') as EstadoVisita
  const gps = gpsDetalle(meta)

  if (actual === 'anulada') {
    return [
      { clave: 'programada', etiqueta: 'Programada', fase: 'hecho', cuando: meta?.creadoEn ?? null },
      { clave: 'anulada', etiqueta: 'Anulada', fase: 'actual', cuando: meta?.revisadaEn ?? null },
    ]
  }

  const pasos: PasoTimeline[] = [
    { clave: 'programada', etiqueta: 'Programada', fase: 'pendiente', cuando: meta?.creadoEn ?? null },
  ]
  if (gps) {
    pasos.push({
      clave: 'checkin',
      etiqueta: 'Check-in GPS',
      fase: 'pendiente',
      detalle: gps,
    })
  }
  pasos.push({ clave: 'completada', etiqueta: 'Completada', fase: 'pendiente', cuando: meta?.completadaEn ?? null })
  const cierre = actual === 'rechazada' ? 'Rechazada' : 'Aprobada'
  pasos.push({ clave: 'cierre', etiqueta: cierre, fase: 'pendiente', cuando: meta?.revisadaEn ?? null })

  const claveActual =
    actual === 'programada' ? 'programada' : actual === 'completada' ? 'completada' : 'cierre'
  const idx = pasos.findIndex((p) => p.clave === claveActual)
  return pasos.map((p, i) => ({
    ...p,
    fase: i < idx ? 'hecho' : i === idx ? 'actual' : 'pendiente',
  }))
}
