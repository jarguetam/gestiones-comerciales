import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { encolar, reintentables, type ItemCola } from '../src/lib/cola.ts'
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

test('reactivarItem deja el ítem listo para el próximo envío', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:r')
  const agotado = { ...encolar([], alta('a'))[0], estado: 'error' as const, intentos: 5, proximoIntentoEn: 9e12 }
  await store.hidratarCola([agotado])
  assert.equal(reintentables(store.leerCola(), Date.now()).length, 0)
  await store.reactivarItem('a', 'tenant:r')
  assert.equal(reintentables(store.leerCola(), Date.now()).length, 1)
})

test('reactivarItem rechaza una clave de otra sesión', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:r')
  await assert.rejects(store.reactivarItem('a', 'tenant:x'), /GC-CORE-001/)
})

test('sincronizarAhora se detiene en el primer error transitorio y deja intactos los siguientes', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:t')
  await store.hidratarCola(encolar(encolar(encolar([], alta('a')), alta('b')), alta('c')))
  const antes = store.leerCola()[2]
  const llamados: string[] = []
  await store.sincronizarAhora(async (it) => {
    llamados.push(it.id)
    if (it.id === 'b') throw { message: 'Network request failed' }
  }, 1000, 'tenant:t')
  assert.deepEqual(llamados, ['a', 'b'])
  const [a, b, c] = store.leerCola()
  assert.equal(a.estado, 'enviado')
  assert.deepEqual([b.estado, b.intentos], ['pendiente', 0])
  assert.deepEqual(c, antes)
})

const altaVisita = { tipo: 'visita' as const, payload: { clienteKey: 'u1' }, clienteKey: 'visita:u1', id: 'v' }
const checkinVisita = {
  tipo: 'visita_checkin' as const,
  payload: { visitaClienteKey: 'u1', latitud: 1, longitud: 2 },
  clienteKey: 'visita_checkin:u1',
  id: 'ci',
}

test('sincronizarAhora no envía el check-in mientras su alta no llega y no le gasta intentos', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:t')
  await store.hidratarCola(encolar(encolar([], altaVisita), checkinVisita))
  const llamados: string[] = []
  await store.sincronizarAhora(async (it) => {
    llamados.push(it.id)
    if (it.id === 'v') throw { code: 'P0001', message: 'GC-VIS-002: la empresa no tiene oficinas activas' }
  }, 1000, 'tenant:t')
  assert.deepEqual(llamados, ['v'])
  const ci = store.leerCola()[1]
  assert.deepEqual([ci.estado, ci.intentos], ['pendiente', 0])
})

test('sincronizarAhora envía alta y check-in en el mismo pase, en orden', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:t')
  await store.hidratarCola(encolar(encolar([], altaVisita), checkinVisita))
  const llamados: string[] = []
  await store.sincronizarAhora(async (it) => { llamados.push(it.id) }, 1000, 'tenant:t')
  assert.deepEqual(llamados, ['v', 'ci'])
  assert.deepEqual(store.leerCola().map((i) => i.estado), ['enviado', 'enviado'])
})

test('encolarEnFondo vuelve tras el guardado sin esperar el envío y luego informa el rechazo', async () => {
  store.configurarPersistencia(persistenciaMemoria(), 'tenant:t')
  await store.hidratarCola([])
  const rpc = deferred()
  const inicio = deferred()
  const { envio } = await store.encolarEnFondo(alta('a'), async () => {
    inicio.resolve()
    await rpc.promise
    throw { code: 'P0001', message: 'GC-VIS-001: actividad y subactividad requeridas' }
  }, 'tenant:t')
  // Ya está guardado y el envío sigue en curso.
  assert.equal(store.leerCola()[0].estado, 'pendiente')
  await inicio.promise
  rpc.resolve()
  const final = await envio
  assert.equal(final?.id, 'a')
  assert.equal(final?.estado, 'error')
  assert.equal(final?.ultimoError, 'GC-VIS-001: actividad y subactividad requeridas')
})

test('encolarEnFondo con un fallo de disco rechaza antes de enviar', async () => {
  store.configurarPersistencia({ load: async () => null, save: async () => { throw new Error('disco lleno') } }, 'tenant:t')
  let enviados = 0
  await assert.rejects(store.encolarEnFondo(alta('a'), async () => { enviados++ }, 'tenant:t'), /disco lleno/)
  assert.equal(enviados, 0)
})
