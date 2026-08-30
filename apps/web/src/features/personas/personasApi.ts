import { supabase } from '../../lib/supabase'
import type { PersonaItem } from '../calendar/personasData'

function telefonoDe(detalles: unknown): string {
  if (!detalles || typeof detalles !== 'object') return '—'
  const d = detalles as Record<string, unknown>
  const t = d.telefono ?? d.tel ?? d.celular
  return typeof t === 'string' && t.trim() ? t : '—'
}

export async function fetchPersonas(): Promise<PersonaItem[]> {
  const { data, error } = await supabase
    .from('persona')
    .select('id, nombre, categoria, documento, direccion, detalles, activo')
    .eq('activo', true)
    .order('nombre')
    .limit(300)
  if (error) throw error
  return ((data ?? []) as Array<{
    id: number | string
    nombre: string
    categoria: string | null
    documento: string | null
    direccion: string | null
    detalles: unknown
  }>).map((p) => ({
    id: String(p.id),
    nombre: p.nombre,
    categoria: p.categoria ?? 'Cliente',
    documento: p.documento ?? 'Sin documento',
    telefono: telefonoDe(p.detalles),
    direccion: p.direccion ?? '—',
    visitasPendientes: 0,
  }))
}
