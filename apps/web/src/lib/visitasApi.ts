import type { CalendarEvent } from '../features/calendar/types'
import { supabase } from './supabase'
import {
  PAGE_SIZE_VISITAS,
  type FiltrosVisita,
} from './visitasFiltro'

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function filaAEvento(v: Record<string, unknown>): CalendarEvent {
  const hora = String(v.hora_inicio ?? '08:00').slice(0, 5)
  const [hh, mm] = hora.split(':').map(Number)
  const finH = String((hh + 1) % 24).padStart(2, '0')
  const usuario = v.usuario as { nombre?: string } | { nombre?: string }[] | null
  const zona = v.zona as { nombre?: string; codigo?: string } | { nombre?: string; codigo?: string }[] | null
  const u = Array.isArray(usuario) ? usuario[0] : usuario
  const z = Array.isArray(zona) ? zona[0] : zona
  const lat = num(v.latitud)
  const lng = num(v.longitud)
  return {
    id: `vis-${v.id}`,
    title: String(v.comentario ?? '').trim() || `Visita — ${String(v.persona_nombre ?? '')}`,
    date: String(v.fecha_visita),
    startTime: hora,
    endTime: `${finH}:${String(mm ?? 0).padStart(2, '0')}`,
    category: 'lavender',
    location: (v.direccion as string | null) ?? undefined,
    notes: (v.comentario as string | null) || undefined,
    personaName: String(v.persona_nombre ?? ''),
    actividadId: num(v.actividad_id) ?? undefined,
    subActividadId: num(v.sub_actividad_id) ?? undefined,
    estado: (v.estado as CalendarEvent['estado']) ?? 'programada',
    asesorId: v.usuario_id != null ? String(v.usuario_id) : undefined,
    asesorNombre: u?.nombre,
    zonaId: num(v.zona_id) ?? undefined,
    zonaNombre: z?.nombre,
    latitud: lat,
    longitud: lng,
    completadaEn: (v.completada_en as string | null) ?? null,
    revisadaEn: (v.revisada_en as string | null) ?? null,
    creadoEn: (v.creado_en as string | null) ?? null,
    checkinGps: lat != null && lng != null ? { lat, lng, timestamp: '' } : undefined,
  }
}

export async function fetchVisitasPaginadas(
  f: FiltrosVisita,
  pageSize = PAGE_SIZE_VISITAS,
): Promise<{ items: CalendarEvent[]; total: number }> {
  const from = (f.pagina - 1) * pageSize
  const to = from + pageSize - 1
  let q = supabase
    .from('visita')
    .select(
      'id, persona_nombre, direccion, comentario, fecha_visita, hora_inicio, estado, actividad_id, sub_actividad_id, usuario_id, zona_id, latitud, longitud, completada_en, revisada_en, creado_en, usuario:usuario_id(nombre), zona:zona_id(nombre, codigo)',
      { count: 'exact' },
    )
    .order('fecha_visita', { ascending: false })
    .order('hora_inicio', { ascending: false })
    .range(from, to)
  if (f.estado !== 'todas') q = q.eq('estado', f.estado)
  if (f.asesor) q = q.eq('usuario_id', f.asesor)
  if (f.zona) q = q.eq('zona_id', Number(f.zona))
  if (f.desde) q = q.gte('fecha_visita', f.desde)
  if (f.hasta) q = q.lte('fecha_visita', f.hasta)
  const { data, error, count } = await q
  if (error) throw error
  return {
    items: ((data ?? []) as Record<string, unknown>[]).map(filaAEvento),
    total: count ?? 0,
  }
}
