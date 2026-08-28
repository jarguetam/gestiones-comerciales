import type { SupabaseClient } from '@supabase/supabase-js'
import type { ItemCola } from './cola'

/** Ejecuta una mutación encolada contra PostgREST/RPC. El servidor valida reglas. */
export function ejecutarMutacion(cliente: SupabaseClient) {
  return async (item: ItemCola) => {
    const p = item.payload
    if (item.tipo === 'visita_checkin') {
      const { error } = await cliente.rpc('visita_checkin', {
        p_visita_id: p.visitaId,
        p_latitud: p.latitud,
        p_longitud: p.longitud,
      })
      if (error) throw error
      return
    }
    if (item.tipo === 'visita_completar') {
      const { error } = await cliente.rpc('visita_completar', {
        p_visita_id: p.visitaId,
        p_comentario: p.comentario ?? null,
        p_latitud: p.latitud ?? null,
        p_longitud: p.longitud ?? null,
      })
      if (error) throw error
      return
    }
    if (item.tipo === 'formulario_enviar') {
      const { error } = await cliente.rpc('formulario_enviar', {
        p_plantilla_id: p.plantillaId,
        p_respuestas: p.respuestas,
        p_visita_id: p.visitaId ?? null,
        p_cliente_key: item.clienteKey,
      })
      if (error) throw error
      return
    }
    if (item.tipo === 'deposito') {
      const { error } = await cliente.from('deposito').insert({
        monto: p.monto,
        referencia: p.referencia ?? null,
        estado: 'pendiente',
        asesor_id: p.asesorId,
        tenant_id: p.tenantId,
      })
      if (error) throw error
      return
    }
    if (item.tipo === 'solicitud') {
      const { error } = await cliente.from('solicitud').insert({
        descripcion: p.descripcion,
        monto: p.monto ?? null,
        persona_id: p.personaId,
        asesor_id: p.asesorId,
        tenant_id: p.tenantId,
        estado_id: p.estadoId,
      })
      if (error) throw error
      return
    }
    if (item.tipo === 'persona') {
      const { error } = await cliente.from('persona').insert({
        nombre: p.nombre,
        documento: p.documento ?? null,
        documento_tipo: p.documentoTipo ?? 'DPI',
        direccion: p.direccion ?? null,
        categoria: p.categoria ?? null,
        detalles: p.detalles ?? {},
      })
      if (error) throw error
      return
    }
    if (item.tipo === 'lead') {
      const { error } = await cliente.from('lead').insert({
        nombre: p.nombre,
        telefono: p.telefono,
        monto_estimado: p.montoEstimado ?? null,
        asesor_id: p.asesorId,
      })
      if (error) throw error
    }
  }
}

export async function ejecutarDemo(_item: ItemCola): Promise<void> {
  /* Preview: la cola avanza sin backend. */
}
