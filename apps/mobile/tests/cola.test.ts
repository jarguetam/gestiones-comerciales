import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  backoffMs,
  contarPendientes,
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
