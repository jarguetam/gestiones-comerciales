import type { SupabaseClient } from '@supabase/supabase-js'
import type { ItemCola } from './cola.ts'
import { leerPaginado } from './paginar.ts'
import { exigirSesion } from './sesionVigente.ts'
import type { Visita } from './tipos.ts'

/**
 * Agenda local = última lista del servidor (o caché) + cola de mutaciones.
 * Reconcilia por `cliente_key`. Lógica pura: sin red, sin reloj.
 */

export function mapFilaVisita(row: Record<string, unknown>): Visita {
  const act = row.actividad
  let actividad: string | null = null
  if (typeof act === 'string') actividad = act
  else if (act && typeof act === 'object' && 'nombre' in act) {
    actividad = String((act as { nombre: unknown }).nombre)
  }
  return {
    id: Number(row.id),
    cliente_key: String(row.cliente_key ?? ''),
    persona_nombre: String(row.persona_nombre ?? '—'),
    direccion: (row.direccion as string | null) ?? null,
    fecha_visita: String(row.fecha_visita ?? ''),
    hora_inicio: (row.hora_inicio as string | null) ?? null,
    estado: (row.estado as Visita['estado']) ?? 'programada',
    actividad,
    latitud: row.latitud != null ? Number(row.latitud) : null,
    longitud: row.longitud != null ? Number(row.longitud) : null,
  }
}

/** Rango inclusivo [desde, desde + dias - 1] en YYYY-MM-DD, calculado en UTC. */
export function rangoAgenda(desde: string, dias: number): { desde: string; hasta: string } {
  const [a, m, d] = desde.split('-').map(Number)
  const fin = new Date(Date.UTC(a, m - 1, d + Math.max(1, dias) - 1))
  const hasta = [
    String(fin.getUTCFullYear()).padStart(4, '0'),
    String(fin.getUTCMonth() + 1).padStart(2, '0'),
    String(fin.getUTCDate()).padStart(2, '0'),
  ].join('-')
  return { desde, hasta }
}

/**
 * Sin filtrar por usuario: la RLS da el alcance (propio, o equipo si es supervisor).
 * Por páginas y en orden de fecha: un equipo grande no debe perder las visitas de hoy
 * por el tope `max_rows` de PostgREST. Sin sesión vigente no consulta (GC-NET-004):
 * con la anon key la RLS devolvería una lista vacía que pisaría la copia guardada.
 */
export async function descargarAgenda(cliente: SupabaseClient, desde: string, dias = 7): Promise<Visita[]> {
  await exigirSesion(cliente)
  const rango = rangoAgenda(desde, dias)
  const filas = await leerPaginado(async (inicio, fin) => {
    const res = await cliente
      .from('visita')
      .select('id, cliente_key, persona_nombre, direccion, fecha_visita, hora_inicio, estado, latitud, longitud, actividad(nombre)')
      .gte('fecha_visita', rango.desde)
      .lte('fecha_visita', rango.hasta)
      .order('fecha_visita')
      .order('hora_inicio')
      .order('id')
      .range(inicio, fin)
    if (res.error) throw res.error
    return (res.data ?? []) as Array<Record<string, unknown>>
  })
  return filas.map(mapFilaVisita)
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function agendaConCola(base: Visita[], cola: ItemCola[], fecha: string): Visita[] {
  const filas = new Map<string, Visita>()
  for (const v of base) {
    if (v.fecha_visita === fecha) filas.set(v.cliente_key, { ...v })
  }
  const baseCompleta = new Set(base.map((v) => v.cliente_key))

  // 1) Visitas creadas en el dispositivo que la base aún no trae.
  for (const it of cola) {
    if (it.tipo !== 'visita') continue
    const p = it.payload
    const key = texto(p.clienteKey)
    if (!key || baseCompleta.has(key) || filas.has(key)) continue
    if (texto(p.fecha) !== fecha) continue
    filas.set(key, {
      id: null,
      cliente_key: key,
      persona_nombre: texto(p.personaNombre) ?? '—',
      direccion: texto(p.direccion),
      fecha_visita: fecha,
      hora_inicio: texto(p.horaInicio),
      estado: 'programada',
      actividad: null,
      latitud: null,
      longitud: null,
      pendiente: it.estado !== 'enviado',
      ...(it.estado === 'error' && it.ultimoError ? { errorEnvio: it.ultimoError } : {}),
    })
  }

  // 2) Check-in / cierre sobre la fila (de base o creada arriba).
  for (const it of cola) {
    if (it.tipo !== 'visita_checkin' && it.tipo !== 'visita_completar') continue
    const key = texto(it.payload.visitaClienteKey)
    const fila = key ? filas.get(key) : undefined
    if (!fila) continue
    const pendiente = it.estado !== 'enviado'
    let aplica = false
    if (it.tipo === 'visita_completar') {
      if (fila.estado === 'programada') {
        fila.estado = 'completada'
        aplica = true
      }
    } else {
      const lat = numero(it.payload.latitud)
      const lng = numero(it.payload.longitud)
      if ((fila.latitud == null || fila.longitud == null) && lat != null && lng != null) {
        fila.latitud = lat
        fila.longitud = lng
        aplica = true
      }
    }
    if (aplica && pendiente) fila.pendiente = true
    if (it.estado === 'error' && it.ultimoError) fila.errorEnvio = it.ultimoError
  }

  return [...filas.values()].sort((a, b) => {
    if (a.hora_inicio === b.hora_inicio) return 0
    if (a.hora_inicio == null) return 1
    if (b.hora_inicio == null) return -1
    return a.hora_inicio < b.hora_inicio ? -1 : 1
  })
}
