import type { CalendarEvent } from '../features/calendar/types'
import { INITIAL_EVENTS } from '../features/calendar/eventsData'
import { INITIAL_PERSONAS, type PersonaItem } from '../features/calendar/personasData'
import { INITIAL_LEADS, type LeadItem } from '../features/calendar/leadsData'
import { DEMO_MODE, supabase } from './supabase'

export type FuenteDominio = 'demo' | 'supabase'

export interface DominioCargado {
  fuente: FuenteDominio
  tenantNombre: string
  personas: PersonaItem[]
  eventos: CalendarEvent[]
  leads: LeadItem[]
  aviso?: string
}

const CATEGORIAS: CalendarEvent['category'][] = ['amber', 'lavender', 'mint', 'rose', 'sky']

function telefonoDe(detalles: unknown): string {
  if (!detalles || typeof detalles !== 'object') return '—'
  const d = detalles as Record<string, unknown>
  const t = d.telefono ?? d.tel ?? d.celular
  return typeof t === 'string' && t.trim() ? t : '—'
}

export async function cargarDominio(): Promise<DominioCargado> {
  if (DEMO_MODE) {
    return {
      fuente: 'demo',
      tenantNombre: 'AgroMoney S.A.',
      personas: INITIAL_PERSONAS,
      eventos: INITIAL_EVENTS,
      leads: INITIAL_LEADS,
    }
  }

  try {
    const [tenantRes, personaRes, visitaRes, leadRes] = await Promise.all([
      supabase.from('tenant').select('nombre').limit(1).maybeSingle(),
      supabase
        .from('persona')
        .select('id, nombre, categoria, documento, direccion, detalles, activo')
        .eq('activo', true)
        .order('nombre')
        .limit(300),
      supabase
        .from('visita')
        .select(
          'id, persona_nombre, direccion, comentario, fecha_visita, hora_inicio, estado, actividad_id, sub_actividad_id'
        )
        .order('fecha_visita', { ascending: false })
        .limit(300),
      supabase
        .from('lead')
        .select(
          'id, nombre, telefono, documento, direccion, monto_estimado, persona_id, perdido_motivo, lead_estado(codigo), lead_origen(nombre)'
        )
        .order('creado_en', { ascending: false })
        .limit(300),
    ])

    const error = tenantRes.error || personaRes.error || visitaRes.error || leadRes.error
    const personasDb = (personaRes.data ?? []) as Array<{
      id: number | string
      nombre: string
      categoria: string | null
      documento: string | null
      direccion: string | null
      detalles: unknown
    }>
    const visitasDb = (visitaRes.data ?? []) as Array<{
      id: number | string
      persona_nombre: string
      direccion: string | null
      comentario: string | null
      fecha_visita: string
      hora_inicio: string | null
      estado: string | null
      actividad_id: number | null
      sub_actividad_id: number | null
    }>
    const leadsDb = (leadRes.data ?? []) as Array<{
      id: number | string
      nombre: string
      telefono: string
      documento: string | null
      direccion: string | null
      monto_estimado: number | null
      persona_id: number | null
      perdido_motivo: string | null
      lead_estado: { codigo?: string } | { codigo?: string }[] | null
      lead_origen: { nombre?: string } | { nombre?: string }[] | null
    }>

    if (error || (personasDb.length === 0 && visitasDb.length === 0 && leadsDb.length === 0)) {
      return {
        fuente: 'demo',
        tenantNombre: (tenantRes.data as { nombre?: string } | null)?.nombre ?? 'AgroMoney S.A.',
        personas: INITIAL_PERSONAS,
        eventos: INITIAL_EVENTS,
        leads: INITIAL_LEADS,
        aviso: error
          ? `Sin datos de tenant todavía (${error.message}). Mostrando cartera de demostración.`
          : 'El tenant no tiene visitas, personas ni leads. Mostrando cartera de demostración.',
      }
    }

    const personas: PersonaItem[] = personasDb.map((p) => ({
      id: String(p.id),
      nombre: p.nombre,
      categoria: p.categoria ?? 'Cliente',
      documento: p.documento ?? 'Sin documento',
      telefono: telefonoDe(p.detalles),
      direccion: p.direccion ?? '—',
      visitasPendientes: 0,
    }))

    const eventos: CalendarEvent[] = visitasDb.map((v, i) => {
      const hora = String(v.hora_inicio ?? '08:00').slice(0, 5)
      const [hh, mm] = hora.split(':').map(Number)
      const finH = String((hh + 1) % 24).padStart(2, '0')
      return {
        id: `vis-${v.id}`,
        title: v.comentario?.trim() || `Visita — ${v.persona_nombre}`,
        date: String(v.fecha_visita),
        startTime: hora,
        endTime: `${finH}:${String(mm).padStart(2, '0')}`,
        category: CATEGORIAS[i % CATEGORIAS.length],
        location: v.direccion ?? undefined,
        notes: v.comentario || undefined,
        personaName: v.persona_nombre,
        actividadId: v.actividad_id ?? undefined,
        subActividadId: v.sub_actividad_id ?? undefined,
        estado: (v.estado as CalendarEvent['estado']) ?? 'programada',
      }
    })

    const leads: LeadItem[] = leadsDb.map((l) => {
      const estado = Array.isArray(l.lead_estado) ? l.lead_estado[0] : l.lead_estado
      const origen = Array.isArray(l.lead_origen) ? l.lead_origen[0] : l.lead_origen
      return {
        id: String(l.id),
        nombre: l.nombre,
        telefono: l.telefono,
        documento: l.documento ?? undefined,
        direccion: l.direccion ?? undefined,
        origen: (origen as { nombre?: string } | null)?.nombre ?? 'Walk-in',
        montoEstimado: l.monto_estimado ?? undefined,
        estadoCodigo: (estado as { codigo?: string } | null)?.codigo ?? 'nuevo',
        perdidoMotivo: l.perdido_motivo ?? undefined,
        convertido: l.persona_id != null,
      }
    })

    return {
      fuente: 'supabase',
      tenantNombre: (tenantRes.data as { nombre?: string } | null)?.nombre ?? 'Gestiones Comerciales',
      personas: personas.length > 0 ? personas : INITIAL_PERSONAS,
      eventos: eventos.length > 0 ? eventos : INITIAL_EVENTS,
      leads: leads.length > 0 ? leads : INITIAL_LEADS,
    }
  } catch (err) {
    return {
      fuente: 'demo',
      tenantNombre: 'AgroMoney S.A.',
      personas: INITIAL_PERSONAS,
      eventos: INITIAL_EVENTS,
      leads: INITIAL_LEADS,
      aviso: err instanceof Error ? err.message : 'No se pudo cargar el dominio',
    }
  }
}
