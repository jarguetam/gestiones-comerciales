export type EstadoVisita = 'programada' | 'completada' | 'aprobada' | 'rechazada' | 'anulada'

export type PasoTimeline = {
  clave: string
  etiqueta: string
  fase: 'hecho' | 'actual' | 'pendiente'
}

/** Línea de tiempo de W-03: programada → completada → cierre (aprobada/rechazada). Anulada corta el flujo. */
export function lineaTiempoVisita(estado?: string | null): PasoTimeline[] {
  const actual = (estado ?? 'programada') as EstadoVisita
  if (actual === 'anulada') {
    return [
      { clave: 'programada', etiqueta: 'Programada', fase: 'hecho' },
      { clave: 'anulada', etiqueta: 'Anulada', fase: 'actual' },
    ]
  }
  const cierre = actual === 'rechazada' ? 'Rechazada' : 'Aprobada'
  const pasos = [
    { clave: 'programada', etiqueta: 'Programada' },
    { clave: 'completada', etiqueta: 'Completada' },
    { clave: 'cierre', etiqueta: cierre },
  ]
  const idx = actual === 'programada' ? 0 : actual === 'completada' ? 1 : 2
  return pasos.map((p, i) => ({
    ...p,
    fase: i < idx ? 'hecho' : i === idx ? 'actual' : 'pendiente',
  }))
}
