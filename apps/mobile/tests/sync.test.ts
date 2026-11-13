import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ItemCola } from '../src/lib/cola.ts'
import { ejecutarMutacion } from '../src/lib/sync.ts'

interface Llamadas {
  rpc: Array<{ nombre: string; args: Record<string, unknown> }>
  consultas: Array<{ tabla: string; columnas: string; col: string; valor: unknown }>
}

function clienteFalso(respuestaVisita: { data: unknown; error: unknown } = { data: null, error: null }) {
  const llamadas: Llamadas = { rpc: [], consultas: [] }
  const cliente = {
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      llamadas.rpc.push({ nombre, args })
      return { data: null, error: null }
    },
    from: (tabla: string) => ({
      select: (columnas: string) => ({
        eq: (col: string, valor: unknown) => ({
          maybeSingle: async () => {
            llamadas.consultas.push({ tabla, columnas, col, valor })
            return respuestaVisita
          },
        }),
      }),
    }),
  }
  return { cliente: cliente as unknown as SupabaseClient, llamadas }
}

function item(tipo: ItemCola['tipo'], payload: Record<string, unknown>): ItemCola {
  return {
    id: 'c1',
    tipo,
    payload,
    estado: 'pendiente',
    intentos: 0,
    maxIntentos: 5,
    clienteKey: `${tipo}:u1`,
    creadoEn: '2026-11-13T00:00:00.000Z',
    proximoIntentoEn: 0,
  }
}

test('alta envía p_cliente_key y oficina/geografía nulas', async () => {
  const { cliente, llamadas } = clienteFalso()
  await ejecutarMutacion(cliente)(
    item('visita', {
      clienteKey: 'u1',
      personaNombre: 'Ana',
      actividadId: 1,
      subActividadId: 2,
      actividadHoraId: 3,
      fecha: '2026-11-14',
      horaInicio: '09:00',
    }),
  )
  assert.equal(llamadas.rpc.length, 1)
  assert.equal(llamadas.rpc[0].nombre, 'visita_crear')
  assert.deepEqual(llamadas.rpc[0].args, {
    p_persona_nombre: 'Ana',
    p_actividad_id: 1,
    p_sub_actividad_id: 2,
    p_actividad_hora_id: 3,
    p_zona_id: null,
    p_departamento_id: null,
    p_municipio_id: null,
    p_fecha: '2026-11-14',
    p_hora_inicio: '09:00',
    p_persona_id: null,
    p_direccion: null,
    p_comentario: '',
    p_cliente_key: 'u1',
  })
})

test('check-in de visita local resuelve el id por clave', async () => {
  const { cliente, llamadas } = clienteFalso({ data: { id: 77 }, error: null })
  await ejecutarMutacion(cliente)(
    item('visita_checkin', { visitaClienteKey: 'u1', latitud: 1.5, longitud: -2.5 }),
  )
  assert.deepEqual(llamadas.consultas, [
    { tabla: 'visita', columnas: 'id', col: 'cliente_key', valor: 'u1' },
  ])
  assert.deepEqual(llamadas.rpc, [
    { nombre: 'visita_checkin', args: { p_visita_id: 77, p_latitud: 1.5, p_longitud: -2.5 } },
  ])
})

test('completar de visita local resuelve el id por clave', async () => {
  const { cliente, llamadas } = clienteFalso({ data: { id: 77 }, error: null })
  await ejecutarMutacion(cliente)(
    item('visita_completar', { visitaClienteKey: 'u1', latitud: 1, longitud: 2, comentario: 'ok' }),
  )
  assert.deepEqual(llamadas.rpc, [
    {
      nombre: 'visita_completar',
      args: { p_visita_id: 77, p_comentario: 'ok', p_latitud: 1, p_longitud: 2 },
    },
  ])
})

test('visita local aún no creada lanza GC-SYNC-001', async () => {
  const { cliente, llamadas } = clienteFalso({ data: null, error: null })
  await assert.rejects(
    ejecutarMutacion(cliente)(item('visita_checkin', { visitaClienteKey: 'u1', latitud: 1, longitud: 2 })),
    { message: 'GC-SYNC-001: la visita aún no llega al servidor' },
  )
  assert.equal(llamadas.rpc.length, 0)
})

test('error de la consulta se lanza sin cambios', async () => {
  const fallo = { message: 'Network request failed' }
  const { cliente, llamadas } = clienteFalso({ data: null, error: fallo })
  await assert.rejects(
    ejecutarMutacion(cliente)(item('visita_checkin', { visitaClienteKey: 'u1', latitud: 1, longitud: 2 })),
    (e) => e === fallo,
  )
  assert.equal(llamadas.rpc.length, 0)
})

test('ítems de la versión anterior siguen sincronizando', async () => {
  const { cliente, llamadas } = clienteFalso()
  await ejecutarMutacion(cliente)(item('visita_checkin', { visitaId: 104, latitud: 1, longitud: 2 }))
  assert.deepEqual(llamadas.consultas, [])
  assert.deepEqual(llamadas.rpc, [
    { nombre: 'visita_checkin', args: { p_visita_id: 104, p_latitud: 1, p_longitud: 2 } },
  ])
})
