import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { borrarSesionGuardada, cerrarSesionYBorrar } from '../src/lib/sesionBorrar.ts'

const CLAVE = 'sb-demo-auth-token'

function storageFalso(inicial: string[], fallan: string[] = []) {
  const datos = new Map(inicial.map((k) => [k, 'x']))
  const intentos: string[] = []
  return {
    datos,
    intentos,
    async removeItem(k: string) {
      intentos.push(k)
      if (fallan.includes(k)) throw new Error('disco')
      datos.delete(k)
    },
  }
}

test('GC-AUTH-027 signOut falla por red: igual se borran las tres claves de la sesión', async () => {
  const st = storageFalso([CLAVE, `${CLAVE}-user`, `${CLAVE}-code-verifier`, 'otra'])
  const avisos: string[] = []
  await cerrarSesionYBorrar(
    { auth: { signOut: async () => ({ error: new Error('network') }) } },
    st, CLAVE, (m) => avisos.push(m),
  )
  assert.deepEqual([...st.datos.keys()], ['otra'])
  assert.match(avisos[0], /GC-AUTH-027/)
})

test('signOut que lanza tampoco impide borrar', async () => {
  const st = storageFalso([CLAVE])
  await cerrarSesionYBorrar(
    { auth: { signOut: async () => { throw new Error('boom') } } },
    st, CLAVE, () => undefined,
  )
  assert.equal(st.datos.has(CLAVE), false)
})

test('GC-AUTH-028 removeItem que lanza: avisa, intenta las demás y no rechaza', async () => {
  const st = storageFalso([CLAVE, `${CLAVE}-user`, `${CLAVE}-code-verifier`], [CLAVE])
  const avisos: string[] = []
  await borrarSesionGuardada(st, CLAVE, (m) => avisos.push(m))
  assert.deepEqual(st.intentos, [CLAVE, `${CLAVE}-user`, `${CLAVE}-code-verifier`, 'supabase.session'])
  assert.equal(st.datos.has(`${CLAVE}-user`), false)
  assert.equal(st.datos.has(`${CLAVE}-code-verifier`), false)
  assert.equal(avisos.length, 1)
  assert.match(avisos[0], /GC-AUTH-028/)
})

const AHORA = 1_800_000_000_000

function storageConSesion(expiresAt: number) {
  const st = storageFalso([CLAVE, `${CLAVE}-user`, 'otra'])
  const sesion = JSON.stringify({ access_token: 'jwt-a', refresh_token: 'r', expires_at: expiresAt, user: { id: 'u1' } })
  return { ...st, async getItem(k: string) { return st.datos.has(k) ? (k === CLAVE ? sesion : 'x') : null } }
}

test('GC-AUTH-027 borra las claves antes de signOut y no espera más del límite', async () => {
  const st = storageFalso([CLAVE, `${CLAVE}-user`, `${CLAVE}-code-verifier`, 'otra'])
  const avisos: string[] = []
  let clavesAlLlamar: string[] | null = null
  await cerrarSesionYBorrar(
    {
      auth: {
        signOut: () => {
          clavesAlLlamar = [...st.datos.keys()]
          return new Promise(() => undefined)
        },
      },
    },
    st, CLAVE, (m) => avisos.push(m), { limiteMs: 20 },
  )
  assert.deepEqual(clavesAlLlamar, ['otra'])
  assert.deepEqual([...st.datos.keys()], ['otra'])
  assert.deepEqual(avisos, ['GC-AUTH-027: no se pudo cerrar sesión en el servidor'])
})

test('token vigente: revoca en el servidor con ese token, ya sin claves locales', async () => {
  const st = storageConSesion(AHORA / 1000 + 600)
  const revocadas: Array<{ jwt: string; scope: unknown; claves: string[] }> = []
  const avisos: string[] = []
  await cerrarSesionYBorrar(
    {
      auth: {
        signOut: async () => ({ error: null }),
        admin: {
          signOut: async (jwt: string, scope?: unknown) => {
            revocadas.push({ jwt, scope, claves: [...st.datos.keys()] })
            return { error: null }
          },
        },
      },
    },
    st, CLAVE, (m) => avisos.push(m), { ahoraMs: () => AHORA },
  )
  assert.deepEqual(revocadas, [{ jwt: 'jwt-a', scope: 'global', claves: ['otra'] }])
  assert.deepEqual(avisos, [])
})

test('token vencido (caso sin señal): no intenta revocar', async () => {
  const st = storageConSesion(AHORA / 1000 - 60)
  let revocada = false
  await cerrarSesionYBorrar(
    {
      auth: {
        signOut: async () => ({ error: null }),
        admin: { signOut: async () => { revocada = true; return { error: null } } },
      },
    },
    st, CLAVE, () => undefined, { ahoraMs: () => AHORA },
  )
  assert.equal(revocada, false)
  assert.equal(st.datos.has(CLAVE), false)
})

test('GC-AUTH-027 revocación que falla o no responde: avisa y termina', async () => {
  for (const revocar of [
    async () => ({ error: { name: 'AuthApiError', status: 500, message: 'boom' } }),
    () => new Promise<{ error: unknown }>(() => undefined),
  ]) {
    const st = storageConSesion(AHORA / 1000 + 600)
    const avisos: string[] = []
    await cerrarSesionYBorrar(
      { auth: { signOut: async () => ({ error: null }), admin: { signOut: revocar } } },
      st, CLAVE, (m) => avisos.push(m), { limiteMs: 20, ahoraMs: () => AHORA },
    )
    assert.deepEqual(avisos, ['GC-AUTH-027: no se pudo cerrar sesión en el servidor'])
    assert.equal(st.datos.has(CLAVE), false)
  }
})

test('revocación con 401: el token ya no sirve en el servidor y no se avisa', async () => {
  const st = storageConSesion(AHORA / 1000 + 600)
  const avisos: string[] = []
  await cerrarSesionYBorrar(
    {
      auth: {
        signOut: async () => ({ error: null }),
        admin: { signOut: async () => ({ error: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } }) },
      },
    },
    st, CLAVE, (m) => avisos.push(m), { ahoraMs: () => AHORA },
  )
  assert.deepEqual(avisos, [])
})
