import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ItemCola } from '../src/lib/cola.ts'
import { ejecutarMutacion } from '../src/lib/sync.ts'

interface Llamadas {
  rpc: Array<{ nombre: string; args: Record<string, unknown> }>
  consultas: Array<{ tabla: string; columnas: string; col: string; valor: unknown }>
}

function clienteFalso(
  respuestaVisita: { data: unknown; error: unknown } = { data: null, error: null },
  session: unknown = { access_token: 'jwt' },
) {
  const llamadas: Llamadas = { rpc: [], consultas: [] }
  const cliente = {
    auth: { getSession: async () => ({ data: { session }, error: null }) },
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

test('sin sesión vigente lanza GC-NET-004 y no llama al servidor', async () => {
  const { cliente, llamadas } = clienteFalso({ data: { id: 77 }, error: null }, null)
  for (const it of [
    item('visita', { clienteKey: 'u1', personaNombre: 'Ana', actividadId: 1, subActividadId: 2, actividadHoraId: 3 }),
    item('visita_checkin', { visitaClienteKey: 'u1', latitud: 1, longitud: 2 }),
    item('visita_completar', { visitaId: 5 }),
  ]) {
    await assert.rejects(ejecutarMutacion(cliente)(it), { message: 'GC-NET-004: sesión sin renovar (sin conexión)' })
  }
  assert.deepEqual(llamadas.rpc, [])
  assert.deepEqual(llamadas.consultas, [])
})

function clienteInsert(error: unknown) {
  return {
    auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } }, error: null }) },
    from: () => ({ insert: async () => ({ data: null, error }) }),
  } as unknown as SupabaseClient
}

const personaPayload = { tenantId: 't1', asesorId: 'u1', nombre: 'Ana', documento: '123' }

test('GC-PER-030 alta de cliente con documento repetido (23505)', async () => {
  await assert.rejects(
    ejecutarMutacion(clienteInsert({ code: '23505', message: 'duplicate key value violates unique constraint "persona_tenant_documento_key"' }))(
      item('persona', personaPayload),
    ),
    { message: 'GC-PER-030: ya existe un cliente con ese documento' },
  )
})

test('alta de cliente: otro error de PostgREST sale tal cual', async () => {
  const error = { code: '42501', message: 'new row violates row-level security policy for table "persona"' }
  await assert.rejects(ejecutarMutacion(clienteInsert(error))(item('persona', personaPayload)), (e) => e === error)
})
