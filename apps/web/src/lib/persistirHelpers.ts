import type { PersonaItem } from '../features/calendar/personasData'

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
