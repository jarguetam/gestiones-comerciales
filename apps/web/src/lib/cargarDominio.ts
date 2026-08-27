import type { CalendarEvent } from '../features/calendar/types'
import { CATALOGO_ACTIVIDADES, CATALOGO_HORAS, INITIAL_EVENTS } from '../features/calendar/eventsData'
import { INITIAL_PERSONAS, type PersonaItem } from '../features/calendar/personasData'
import { INITIAL_LEADS, type LeadItem } from '../features/calendar/leadsData'
import { DEMO_MODE, supabase } from './supabase'
import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from './catalogos'

export type FuenteDominio = 'demo' | 'supabase'

export interface DominioCargado {
  fuente: FuenteDominio
  tenantNombre: string
  personas: PersonaItem[]
  eventos: CalendarEvent[]
  leads: LeadItem[]
  modulos: string[]
  catalogos: CatalogoActividad[]
  horas: CatalogoHora[]
  zonas: ZonaCatalogo[]
  geo: GeoDefaults
  aviso?: string
}

const GEO_VACIO: GeoDefaults = { zonaId: null, departamentoId: null, municipioId: null, horaDefaultId: null }

const ZONAS_DEMO: ZonaCatalogo[] = [{ id: 1, codigo: 'Z1', nombre: 'Zona Centro', activo: true }]

const MODULOS_DEMO = ['crm', 'creditos', 'solicitudes', 'depositos', 'kilometraje']

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
      modulos: MODULOS_DEMO,
      catalogos: CATALOGO_ACTIVIDADES,
      horas: CATALOGO_HORAS,
      zonas: ZONAS_DEMO,
      geo: { zonaId: 1, departamentoId: 1, municipioId: 1, horaDefaultId: 2 },
    }
  }

  try {
    const [userRes, tenantRes, personaRes, visitaRes, leadRes, moduloRes, actRes, subRes, horaRes, zonaRes, deptoRes, muniRes] =
      await Promise.all([
      supabase.auth.getUser(),
      supabase.from('tenant').select('id, nombre').limit(50),
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
      supabase.from('tenant_modulo').select('activo, modulo(codigo)').eq('activo', true),
      supabase.from('actividad').select('id, nombre, activo').eq('activo', true).order('nombre'),
      supabase.from('sub_actividad').select('id, actividad_id, nombre, activo').eq('activo', true).order('nombre'),
      supabase.from('actividad_hora').select('id, nombre, cantidad, activo').eq('activo', true).order('cantidad'),
      supabase.from('zona').select('id, codigo, nombre, activo').eq('activo', true).order('nombre'),
      supabase.from('departamento').select('id').limit(1).maybeSingle(),
      supabase.from('municipio').select('id').limit(1).maybeSingle(),
    ])

    const jwtTenant = userRes.data.user?.app_metadata?.tenant_id as string | undefined
    const tenants = (tenantRes.data ?? []) as Array<{ id: string; nombre: string }>
    const tenantRow =
      tenants.find((t) => t.id === jwtTenant) ?? tenants[0] ?? null
    const tenantNombre = tenantRow?.nombre ?? 'Gestiones Comerciales'
    const subsDb = (subRes.data ?? []) as Array<{ id: number; actividad_id: number; nombre: string; activo: boolean }>
    const catalogos: CatalogoActividad[] = ((actRes.data ?? []) as Array<{ id: number; nombre: string; activo: boolean }>).map(
      (a) => ({
        ...a,
        sub_actividades: subsDb.filter((s) => s.actividad_id === a.id),
      }),
    )
    const horas: CatalogoHora[] = (horaRes.data ?? []) as CatalogoHora[]
    const zonas: ZonaCatalogo[] = (zonaRes.data ?? []) as ZonaCatalogo[]
    const geo: GeoDefaults = {
      zonaId: zonas[0]?.id ?? null,
      departamentoId: (deptoRes.data as { id?: number } | null)?.id ?? null,
      municipioId: (muniRes.data as { id?: number } | null)?.id ?? null,
      horaDefaultId: horas[0]?.id ?? null,
    }

    const error = tenantRes.error || personaRes.error || visitaRes.error || leadRes.error
    const modulos = ((moduloRes.data ?? []) as Array<{
      activo: boolean
      modulo: { codigo?: string } | { codigo?: string }[] | null
    }>)
      .map((row) => {
        const m = Array.isArray(row.modulo) ? row.modulo[0] : row.modulo
        return m?.codigo
      })
      .filter((c): c is string => !!c)
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

    if (error) {
      return {
        fuente: 'demo',
        tenantNombre,
        personas: INITIAL_PERSONAS,
        eventos: INITIAL_EVENTS,
        leads: INITIAL_LEADS,
        modulos: modulos.length > 0 ? modulos : MODULOS_DEMO,
        catalogos: catalogos.length > 0 ? catalogos : CATALOGO_ACTIVIDADES,
        horas: horas.length > 0 ? horas : CATALOGO_HORAS,
        zonas: zonas.length > 0 ? zonas : ZONAS_DEMO,
        geo,
        aviso: `No se pudo leer el tenant (${error.message}). Mostrando cartera de demostración.`,
      }
    }

    const vacio = personasDb.length === 0 && visitasDb.length === 0 && leadsDb.length === 0

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
      tenantNombre,
      personas,
      eventos,
      leads,
      modulos,
      catalogos,
      horas,
      zonas,
      geo,
      aviso: vacio
        ? 'Esta empresa aún no tiene clientes, visitas ni leads. Creá el primero desde Personas, Visitas o CRM.'
        : undefined,
    }
  } catch (err) {
    return {
      fuente: 'demo',
      tenantNombre: 'AgroMoney S.A.',
      personas: INITIAL_PERSONAS,
      eventos: INITIAL_EVENTS,
      leads: INITIAL_LEADS,
      modulos: MODULOS_DEMO,
      catalogos: CATALOGO_ACTIVIDADES,
      horas: CATALOGO_HORAS,
      zonas: ZONAS_DEMO,
      geo: GEO_VACIO,
      aviso: err instanceof Error ? err.message : 'No se pudo cargar el dominio',
    }
  }
}
