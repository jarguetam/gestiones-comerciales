import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { demoCola, encolar } from '../src/lib/cola.ts'
import {
  claveCola,
  hidratarColaJson,
  serializarCola,
  type AlmacenCola,
} from '../src/lib/colaPersist.ts'

class Memoria implements AlmacenCola {
  map = new Map<string, string>()
  async getItem(key: string) {
    return this.map.get(key) ?? null
  }
  async setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

test('serializar/hidratar round-trip conserva pendientes', () => {
  const demo = demoCola()
  const json = serializarCola(demo)
  const back = hidratarColaJson(json)
  assert.ok(back)
  assert.equal(back.length, demo.length)
  assert.equal(back[0].clienteKey, demo[0].clienteKey)
})

test('hidratarColaJson rechaza JSON corrupto', () => {
  assert.equal(hidratarColaJson('no-json'), null)
  assert.equal(hidratarColaJson(null), null)
  assert.deepEqual(hidratarColaJson('[]'), [])
})

test('claveCola aísla usuarios', () => {
  assert.equal(claveCola('u1'), 'gc.cola.v1:u1')
  assert.notEqual(claveCola('u1'), claveCola('u2'))
})

test('NFR-FE-3: la cola sobrevive un reinicio del proceso vía almacén', async () => {
  const store = new Memoria()
  const enMemoria = encolar([], {
    tipo: 'visita_checkin',
    payload: { visitaId: 9, latitud: 14.6, longitud: -90.5 },
    clienteKey: 'visita_checkin:9',
  })
  await store.setItem(claveCola('asesor-1'), serializarCola(enMemoria))

  // "kill" del proceso: otra instancia lee el mismo KV
  const store2 = new Memoria()
  store2.map = store.map
  const restaurada = hidratarColaJson(await store2.getItem(claveCola('asesor-1')))
  assert.ok(restaurada)
  assert.equal(restaurada.length, 1)
  assert.equal(restaurada[0].clienteKey, 'visita_checkin:9')
  assert.equal(restaurada[0].estado, 'pendiente')
})

test('hidratarColaJson usa fallback (null) si el almacén está vacío', async () => {
  const store = new Memoria()
  const raw = await store.getItem(claveCola('nuevo'))
  const hidratada = hidratarColaJson(raw)
  const fallback = encolar([], { tipo: 'lead', payload: { nombre: 'A' }, clienteKey: 'lead:a' })
  const next = hidratada ?? fallback
  assert.equal(next[0].clienteKey, 'lead:a')
})
