import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { conRespaldo } from '../src/lib/respaldo.ts'

const red = () => new Error('Network request failed')

test('servidor ok guarda y devuelve origen servidor', async () => {
  const guardados: number[] = []
  const r = await conRespaldo({
    cargar: async () => 7,
    leer: async () => null,
    guardar: async (d) => { guardados.push(d) },
  })
  assert.deepEqual(r, { datos: 7, origen: 'servidor' })
  assert.deepEqual(guardados, [7])
})

test('error de red usa la caché con su fecha', async () => {
  const r = await conRespaldo({
    cargar: async () => { throw red() },
    leer: async () => ({ datos: 'viejo', guardadoEn: '2026-11-14T08:00:00.000Z' }),
    guardar: async () => { throw new Error('no debe guardar') },
  })
  assert.deepEqual(r, { datos: 'viejo', origen: 'cache', guardadoEn: '2026-11-14T08:00:00.000Z' })
})

test('error de red sin caché lanza GC-NET-002', async () => {
  await assert.rejects(
    conRespaldo({ cargar: async () => { throw red() }, leer: async () => null, guardar: async () => {} }),
    { message: 'GC-NET-002: sin conexión y sin datos guardados' },
  )
})

test('error del servidor se propaga y no lee la caché', async () => {
  const err = { code: '42501', message: 'permission denied' }
  let leyo = false
  await assert.rejects(
    conRespaldo({
      cargar: async () => { throw err },
      leer: async () => { leyo = true; return null },
      guardar: async () => {},
    }),
    (e) => e === err,
  )
  assert.equal(leyo, false)
})

test('perfil guardado conserva módulos sin señal', async () => {
  const r = await conRespaldo<{ modulos: string[] }>({
    cargar: async () => { throw red() },
    leer: async () => ({ datos: { modulos: ['depositos'] }, guardadoEn: '2026-11-14T08:00:00.000Z' }),
    guardar: async () => {},
  })
  assert.ok(r.datos.modulos.includes('depositos'))
})
