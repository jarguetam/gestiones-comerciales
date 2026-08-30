import { supabase } from '../../lib/supabase'
import { type ItemNotificacion } from './notificaciones'

export async function fetchNotificaciones(): Promise<ItemNotificacion[]> {
  const { data, error } = await supabase
    .from('notificacion')
    .select('id, titulo, cuerpo, leida, creado_en')
    .order('creado_en', { ascending: false })
    .limit(100)
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((n) => ({
    id: String(n.id),
    titulo: String(n.titulo),
    cuerpo: String(n.cuerpo),
    leida: Boolean(n.leida),
    creado_en: String(n.creado_en),
  }))
}

export async function persistirLeida(id: string): Promise<void> {
  const { error } = await supabase.from('notificacion').update({ leida: true }).eq('id', id)
  if (error) throw error
}
