import { supabase } from '../../lib/supabase'
import { mensajeGc } from '../../lib/persistirHelpers'

export interface FilaFunnel {
  estado_codigo: string
  estado_nombre: string
  es_ganado: boolean
  es_perdido: boolean
  leads: number
  monto_estimado: number
}

export interface ItemActividadLead {
  id: string
  tipo: string
  descripcion: string | null
  creado_en: string
}

export async function transicionarLead(leadId: string, estadoCodigo: string, motivo?: string): Promise<void> {
  const id = Number(leadId)
  if (!Number.isFinite(id)) throw new Error('GC-CRM-000: lead no encontrado')
  const { error } = await supabase.rpc('lead_transicion', {
    p_lead_id: id,
    p_estado_cod: estadoCodigo,
    p_motivo: motivo ?? null,
  })
  if (error) throw new Error(mensajeGc(error))
}

export async function fetchCrmFunnel(): Promise<FilaFunnel[] | null> {
  const { data, error } = await supabase.rpc('crm_funnel')
  if (error) return null
  if (!Array.isArray(data)) return null
  return (data as Array<Record<string, unknown>>).map((r) => ({
    estado_codigo: String(r.estado_codigo ?? ''),
    estado_nombre: String(r.estado_nombre ?? r.estado_codigo ?? ''),
    es_ganado: Boolean(r.es_ganado),
    es_perdido: Boolean(r.es_perdido),
    leads: Number(r.leads ?? 0),
    monto_estimado: Number(r.monto_estimado ?? 0),
  }))
}

export async function fetchLeadActividad(leadId: string): Promise<ItemActividadLead[]> {
  const id = Number(leadId)
  if (!Number.isFinite(id)) return []
  const { data, error } = await supabase
    .from('lead_actividad')
    .select('id, tipo, descripcion, creado_en')
    .eq('lead_id', id)
    .order('creado_en', { ascending: false })
    .limit(50)
  if (error) return []
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    tipo: String(r.tipo),
    descripcion: r.descripcion != null ? String(r.descripcion) : null,
    creado_en: String(r.creado_en),
  }))
}
