/** Validación de alta de visita (mismas reglas que @gc/web persistirVisita). */

export interface BorradorVisita {
  personaNombre?: string | null
  personaId?: number | null
  actividadId?: number | null
  subActividadId?: number | null
  actividadHoraId?: number | null
  zonaId?: number | null
  departamentoId?: number | null
  municipioId?: number | null
  fecha?: string | null
  horaInicio?: string | null
  direccion?: string | null
  comentario?: string | null
}

export function validarVisitaNueva(b: BorradorVisita): string | null {
  if (!b.personaNombre || b.personaNombre.trim().length === 0) {
    return 'GC-VIS-004: nombre del visitado requerido'
  }
  if (!b.actividadId || !b.subActividadId) {
    return 'GC-VIS-001: actividad y subactividad requeridas'
  }
  if (!b.departamentoId || !b.municipioId || !b.zonaId) {
    return 'GC-VIS-002: faltan zona o geografía del tenant'
  }
  if (!b.actividadHoraId) {
    return 'GC-VIS-003: catálogo de horas vacío'
  }
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) {
    return 'GC-VIS-005: fecha requerida (AAAA-MM-DD)'
  }
  if (!b.horaInicio || !/^\d{2}:\d{2}/.test(b.horaInicio)) {
    return 'GC-VIS-006: hora de inicio requerida'
  }
  return null
}

export function fechaLocalHoy(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function horaParaRpc(hora: string): string {
  return hora.length === 5 ? `${hora}:00` : hora
}
