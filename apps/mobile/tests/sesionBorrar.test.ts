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
