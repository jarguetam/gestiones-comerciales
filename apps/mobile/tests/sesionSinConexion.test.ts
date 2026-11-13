import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { cacheMemoria } from '../src/lib/cacheCampo.ts'
import { claveParticionCola } from '../src/lib/colaParticion.ts'
import {
  claveSesionSupabase,
  decidirTrasRenovar,
  leerSesionGuardada,
  perfilSinConexion,
  puedeEntrarSinConexion,
  type SesionGuardada,
} from '../src/lib/sesionSinConexion.ts'

function jwtCon(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.sig`
}

const DIA = 24 * 60 * 60 * 1000
const storageCon = (v: string | null) => ({ getItem: async () => v })

function sesion(over: Partial<SesionGuardada> = {}): SesionGuardada {
  return {
    access_token: jwtCon({ tenant_id: 't1', rol: 'asesor' }),
    refresh_token: 'r',
    user: { id: 'u1', email: 'ana@x.com' },
    ...over,
  }
}

test('claveSesionSupabase usa el primer segmento del host', () => {
  assert.equal(claveSesionSupabase('https://xcoeipsnykceorcvjwve.supabase.co'), 'sb-xcoeipsnykceorcvjwve-auth-token')
  assert.equal(claveSesionSupabase('http://127.0.0.1:54321'), 'sb-127-auth-token')
})

test('leerSesionGuardada: JSON válido devuelve el objeto', async () => {
  const s = sesion()
  assert.deepEqual(await leerSesionGuardada(storageCon(JSON.stringify(s)), 'k'), s)
})

test('leerSesionGuardada: JSON inválido avisa y devuelve null', async () => {
  const avisos: string[] = []
  assert.equal(await leerSesionGuardada(storageCon('{'), 'k', (m) => { avisos.push(m) }), null)
  assert.deepEqual(avisos, ['GC-AUTH-025: sesión guardada ilegible'])
})

test('leerSesionGuardada: sin refresh_token avisa y devuelve null', async () => {
  const avisos: string[] = []
  const { refresh_token: _r, ...sin } = sesion()
  assert.equal(await leerSesionGuardada(storageCon(JSON.stringify(sin)), 'k', (m) => { avisos.push(m) }), null)
  assert.equal(avisos.length, 1)
})

test('leerSesionGuardada: storage vacío devuelve null sin avisar', async () => {
  const avisos: string[] = []
  assert.equal(await leerSesionGuardada(storageCon(null), 'k', (m) => { avisos.push(m) }), null)
  assert.deepEqual(avisos, [])
})

test('leerSesionGuardada: error del storage no lanza', async () => {
  const avisos: string[] = []
  const s = { getItem: async (): Promise<string | null> => { throw new Error('boom') } }
  assert.equal(await leerSesionGuardada(s, 'k', (m) => { avisos.push(m) }), null)
  assert.deepEqual(avisos, ['GC-AUTH-025: sesión guardada ilegible'])
})

test('puedeEntrarSinConexion: 6 días sí, 8 días no, sin expires_at no', () => {
  const ahora = 1_800_000_000_000
  assert.equal(puedeEntrarSinConexion(sesion({ expires_at: (ahora - 6 * DIA) / 1000 }), ahora), true)
  assert.equal(puedeEntrarSinConexion(sesion({ expires_at: (ahora - 8 * DIA) / 1000 }), ahora), false)
  assert.equal(puedeEntrarSinConexion(sesion({ expires_at: (ahora - 7 * DIA) / 1000 }), ahora), true)
  assert.equal(puedeEntrarSinConexion(sesion(), ahora), false)
})

test('perfilSinConexion: usa el perfil guardado', async () => {
  const cache = cacheMemoria()
  await cache.guardar(claveParticionCola('t1', 'u1'), 'perfil', { id: 'u1', tenantId: 't1', modulos: ['depositos'] })
  const p = await perfilSinConexion(sesion(), cache)
  assert.deepEqual(p?.modulos, ['depositos'])
})

test('perfilSinConexion: sin caché devuelve degradado con claims del JWT', async () => {
  const p = await perfilSinConexion(sesion(), cacheMemoria(), () => {})
  assert.equal(p?.tenantId, 't1')
  assert.equal(p?.rol, 'asesor')
})

test('perfilSinConexion: JWT sin claims devuelve null', async () => {
  assert.equal(await perfilSinConexion(sesion({ access_token: jwtCon({}) }), cacheMemoria()), null)
})

test('decidirTrasRenovar', () => {
  assert.equal(decidirTrasRenovar({ session: { a: 1 }, error: null }), 'normal')
  assert.equal(decidirTrasRenovar({ session: { a: 1 }, error: { name: 'X' } }), 'normal')
  assert.equal(
    decidirTrasRenovar({ session: null, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } }),
    'seguir',
  )
  assert.equal(
    decidirTrasRenovar({ session: null, error: { name: 'AuthApiError', status: 400, message: 'Invalid Refresh Token' } }),
    'login',
  )
  assert.equal(decidirTrasRenovar({ session: null, error: null }), 'login')
})
