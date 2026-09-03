import type { CalendarEvent } from '../features/calendar/types'
import type { PersonaItem } from '../features/calendar/personasData'
import type { LeadItem } from '../features/calendar/leadsData'
import { claimsDeUsuario } from './claims'
import { supabase } from './supabase'
import type { CatalogoActividad, CatalogoHora, GeoDefaults, ZonaCatalogo } from './catalogos'
import { brandingDeJson, nombreComercial, type BrandingTenant } from './branding'

export type FuenteDominio = 'demo' | 'supabase'

export interface AsesorOpcion {
  id: string
  nombre: string
}

export interface DominioCargado {
  fuente: FuenteDominio
  tenantNombre: string
  tenantCodigo?: string
  branding: BrandingTenant
  configuracion: Record<string, unknown>
  personas: PersonaItem[]
  eventos: CalendarEvent[]
  leads: LeadItem[]
  asesores: AsesorOpcion[]
  modulos: string[]
  catalogos: CatalogoActividad[]
  horas: CatalogoHora[]
  zonas: ZonaCatalogo[]
  geo: GeoDefaults
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
  try {
    const [sessionRes, tenantRes, personaRes, visitaRes, leadRes, moduloRes, actRes, subRes, horaRes, zonaRes, deptoRes, muniRes, usuarioRes] =
      await Promise.all([
      supabase.auth.getSession(),
      supabase.from('tenant').select('id, nombre, codigo, branding, configuracion').limit(50),
      supabase
        .from('persona')
        .select('id, nombre, categoria, documento, direccion, detalles, activo')
        .eq('activo', true)
        .order('nombre')
        .limit(300),
      supabase
        .from('visita')
        .select(
          'id, persona_nombre, direccion, comentario, fecha_visita, hora_inicio, estado, actividad_id, sub_actividad_id, usuario_id, zona_id, latitud, longitud, completada_en, revisada_en, creado_en, usuario:usuario_id(nombre), zona:zona_id(nombre, codigo)'
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
      supabase.from('usuario').select('id, nombre, rol').eq('activo', true).order('nombre'),
    ])

    let sesion = sessionRes.data.session
    let jwtTenant = claimsDeUsuario(sesion?.user, sesion?.access_token).tenantId
    if (sesion && !jwtTenant) {
      const refreshed = await supabase.auth.refreshSession()
      if (refreshed.data.session) {
        sesion = refreshed.data.session
        jwtTenant = claimsDeUsuario(sesion.user, sesion.access_token).tenantId
      }
    }
    if (!jwtTenant) {
      const { data: tid } = await supabase.rpc('tenant_id_actual')
      jwtTenant = tid != null ? String(tid) : undefined
    }
    const tenants = (tenantRes.data ?? []) as Array<{
      id: string
      nombre: string
      codigo?: string
      branding?: unknown
      configuracion?: unknown
    }>
    const tenantRow =
      tenants.find((t) => t.id === jwtTenant) ?? tenants[0] ?? null
    const branding = brandingDeJson(tenantRow?.branding)
    const tenantNombre = nombreComercial(branding, tenantRow?.nombre ?? 'Gestiones Comerciales')
    const tenantCodigo = tenantRow?.codigo
    const configuracion =
      tenantRow?.configuracion && typeof tenantRow.configuracion === 'object' && !Array.isArray(tenantRow.configuracion)
        ? (tenantRow.configuracion as Record<string, unknown>)
        : {}
    const asesores: AsesorOpcion[] = ((usuarioRes.data ?? []) as Array<{ id: string; nombre: string }>).map((u) => ({
      id: u.id,
      nombre: u.nombre,
    }))
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
      usuario_id?: string | null
      zona_id?: number | null
      latitud?: number | null
      longitud?: number | null
      completada_en?: string | null
      revisada_en?: string | null
      creado_en?: string | null
      usuario?: { nombre?: string } | { nombre?: string }[] | null
      zona?: { nombre?: string } | { nombre?: string }[] | null
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
      throw new Error('GC-CORE-001')
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
      const u = Array.isArray(v.usuario) ? v.usuario[0] : v.usuario
      const z = Array.isArray(v.zona) ? v.zona[0] : v.zona
      const lat = v.latitud != null ? Number(v.latitud) : null
      const lng = v.longitud != null ? Number(v.longitud) : null
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
        asesorId: v.usuario_id ?? undefined,
        asesorNombre: u?.nombre,
        zonaId: v.zona_id ?? undefined,
        zonaNombre: z?.nombre,
        latitud: lat,
        longitud: lng,
        completadaEn: v.completada_en ?? null,
        revisadaEn: v.revisada_en ?? null,
        creadoEn: v.creado_en ?? null,
        checkinGps: lat != null && lng != null ? { lat, lng, timestamp: '' } : undefined,
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
      tenantCodigo,
      branding,
      configuracion,
      personas,
      eventos,
      leads,
      asesores,
      modulos,
      catalogos,
      horas,
      zonas,
      geo,
      aviso: vacio
        ? 'Esta empresa aún no tiene clientes, visitas ni leads. Creá el primero desde Personas, Visitas o CRM.'
        : undefined,
    }
  } catch {
    throw new Error('GC-CORE-001')
  }
}
