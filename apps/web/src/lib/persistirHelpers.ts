import type { PersonaItem } from '../features/calendar/personasData'
import type { CalendarEvent } from '../features/calendar/types'

export interface ContextoPersona {
  usuarioId: string
  tenantId: string
}

export interface FilaPersona {
  tenant_id: string
  nombre: string
  documento: string | null
  direccion: string | null
  categoria: string
  asesor_id: string
  detalles: { telefono?: string }
}

function textoDe(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined
}

function codigoDe(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('code' in err)) return undefined
  return textoDe((err as { code: unknown }).code)
}

function mensajeCrudo(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'message' in err) {
    return textoDe((err as { message: unknown }).message)
  }
  return err instanceof Error ? err.message : undefined
}

/** Mensaje de negocio a partir de Error o del objeto PostgREST (code/message/details). */
export function mensajeGc(err: unknown): string {
  const message = mensajeCrudo(err) ?? ''
  const code = codigoDe(err)
  if (code === '42501' || /row-level security/i.test(message)) {
    return `GC-PER-001: no hay permiso para registrar el cliente (${message || 'RLS'})`
  }
  if (code === '23505' || /duplicate key|unique constraint/i.test(message)) {
    return 'GC-PER-030: ya existe un cliente con ese documento en la empresa'
  }
  if (code === '23503') {
    return `GC-PER-002: no se pudo vincular el cliente a tu usuario (${message || 'FK'})`
  }
  if (message) return message
  return 'No se pudo guardar'
}

/** Texto del alta inline. No usa instanceof Error: PostgREST tira un objeto plano. */
export function errorAltaPersona(err: unknown): string {
  const msg = mensajeGc(err)
  return msg === 'No se pudo guardar' ? 'No se pudo registrar el cliente' : msg
}

/** Fila de `persona` para PostgREST. Teléfono vive en detalles (spec §8). */
export function filaDePersona(persona: PersonaItem, ctx: ContextoPersona): FilaPersona {
  const documento = persona.documento && persona.documento !== 'Sin documento' ? persona.documento : null
  const telefono = persona.telefono.trim() && persona.telefono !== '—' ? persona.telefono.trim() : null
  return {
    tenant_id: ctx.tenantId,
    nombre: persona.nombre,
    documento,
    direccion: persona.direccion === '—' ? null : persona.direccion,
    categoria: persona.categoria,
    asesor_id: ctx.usuarioId,
    detalles: telefono ? { telefono } : {},
  }
}

/** Argumentos de la RPC `visita_crear`: oficina y geografía las resuelve el servidor. */
export function argsVisitaCrear(
  evento: CalendarEvent,
  horaDefaultId: number | null,
  clienteKey: string,
): Record<string, unknown> {
  if (!evento.actividadId || !evento.subActividadId) {
    throw new Error('GC-VIS-001: actividad y subactividad requeridas')
  }
  const horaId = evento.actividadHoraId ?? horaDefaultId
  if (!horaId) throw new Error('GC-VIS-003: catálogo de horas vacío')
  const personaId = evento.personaId && /^\d+$/.test(evento.personaId) ? Number(evento.personaId) : null
  return {
    p_persona_nombre: evento.personaName ?? '—',
    p_actividad_id: evento.actividadId,
    p_sub_actividad_id: evento.subActividadId,
    p_actividad_hora_id: horaId,
    p_zona_id: null,
    p_departamento_id: null,
    p_municipio_id: null,
    p_fecha: evento.date,
    p_hora_inicio: evento.startTime.length === 5 ? `${evento.startTime}:00` : evento.startTime,
    p_persona_id: personaId,
    p_direccion: evento.location ?? null,
    p_comentario: evento.notes?.trim() || evento.title,
    p_cliente_key: clienteKey,
  }
}
