import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { actualizarPassword, resetRedirectTo, solicitarReset } from '../src/features/auth/recuperar.ts'

test('resetRedirectTo usa hash /recuperar (HashRouter / Pages)', () => {
  assert.equal(
    resetRedirectTo({ origin: 'https://example.github.io', pathname: '/gestiones/' }),
    'https://example.github.io/gestiones/#/recuperar',
  )
})

test('solicitarReset llama resetPasswordForEmail y no entra demo', async () => {
  const calls: { email: string; redirectTo: string }[] = []
  await solicitarReset(
    'asesor@empresa.test',
    {
      auth: {
        resetPasswordForEmail: async (email, opts) => {
          calls.push({ email, redirectTo: opts.redirectTo })
          return { error: null }
        },
      },
    },
    { origin: 'https://app.test', pathname: '/' },
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].email, 'asesor@empresa.test')
  assert.equal(calls[0].redirectTo, 'https://app.test/#/recuperar')
})

test('solicitarReset mapea error de Auth a GC-AUTH-021', async () => {
  await assert.rejects(
    () =>
      solicitarReset(
        'a@b.com',
        {
          auth: {
            resetPasswordForEmail: async () => ({ error: { message: 'rate' } }),
          },
        },
        { origin: 'https://app.test', pathname: '/' },
      ),
    /GC-AUTH-021/,
  )
})

test('actualizarPassword exige 8 caracteres y updateUser', async () => {
  await assert.rejects(() => actualizarPassword('corta', { auth: { resetPasswordForEmail: async () => ({ error: null }) } }), /GC-AUTH-021/)
  let saved = ''
  await actualizarPassword('nueva-clave-ok', {
    auth: {
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async ({ password }) => {
        saved = password
        return { error: null }
      },
    },
  })
  assert.equal(saved, 'nueva-clave-ok')
})

test('no hay camino demo en recuperar', () => {
  const src = readFileSync(new URL('../src/features/auth/recuperar.ts', import.meta.url), 'utf8')
  assert.equal(src.includes('DEMO_MODE'), false)
  assert.equal(src.includes('activarSesionDemo'), false)
})
