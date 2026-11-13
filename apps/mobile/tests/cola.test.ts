import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  backoffMs,
  bloqueadoPorDependencia,
  contarPendientes,
  ESPERA_SIN_RED_MS,
  marcarSinRed,
  reactivar,
  sinEnviar,
  demoCola,
  encolar,
  marcarEnviado,
  marcarError,
  procesarCola,
  reintentables,
  resumenCola,
  type ItemCola,
} from '../src/lib/cola.ts'

function item(parcial: Partial<ItemCola> = {}): ItemCola {
  return {
    id: '1',
    tipo: 'visita_checkin',
    payload: { visitaId: 10 },
    estado: 'pendiente',
    intentos: 0,
    maxIntentos: 5,
    clienteKey: 'visita_checkin:10',
    creadoEn: '2026-08-28T12:00:00.000Z',
    proximoIntentoEn: 0,
    ...parcial,
  }
}

test('encolar agrega pendiente y no duplica el mismo clienteKey', () => {
  const una = encolar([], {
    tipo: 'formulario_enviar',
    payload: { plantillaId: 1 },
    clienteKey: 'form:abc',
  })
  assert.equal(una.length, 1)
  assert.equal(una[0].estado, 'pendiente')
  assert.equal(una[0].intentos, 0)
  const dup = encolar(una, {
    tipo: 'formulario_enviar',
    payload: { plantillaId: 1 },
    clienteKey: 'form:abc',
  })
  assert.equal(dup.length, 1)
})

test('encolar sí admite otro clienteKey', () => {
  const a = encolar([], { tipo: 'deposito', payload: { monto: 10 }, clienteKey: 'dep:1' })
  const b = encolar(a, { tipo: 'deposito', payload: { monto: 20 }, clienteKey: 'dep:2' })
  assert.equal(b.length, 2)
})

test('contarPendientes ignora enviados y errores agotados', () => {
  const items = [
    item({ id: 'a', estado: 'pendiente' }),
    item({ id: 'b', estado: 'enviado', clienteKey: 'b' }),
    item({ id: 'c', estado: 'error', clienteKey: 'c' }),
  ]
  assert.equal(contarPendientes(items), 2)
})

test('backoffMs duplica hasta 60s', () => {
  assert.equal(backoffMs(1), 1000)
  assert.equal(backoffMs(2), 2000)
  assert.equal(backoffMs(3), 4000)
  assert.equal(backoffMs(10), 60_000)
})

test('reintentables respeta ventana de backoff y maxIntentos', () => {
  const ahora = 10_000
  const items = [
    item({ id: 'ok', proximoIntentoEn: 0 }),
    item({ id: 'wait', clienteKey: 'w', proximoIntentoEn: 20_000 }),
    item({ id: 'max', clienteKey: 'm', estado: 'error', intentos: 5, maxIntentos: 5 }),
  ]
  assert.deepEqual(
    reintentables(items, ahora).map((i) => i.id),
    ['ok'],
  )
})

test('marcarEnviado y marcarError actualizan estado', () => {
  const base = [item()]
  assert.equal(marcarEnviado(base, '1')[0].estado, 'enviado')
  const err = marcarError(base, '1', 'GC-NET', 1_000)
  assert.equal(err[0].estado, 'error')
  assert.equal(err[0].ultimoError, 'GC-NET')
  assert.equal(err[0].intentos, 1)
  assert.ok(err[0].proximoIntentoEn > 1_000)
})

test('procesarCola envía y reintenta fallos sin perder el ítem', async () => {
  let calls = 0
  const inicial = [
    item({ id: 'ok', clienteKey: 'ok' }),
    item({ id: 'fail', tipo: 'deposito', clienteKey: 'fail' }),
  ]
  const next = await procesarCola(inicial, async (it) => {
    calls += 1
    if (it.id === 'fail') throw new Error('offline')
  }, 5_000)
  assert.equal(calls, 2)
  assert.equal(next.find((i) => i.id === 'ok')?.estado, 'enviado')
  const fail = next.find((i) => i.id === 'fail')
  assert.equal(fail?.estado, 'error')
  assert.equal(fail?.intentos, 1)
  assert.match(fail?.ultimoError ?? '', /offline/)
})

test('demoCola tiene pendientes y al menos un error para M-09', () => {
  const demo = demoCola()
  const r = resumenCola(demo)
  assert.ok(r.pendientes >= 1)
  assert.ok(r.errores >= 1)
  assert.ok(demo.some((i) => i.tipo === 'visita_checkin'))
  assert.ok(demo.some((i) => i.tipo === 'formulario_enviar'))
})

