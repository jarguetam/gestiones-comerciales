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
  renovarSinConexion,
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

test('decidirTrasRenovar: AuthRetryableFetchError sin mensaje de red sigue (por el nombre)', () => {
  assert.equal(
    decidirTrasRenovar({ session: null, error: { name: 'AuthRetryableFetchError', status: 503, message: 'Service Unavailable' } }),
    'seguir',
  )
})

test('decidirTrasRenovar: GC-AUTH-033 error que no es de auth (SecureStore) sigue y avisa', () => {
  const avisos: Array<[string, unknown]> = []
  const e = new Error('could not decrypt the stored value')
  assert.equal(decidirTrasRenovar({ session: null, error: e }, (m, d) => avisos.push([m, d])), 'seguir')
  assert.deepEqual(avisos, [['GC-AUTH-033: error inesperado al renovar', e]])
})

test('decidirTrasRenovar: errores de auth van a Login sin GC-AUTH-033', () => {
  const avisos: string[] = []
  const advertir = (m: string) => { avisos.push(m) }
  for (const error of [
    { name: 'AuthApiError', status: 400, message: 'Invalid Refresh Token: Already Used' },
    { name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' },
    { __isAuthError: true, name: 'AuthError', message: 'x' },
  ]) {
    assert.equal(decidirTrasRenovar({ session: null, error }, advertir), 'login')
  }
  assert.equal(decidirTrasRenovar({ session: null, error: null }, advertir), 'login')
  assert.deepEqual(avisos, [])
})

function authCon(getSession: () => Promise<{ data: { session: unknown | null }; error: unknown | null }>) {
  return { getSession }
}

test('renovarSinConexion: sesión guardada vigente o renovada → normal', async () => {
  const r = await renovarSinConexion(authCon(async () => ({ data: { session: { access_token: 'nuevo' } }, error: null })))
  assert.deepEqual(r, { decision: 'normal', error: null })
})

test('renovarSinConexion: fallo de red reintentable → seguir', async () => {
  const error = { name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' }
  const r = await renovarSinConexion(authCon(async () => ({ data: { session: null }, error })))
  assert.deepEqual(r, { decision: 'seguir', error })
})

test('renovarSinConexion: refresh rechazado (auth-js ya borró la sesión) → login', async () => {
  const error = { name: 'AuthApiError', status: 400, message: 'Invalid Refresh Token: Already Used' }
  const r = await renovarSinConexion(authCon(async () => ({ data: { session: null }, error })))
  assert.deepEqual(r, { decision: 'login', error })
})

test('renovarSinConexion: almacenamiento vacío (tras salir) → login', async () => {
  const r = await renovarSinConexion(authCon(async () => ({ data: { session: null }, error: null })))
  assert.deepEqual(r, { decision: 'login', error: null })
})

test('renovarSinConexion: GC-AUTH-033 getSession que lanza un error ajeno a auth → seguir', async () => {
  const avisos: string[] = []
  const e = new Error('SecureStore: keystore unavailable')
  const r = await renovarSinConexion(authCon(async () => { throw e }), (m) => { avisos.push(m) })
  assert.deepEqual(r, { decision: 'seguir', error: e })
  assert.deepEqual(avisos, ['GC-AUTH-033: error inesperado al renovar'])
})
