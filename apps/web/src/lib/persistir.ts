import { claimsDeUsuario } from './claims'
import { canMutate } from './online.ts'
import { supabase } from './supabase'

function exigirOnline() {
  if (typeof navigator !== 'undefined' && !canMutate(navigator.onLine)) {
    throw new Error('GC-CORE-001')
  }
}
import type { CalendarEvent } from '../features/calendar/types'
import type { PersonaItem } from '../features/calendar/personasData'
import type { GeoDefaults } from './catalogos'
import { argsVisitaCrear, filaDePersona, mensajeGc } from './persistirHelpers'

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
  exigirOnline()
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
  exigirOnline()
  const args = argsVisitaCrear(evento, geo.horaDefaultId, crypto.randomUUID())
  const { data, error } = await supabase.rpc('visita_crear', args)
  if (error) throw new Error(mensajeGc(error))
  const row = data as { id: number | string }
  return { ...evento, id: `vis-${row.id}` }
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
