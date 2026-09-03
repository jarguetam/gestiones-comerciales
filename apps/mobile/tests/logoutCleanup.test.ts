import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { claveParticionCola, persistenciaMemoriaParticionada } from '../src/lib/colaParticion.ts'
import { logoutCleanup } from '../src/lib/logoutCleanup.ts'
import { demoCola } from '../src/lib/cola.ts'

test('clave de cola es tenant:user y B no lee la de A', async () => {
  const store = persistenciaMemoriaParticionada()
  const a = claveParticionCola('t1', 'userA')
  const b = claveParticionCola('t1', 'userB')
  assert.equal(a, 't1:userA')
  await store.save(a, demoCola().slice(0, 1))
  await store.save(b, demoCola().slice(1, 2))
  const colaA = await store.load(a)
  const colaB = await store.load(b)
  assert.equal(colaA?.[0].id, 'd1')
  assert.equal(colaB?.[0].id, 'd2')
  assert.notEqual(colaA?.[0].id, colaB?.[0].id)
})

test('logoutCleanup borra sesión y solo la cola de ese usuario', async () => {
  const store = persistenciaMemoriaParticionada()
  const a = claveParticionCola('t1', 'userA')
  const b = claveParticionCola('t1', 'userB')
  await store.save(a, demoCola().slice(0, 1))
  await store.save(b, demoCola().slice(1, 2))
  let sesionBorrada = false
  let fcm = false
  await logoutCleanup({
    userId: 'userA',
    tenantId: 't1',
    deleteSession: async () => {
      sesionBorrada = true
    },
    clearCola: (clave) => store.clear(clave),
    invalidateFcm: async () => {
      fcm = true
    },
  })
  assert.equal(sesionBorrada, true)
  assert.equal(fcm, true)
  assert.equal(await store.load(a), null)
  assert.equal((await store.load(b))?.[0].id, 'd2')
})
