import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  backoffMs,
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