test('error transitorio no consume intentos', async () => {
  const items = encolar([], { tipo: 'visita', payload: {}, clienteKey: 'k1', id: 'i1' })
  const r = await procesarCola(items, async () => { throw { message: 'Network request failed' } }, 1000)
  assert.deepEqual(
    [r[0].estado, r[0].intentos, r[0].ultimoError, r[0].proximoIntentoEn],
    ['pendiente', 0, 'GC-NET-001: sin conexión', 1000 + ESPERA_SIN_RED_MS],
  )
})

test('error del servidor sí consume intentos', async () => {
  const items = encolar([], { tipo: 'visita', payload: {}, clienteKey: 'k1', id: 'i1' })
  const r = await procesarCola(items, async () => { throw { code: 'P0001', message: 'GC-VIS-002: falta oficina' } }, 1000)
  assert.equal(r[0].estado, 'error')
  assert.equal(r[0].intentos, 1)
  assert.equal(r[0].ultimoError, 'GC-VIS-002: falta oficina')
})

test('marcarSinRed conserva los intentos ya gastados', () => {
  const r = marcarSinRed([item({ id: 'a', estado: 'error', intentos: 3 })], 'a', 500)
  assert.deepEqual([r[0].estado, r[0].intentos], ['pendiente', 3])
})

test('reactivar deja listo un ítem agotado', () => {
  const r = reactivar([item({ id: 'a', estado: 'error', intentos: 5, ultimoError: 'x', proximoIntentoEn: 9e12 })], 'a')
  assert.deepEqual(
    [r[0].estado, r[0].intentos, r[0].proximoIntentoEn, r[0].ultimoError],
    ['pendiente', 0, 0, undefined],
  )
})

test('reactivar un alta reactiva su check-in y su cierre', () => {
  const agotado = { estado: 'error' as const, intentos: 5, ultimoError: 'GC-SYNC-001' }
  const items = [
    item({ id: 'v', tipo: 'visita', payload: { clienteKey: 'u1' }, clienteKey: 'visita:u1', ...agotado }),
    item({ id: 'c', tipo: 'visita_checkin', payload: { visitaClienteKey: 'u1' }, clienteKey: 'ci:u1', ...agotado }),
    item({ id: 'f', tipo: 'visita_completar', payload: { visitaClienteKey: 'u1' }, clienteKey: 'co:u1', ...agotado }),
    item({ id: 'o', tipo: 'visita_checkin', payload: { visitaClienteKey: 'u2' }, clienteKey: 'ci:u2', ...agotado }),
  ]
  const r = reactivar(items, 'v')
  assert.deepEqual(r.map((i) => i.estado), ['pendiente', 'pendiente', 'pendiente', 'error'])
  assert.equal(r[1].intentos, 0)
})

test('sinEnviar cuenta pendientes y errores, no enviados', () => {
  assert.equal(
    sinEnviar([
      item({ id: 'a' }),
      item({ id: 'b', estado: 'error', intentos: 5 }),
      item({ id: 'c', estado: 'enviado' }),
    ]),
    2,
  )
})

test('mismo clienteKey no duplica la visita', () => {
  const a = encolar([], { tipo: 'visita', payload: {}, clienteKey: 'visita:u1' })
  assert.equal(encolar(a, { tipo: 'visita', payload: {}, clienteKey: 'visita:u1' }).length, 1)
})

const red = () => ({ message: 'Network request failed' })

test('procesarCola se detiene en el primer error transitorio y no toca los siguientes', async () => {
  const inicial = [
    item({ id: 'a', clienteKey: 'a' }),
    item({ id: 'b', clienteKey: 'b' }),
    item({ id: 'c', clienteKey: 'c', estado: 'error', intentos: 2, ultimoError: 'x' }),
  ]
  const llamados: string[] = []
  const r = await procesarCola(inicial, async (it) => {
    llamados.push(it.id)
    if (it.id === 'b') throw red()
  }, 1000)
  assert.deepEqual(llamados, ['a', 'b'])
  assert.equal(r[0].estado, 'enviado')
  assert.deepEqual([r[1].estado, r[1].intentos, r[1].ultimoError], ['pendiente', 0, 'GC-NET-001: sin conexión'])
  assert.deepEqual(r[2], inicial[2])
})

const alta = (over: Partial<ItemCola> = {}) =>
  item({ id: 'v', tipo: 'visita', payload: { clienteKey: 'u1' }, clienteKey: 'visita:u1', ...over })
