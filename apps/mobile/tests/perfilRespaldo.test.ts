import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { cacheMemoria } from '../src/lib/cacheCampo.ts'
import { mensajeDeError } from '../src/lib/mensajeError.ts'
import { resolverPerfil, type FuentesPerfil } from '../src/lib/perfilRespaldo.ts'

const ok = { data: null, error: null }
const base = { userId: 'u1', email: 'ana@x.com', claims: { tenantId: 't1', rol: 'asesor' as never }, clave: 't1:u1' }

test('error no transitorio en usuario devuelve perfil degradado y avisa', async () => {
  const avisos: string[] = []
  const p = await resolverPerfil({
    ...base,
    cache: cacheMemoria(),
    leerFuentes: async (): Promise<FuentesPerfil> => ({
      usuario: { data: null, error: { code: '42501', message: 'denied' } },
      tenant: ok,
      modulos: { data: [{ modulo: { codigo: 'depositos' } }], error: null },
    }),
    advertir: (m) => { avisos.push(m) },
  })
  assert.equal(p.nombre, 'ana')
  assert.equal(p.tenantId, 't1')
  assert.deepEqual(p.modulos, [])
  assert.deepEqual(avisos, ['GC-AUTH-023: lectura de perfil fallida'])
})

test('error transitorio con caché devuelve el perfil guardado', async () => {
  const cache = cacheMemoria()
  await cache.guardar('t1:u1', 'perfil', { id: 'u1', modulos: ['depositos'] })
  const p = await resolverPerfil({
    ...base,
    cache,
    leerFuentes: async () => { throw new Error('Network request failed') },
  })
  assert.deepEqual(p.modulos, ['depositos'])
})

test('error transitorio sin caché devuelve perfil degradado y avisa', async () => {
  const avisos: string[] = []
  const p = await resolverPerfil({
    ...base,
    cache: cacheMemoria(),
    leerFuentes: async () => { throw new Error('Network request failed') },
    advertir: (m) => { avisos.push(m) },
  })
  assert.equal(p.id, 'u1')
  assert.equal(p.rol, 'asesor')
  assert.equal(avisos.length, 1)
  assert.match(avisos[0], /^GC-NET-002/)
})

test('perfil degradado no pisa la copia guardada', async () => {
  const cache = cacheMemoria()
  await cache.guardar('t1:u1', 'perfil', { id: 'u1', modulos: ['depositos'] })
  await resolverPerfil({
    ...base,
    cache,
    leerFuentes: async () => ({ usuario: { data: null, error: { code: 'PGRST200', message: 'x' } }, tenant: ok, modulos: ok }),
    advertir: () => {},
  })
  const g = await cache.leer<{ modulos: string[] }>('t1:u1', 'perfil')
  assert.deepEqual(g?.datos.modulos, ['depositos'])
})

test('mensajeDeError', () => {
  assert.equal(mensajeDeError(new Error('boom'), 'x'), 'boom')
  assert.equal(mensajeDeError({ message: 'denied', code: '42501' }, 'x'), 'denied')
  assert.equal(mensajeDeError('texto', 'x'), 'texto')
  assert.equal(mensajeDeError(null, 'x'), 'x')
})
