import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { encolar, type ItemCola } from '../src/lib/cola.ts'
import { persistenciaMemoria } from '../src/lib/colaPersistencia.ts'
import * as store from '../src/lib/colaStore.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}
const alta = (id: string) => ({ tipo: 'persona' as const, payload: { nombre: id }, clienteKey: id, id })

test('encolar espera el guardado durable antes de enviar', async () => {
  store.configurarPersistencia(null)
  await store.hidratarCola([])
  const guardado = deferred()
  let llamadas = 0
  store.configurarPersistencia({ load: async () => null, save: () => guardado.promise })
  const envio = store.encolarYSync(alta('a'), async () => { llamadas++ })
  await new Promise((r) => setImmediate(r))
  assert.equal(llamadas, 0)
  guardado.resolve()
  await envio
  assert.equal(llamadas, 1)
})

test('dos sincronizaciones simultáneas no envían dos veces el mismo elemento', async () => {
  store.configurarPersistencia(persistenciaMemoria())
  await store.hidratarCola(encolar([], alta('a')))
  const rpc = deferred()
  let llamadas = 0
  const ejecutar = async () => { llamadas++; await rpc.promise }
  const primera = store.sincronizarAhora(ejecutar)
  const segunda = store.sincronizarAhora(ejecutar)
  rpc.resolve()
  await Promise.all([primera, segunda])
  assert.equal(llamadas, 1)
})

test('una alta durante el RPC no desaparece al completar sync', async () => {
  store.configurarPersistencia(persistenciaMemoria())
  await store.hidratarCola(encolar([], alta('a')))
  const inicio = deferred()
  const rpc = deferred()
  const sync = store.sincronizarAhora(async () => { inicio.resolve(); await rpc.promise })
  await inicio.promise
  await store.encolarMutacion(alta('b'))
  rpc.resolve()
  await sync
  assert.deepEqual(store.leerCola().map((i) => [i.id, i.estado]), [['a', 'enviado'], ['b', 'pendiente']])
})

test('vaciar la cola durante un RPC no restaura elementos ni ejecuta los restantes', async () => {
  const persist = persistenciaMemoria()
  store.configurarPersistencia(persist)
  await store.hidratarCola(encolar(encolar([], alta('a')), alta('b')))
  const inicio = deferred()
  const rpc = deferred()
  const enviados: string[] = []
  const sync = store.sincronizarAhora(async (item) => { enviados.push(item.id); inicio.resolve(); await rpc.promise })
  await inicio.promise
  await store.clearCola()
  rpc.resolve()
  await sync
  assert.deepEqual(store.leerCola(), [])
  assert.deepEqual(await persist.load(), [])
  assert.deepEqual(enviados, ['a'])
})

test('cambiar persistencia invalida una carga anterior pendiente', async () => {
  const carga = deferred()
  store.configurarPersistencia({ load: async () => { await carga.promise; return encolar([], alta('a')) }, save: async () => {} })
  const primera = store.hidratarDesdePersistencia()
  store.configurarPersistencia(persistenciaMemoria(encolar([], alta('b'))))
  await store.hidratarDesdePersistencia()
  carga.resolve()
  await primera
  assert.deepEqual(store.leerCola().map((i) => i.id), ['b'])
})

test('las escrituras se completan en orden aunque el primer guardado sea lento', async () => {
  store.configurarPersistencia(null)
  await store.hidratarCola([])
  const lento = deferred()
  let n = 0
  let disco: ItemCola[] = []
  store.configurarPersistencia({ load: async () => null, save: async (items) => {
    if (++n === 1) await lento.promise
    disco = items
  } })
  const a = store.encolarMutacion(alta('a'))
  const b = store.encolarMutacion(alta('b'))
  lento.resolve()
  await Promise.all([a, b])
  assert.deepEqual(disco.map((i) => i.id), ['a', 'b'])
})

test('un fallo de disco impide enviar y llega al llamador', async () => {
  store.configurarPersistencia({ load: async () => null, save: async () => { throw new Error('disco lleno') } })
  let enviados = 0
  await assert.rejects(store.encolarYSync(alta('a'), async () => { enviados++ }), /disco lleno/)
  assert.equal(enviados, 0)
})

test('clearCola rechaza una clave ajena sin borrar la partición activa', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:b')
  await store.hidratarCola(encolar([], alta('b')))
  await assert.rejects(store.clearCola('tenant:a'), /GC-CORE-001/)
  assert.equal(store.leerCola()[0].id, 'b')
})

test('una captura tardía de A no se encola bajo la sesión B', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:b')
  await assert.rejects(store.encolarYSync(alta('a'), async () => {}, 'tenant:a'), /GC-CORE-001/)
  assert.deepEqual(store.leerCola(), [])
})

test('sin almacenamiento configurado no se simula una captura exitosa', async () => {
  store.configurarPersistencia(null)
  await assert.rejects(store.encolarYSync(alta('a'), async () => {}), /GC-CORE-001/)
})

test('una sincronización tardía de A no procesa la cola de B', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:b')
  await store.hidratarCola(encolar([], alta('b')))
  let enviados = 0
  await assert.rejects(store.sincronizarAhora(async () => { enviados++ }, Date.now(), 'tenant:a'), /GC-CORE-001/)
  assert.equal(enviados, 0)
  assert.equal(store.leerCola()[0].estado, 'pendiente')
})
