import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { actualizarPassword, resetRedirectTo, solicitarReset } from './recuperar.ts'

test('resetRedirectTo usa hash /recuperar (HashRouter / Pages)', () => {
  assert.equal(
    resetRedirectTo({ origin: 'https://example.github.io', pathname: '/backoffice/' }),
    'https://example.github.io/backoffice/#/recuperar',
  )
})

test('solicitarReset llama resetPasswordForEmail y no entra demo', async () => {
  const calls: { email: string; redirectTo: string }[] = []
  await solicitarReset(
    'owner@plataforma.test',
    {
      auth: {
        resetPasswordForEmail: async (email, opts) => {
          calls.push({ email, redirectTo: opts.redirectTo })
          return { error: null }
        },
      },
    },
    { origin: 'https://bo.test', pathname: '/' },
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].email, 'owner@plataforma.test')
  assert.equal(calls[0].redirectTo, 'https://bo.test/#/recuperar')
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
        { origin: 'https://bo.test', pathname: '/' },
      ),
    /GC-AUTH-021/,
  )
})

test('actualizarPassword exige 8 caracteres y updateUser', async () => {
  await assert.rejects(
    () => actualizarPassword('corta', { auth: { resetPasswordForEmail: async () => ({ error: null }) } }),
    /GC-AUTH-021/,
  )
})

test('no hay camino demo en recuperar', () => {
  const src = readFileSync(new URL('./recuperar.ts', import.meta.url), 'utf8')
  assert.equal(src.includes('DEMO_MODE'), false)
})