const checkin = (over: Partial<ItemCola> = {}) =>
  item({ id: 'ci', tipo: 'visita_checkin', payload: { visitaClienteKey: 'u1', latitud: 1, longitud: 2 }, clienteKey: 'visita_checkin:u1', ...over })
const cierre = (over: Partial<ItemCola> = {}) =>
  item({ id: 'co', tipo: 'visita_completar', payload: { visitaClienteKey: 'u1', latitud: 3, longitud: 4 }, clienteKey: 'visita_completar:u1', ...over })

test('bloqueadoPorDependencia: check-in y cierre esperan a su alta; el cierre, al check-in previo', () => {
  assert.equal(bloqueadoPorDependencia(checkin(), [alta(), checkin()]), true)
  assert.equal(bloqueadoPorDependencia(checkin(), [alta({ estado: 'enviado' }), checkin()]), false)
  assert.equal(bloqueadoPorDependencia(cierre(), [alta({ estado: 'enviado' }), checkin(), cierre()]), true)
  assert.equal(bloqueadoPorDependencia(cierre(), [alta({ estado: 'enviado' }), checkin({ estado: 'enviado' }), cierre()]), false)
  // Visita que ya vino del servidor: no hay alta en la cola.
  assert.equal(bloqueadoPorDependencia(checkin(), [checkin()]), false)
  // Un check-in posterior al cierre no lo bloquea.
  assert.equal(bloqueadoPorDependencia(cierre(), [cierre(), checkin()]), false)
  // El alta en sí y otros tipos nunca esperan.
  assert.equal(bloqueadoPorDependencia(alta(), [alta(), checkin()]), false)
})

test('dependiente no se envía mientras su alta está pendiente y no gasta intentos', async () => {
  const inicial = [alta({ estado: 'error', intentos: 1, proximoIntentoEn: 9e12 }), checkin()]
  const llamados: string[] = []
  const r = await procesarCola(inicial, async (it) => { llamados.push(it.id) }, 1000)
  assert.deepEqual(llamados, [])
  assert.deepEqual(r[1], inicial[1])
})

test('si el servidor rechaza el alta, su check-in espera sin gastar intentos', async () => {
  const llamados: string[] = []
  const r = await procesarCola([alta(), checkin()], async (it) => {
    llamados.push(it.id)
    if (it.tipo === 'visita') throw { code: 'P0001', message: 'GC-VIS-002: la empresa no tiene oficinas activas' }
  }, 1000)
  assert.deepEqual(llamados, ['v'])
  assert.deepEqual([r[0].estado, r[0].intentos], ['error', 1])
  assert.deepEqual([r[1].estado, r[1].intentos, r[1].ultimoError], ['pendiente', 0, undefined])
})

test('dependiente se envía una vez enviada su alta, en el mismo pase y en orden', async () => {
  const llamados: string[] = []
  const r = await procesarCola([alta(), checkin(), cierre()], async (it) => { llamados.push(it.id) }, 1000)
  assert.deepEqual(llamados, ['v', 'ci', 'co'])
  assert.deepEqual(r.map((i) => i.estado), ['enviado', 'enviado', 'enviado'])
  const despues: string[] = []
  await procesarCola([alta({ estado: 'enviado' }), checkin()], async (it) => { despues.push(it.id) }, 1000)
  assert.deepEqual(despues, ['ci'])
})

test('el cierre espera mientras el check-in previo de la misma visita no está enviado', async () => {
  const inicial = [checkin({ estado: 'error', intentos: 1, proximoIntentoEn: 9e12 }), cierre()]
  const llamados: string[] = []
  const r = await procesarCola(inicial, async (it) => { llamados.push(it.id) }, 1000)
  assert.deepEqual(llamados, [])
  assert.deepEqual(r[1], inicial[1])
})

test('ítems legados solo con visitaId nunca esperan', async () => {
  const legadoCheckin = item({ id: 'l1', tipo: 'visita_checkin', payload: { visitaId: 104 }, clienteKey: 'visita_checkin:104', estado: 'error', intentos: 1, proximoIntentoEn: 9e12 })
  const legadoCierre = item({ id: 'l2', tipo: 'visita_completar', payload: { visitaId: 104 }, clienteKey: 'visita_completar:104' })
  assert.equal(bloqueadoPorDependencia(legadoCierre, [alta(), legadoCheckin, legadoCierre]), false)
  const llamados: string[] = []
  await procesarCola([alta({ estado: 'error', intentos: 1, proximoIntentoEn: 9e12 }), legadoCheckin, legadoCierre], async (it) => { llamados.push(it.id) }, 1000)
  assert.deepEqual(llamados, ['l2'])
})
