import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { cacheMemoria } from '../src/lib/cacheCampo.ts'
import { cacheConGuardadoSi, crearPrecargaCatalogos, REFRESCO_CATALOGOS_MS } from '../src/lib/precargaCatalogos.ts'

function reloj(inicio = 1_000_000) {
  let t = inicio
  return { ahora: () => t, avanzar: (ms: number) => { t += ms } }
}

test('al entrar descarga; un fallo se avisa con GC-CAT-001 y no rechaza', async () => {
  const avisos: Array<[string, unknown]> = []
  const fallo = new Error('GC-NET-002: sin conexión y sin datos guardados')
  const p = crearPrecargaCatalogos({ cargar: async () => { throw fallo }, advertir: (m, d) => { avisos.push([m, d]) } })
  await p.siHaceFalta()
  assert.equal(avisos.length, 1)
  assert.match(avisos[0][0], /^GC-CAT-001/)
  assert.equal(avisos[0][1], fallo)
})

test('si la última quedó en la copia (sin señal), vuelve a intentar', async () => {
  let n = 0
  const origenes: Array<'servidor' | 'cache'> = ['cache', 'servidor']
  const r = reloj()
  const p = crearPrecargaCatalogos({ cargar: async () => ({ origen: origenes[n++] }), ahora: r.ahora, advertir: () => {} })
  await p.siHaceFalta()
  r.avanzar(30_000)
  await p.siHaceFalta()
  assert.equal(n, 2)
  r.avanzar(30_000)
  await p.siHaceFalta()
  assert.equal(n, 2, 'ya llegó al servidor: no se repite enseguida')
})

test('tras un fallo vuelve a intentar en la siguiente llamada', async () => {
  let n = 0
  const p = crearPrecargaCatalogos({
    cargar: async () => { if (n++ === 0) throw new TypeError('Network request failed'); return { origen: 'servidor' as const } },
    advertir: () => {},
  })
  await p.siHaceFalta()
  await p.siHaceFalta()
  assert.equal(n, 2)
})

test('con copia fresca del servidor no descarga hasta que vence el refresco', async () => {
  let n = 0
  const r = reloj()
  const p = crearPrecargaCatalogos({ cargar: async () => { n++; return { origen: 'servidor' as const } }, ahora: r.ahora })
  await p.siHaceFalta()
  r.avanzar(REFRESCO_CATALOGOS_MS - 1)
  await p.siHaceFalta()
  assert.equal(n, 1)
  r.avanzar(1)
  await p.siHaceFalta()
  assert.equal(n, 2)
})

test('llamadas simultáneas comparten una sola descarga', async () => {
  let n = 0
  let soltar!: () => void
  const espera = new Promise<void>((res) => { soltar = res })
  const p = crearPrecargaCatalogos({ cargar: async () => { n++; await espera; return { origen: 'servidor' as const } } })
  const a = p.siHaceFalta()
  const b = p.siHaceFalta()
  soltar()
  await Promise.all([a, b])
  assert.equal(n, 1)
})

test('cacheConGuardadoSi no escribe cuando ya no corresponde (p. ej. al salir)', async () => {
  const base = cacheMemoria()
  let permitido = true
  const c = cacheConGuardadoSi(base, () => permitido)
  await c.guardar('t1:u1', 'catalogos', ['a'])
  permitido = false
  await c.guardar('t1:u1', 'catalogos', ['b'])
  const g = await c.leer<string[]>('t1:u1', 'catalogos')
  assert.deepEqual(g?.datos, ['a'])
})
