/**
 * Textos de "copia guardada en el teléfono". Hora local con dígitos fijos (no depende del
 * locale del motor JS). Mismo día: "a las HH:mm"; otro día: "el DD/MM a las HH:mm", para que
 * la agenda de anoche no parezca de hoy. Sin fecha válida no se agrega nada.
 */

const dos = (n: number) => String(n).padStart(2, '0')

export function cuandoGuardado(iso: string | null | undefined, ahora: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hora = `a las ${dos(d.getHours())}:${dos(d.getMinutes())}`
  const mismoDia =
    d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth() && d.getDate() === ahora.getDate()
  return mismoDia ? hora : `el ${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${hora}`
}

/** Agenda mostrada desde la copia: mientras se refresca, sin señal, o tras un error del servidor. */
export type EstadoAgendaGuardada = 'actualizando' | 'sin_conexion' | 'error'

export function avisoAgendaGuardada(
  estado: EstadoAgendaGuardada,
  guardadoEn: string | null | undefined,
  ahora: Date = new Date(),
): string {
  const cuando = cuandoGuardado(guardadoEn, ahora)
  const agenda = cuando ? `agenda guardada ${cuando}` : 'agenda guardada'
  if (estado === 'sin_conexion') return `Sin conexión · ${agenda}`
  const titulo = `A${agenda.slice(1)}`
  return estado === 'actualizando' ? `${titulo} · actualizando…` : titulo
}

export function avisoCatalogosGuardados(guardadoEn: string | null | undefined, ahora: Date = new Date()): string {
  const cuando = cuandoGuardado(guardadoEn, ahora)
  return cuando ? `Catálogos guardados ${cuando}` : 'Catálogos guardados en el teléfono'
}

export function avisoCarteraGuardada(guardadoEn: string | null | undefined, ahora: Date = new Date()): string {
  const cuando = cuandoGuardado(guardadoEn, ahora)
  return `Sin conexión · clientes guardados ${cuando || 'en el teléfono'}`
}
