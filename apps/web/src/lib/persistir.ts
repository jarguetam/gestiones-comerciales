import { claimsDeUsuario } from './claims'
import { DEMO_MODE, supabase } from './supabase'
import type { CalendarEvent } from '../features/calendar/types'
import type { PersonaItem } from '../features/calendar/personasData'
import type { GeoDefaults } from './catalogos'

export function mensajeGc(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
    return (err as { message: string }).message
  }
  return err instanceof Error ? err.message : 'No se pudo guardar'
}

export async function contextoOperacion(): Promise<{ usuarioId: string; tenantId: string }> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user) throw new Error('GC-AUTH-001: sin sesión')
  const tenantId = claimsDeUsuario(data.session.user, data.session.access_token).tenantId
  if (!tenantId) throw new Error('GC-AUTH-001: sin tenant en la sesión')
  return { usuarioId: data.session.user.id, tenantId }
}

export async function persistirPersona(persona: PersonaItem): Promise<PersonaItem> {
  if (DEMO_MODE) return persona
  const { usuarioId, tenantId } = await contextoOperacion()
  const documento = persona.documento && persona.documento !== 'Sin documento' ? persona.documento : null
  const { data, error } = await supabase
    .from('persona')
    .insert({
      tenant_id: tenantId,
      nombre: persona.nombre,
      documento,
      direccion: persona.direccion === '—' ? null : persona.direccion,
      categoria: persona.categoria,
      asesor_id: usuarioId,
      detalles: { telefono: persona.telefono },
    })
    .select('id')
    .single()
  if (error) throw error
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
  if (error) throw error
  return { ...evento, id: `vis-${data.id}` }
}
