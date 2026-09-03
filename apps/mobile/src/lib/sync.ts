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
    if (item.tipo === 'visita') {
      const { error } = await cliente.rpc('visita_crear', {
        p_persona_nombre: p.personaNombre,
        p_actividad_id: p.actividadId,
        p_sub_actividad_id: p.subActividadId,
        p_actividad_hora_id: p.actividadHoraId,
        p_zona_id: p.zonaId,
        p_departamento_id: p.departamentoId,
        p_municipio_id: p.municipioId,
        p_fecha: p.fecha,
        p_hora_inicio: p.horaInicio,
        p_persona_id: p.personaId ?? null,
        p_direccion: p.direccion ?? null,
        p_comentario: p.comentario ?? '',
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
        tenant_id: p.tenantId,
        asesor_id: p.asesorId,
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
        tenant_id: p.tenantId,
        nombre: p.nombre,
        telefono: p.telefono,
        monto_estimado: p.montoEstimado ?? null,
        asesor_id: p.asesorId,
        estado_id: p.estadoId,
      })
      if (error) throw error
    }
  }
}

