import { claimsDeUsuario } from './claims'
import { DEMO_MODE, supabase } from './supabase'
import type { CalendarEvent } from '../features/calendar/types'
import type { PersonaItem } from '../features/calendar/personasData'
import type { GeoDefaults } from './catalogos'
import { filaDePersona, mensajeGc } from './persistirHelpers'

export { errorAltaPersona, filaDePersona, mensajeGc } from './persistirHelpers'

export async function contextoOperacion(): Promise<{ usuarioId: string; tenantId: string }> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user) throw new Error('GC-AUTH-001: sin sesión')
  let session = data.session
  let tenantId = claimsDeUsuario(session.user, session.access_token).tenantId
  if (!tenantId) {
    const refreshed = await supabase.auth.refreshSession()
    if (refreshed.data.session) {
      session = refreshed.data.session
      tenantId = claimsDeUsuario(session.user, session.access_token).tenantId
    }
  }
  if (!tenantId) {
    const { data: tid } = await supabase.rpc('tenant_id_actual')
    tenantId = tid != null ? String(tid) : undefined
  }
  if (!tenantId) throw new Error('GC-AUTH-001: sin tenant en la sesión')
  return { usuarioId: session.user.id, tenantId }
}

export async function persistirPersona(persona: PersonaItem): Promise<PersonaItem> {
  if (DEMO_MODE) return persona
  const ctx = await contextoOperacion()
  const { data, error } = await supabase
    .from('persona')
    .insert(filaDePersona(persona, ctx))
    .select('id')
    .single()
  if (error) throw new Error(mensajeGc(error))
  return { ...persona, id: String(data.id) }
}

export async function persistirVisita(evento: CalendarEvent, geo: GeoDefaults): Promise<CalendarEvent> {
  if (DEMO_MODE) return evento
  if (!evento.actividadId || !evento.subActividadId) {
    throw new Error('GC-VIS-001: actividad y subactividad requeridas')
  }
  if (!geo.departamentoId || !geo.municipioId || !geo.zonaId) {
    throw new Error('GC-VIS-002: faltan zona o geografía del tenant')
  }
  const horaId = evento.actividadHoraId ?? geo.horaDefaultId
  if (!horaId) throw new Error('GC-VIS-003: catálogo de horas vacío')

  const { usuarioId, tenantId } = await contextoOperacion()
  const personaId = evento.personaId && /^\d+$/.test(evento.personaId) ? Number(evento.personaId) : null
  const { data, error } = await supabase
    .from('visita')
    .insert({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      creado_por: usuarioId,
      persona_id: personaId,
      persona_nombre: evento.personaName ?? '—',
      direccion: evento.location ?? null,
      comentario: evento.notes?.trim() || evento.title,
      departamento_id: geo.departamentoId,
      municipio_id: geo.municipioId,
      zona_id: geo.zonaId,
      actividad_id: evento.actividadId,
      sub_actividad_id: evento.subActividadId,
      actividad_hora_id: horaId,
      fecha_visita: evento.date,
      hora_inicio: evento.startTime.length === 5 ? `${evento.startTime}:00` : evento.startTime,
    })
    .select('id')
    .single()
  if (error) throw new Error(mensajeGc(error))
  return { ...evento, id: `vis-${data.id}` }
}

export interface FormularioEnviado {
  id: string
  resultado: number | null
  enviadoEn: string
}

export async function persistirFormulario(args: {
  plantillaId: string
  respuestas: Record<string, unknown>
  visitaId?: number
  clienteKey?: string
}): Promise<FormularioEnviado> {
  if (DEMO_MODE) {
    return {
      id: `demo-${Date.now()}`,
      resultado: null,
      enviadoEn: new Date().toISOString(),
    }
  }
  const { data, error } = await supabase.rpc('formulario_enviar', {
    p_plantilla_id: Number(args.plantillaId),
    p_respuestas: args.respuestas,
    p_visita_id: args.visitaId ?? null,
    p_cliente_key: args.clienteKey ?? crypto.randomUUID(),
  })
  if (error) throw error
  const row = data as { id?: number | string; resultado?: number | null; enviado_en?: string } | null
  return {
    id: String(row?.id ?? Date.now()),
    resultado: row?.resultado ?? null,
    enviadoEn: row?.enviado_en ?? new Date().toISOString(),
  }
}
