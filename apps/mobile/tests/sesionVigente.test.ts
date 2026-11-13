import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { esErrorTransitorio } from '../src/lib/errorRed.ts'
import { exigirSesion, MENSAJE_SESION_SIN_RENOVAR } from '../src/lib/sesionVigente.ts'

const cliente = (session: unknown) => ({ auth: { getSession: async () => ({ data: { session } }) } })

test('sin sesión lanza GC-NET-004 transitorio', async () => {
  await assert.rejects(exigirSesion(cliente(null)), (e) => {
    assert.equal((e as Error).message, 'GC-NET-004: sesión sin renovar (sin conexión)')
    assert.equal(esErrorTransitorio(e), true)
    return true
  })
  assert.equal(MENSAJE_SESION_SIN_RENOVAR, 'GC-NET-004: sesión sin renovar (sin conexión)')
})

test('con sesión no lanza', async () => {
  await exigirSesion(cliente({ access_token: 'x' }))
})
