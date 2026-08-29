import assert from 'node:assert/strict'
import { mock } from 'node:test'
import test from 'node:test'
import { getJson, redact, requireToken } from './supabase-mgmt.ts'

test('requireToken lanza GC-OPS-001 si falta', () => {
  assert.throws(() => requireToken({}), /GC-OPS-001/)
})

test('redact oculta access tokens y service keys', () => {
  const out = redact({
    Authorization: 'Bearer sbp_secret',
    nested: { service_role: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb' },
  }) as { Authorization: string; nested: { service_role: string } }
  assert.equal(out.Authorization, 'Bearer [redacted]')
  assert.equal(out.nested.service_role, '[redacted]')
})

test('getJson hace GET con Bearer y devuelve status/body', async (t) => {
  const token = 'sbp_test_token_secret'
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    assert.equal(url, 'https://api.supabase.com/v1/projects')
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('Authorization'), `Bearer ${token}`)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })
  const { status, body } = await getJson('https://api.supabase.com/v1/projects', token)
  assert.equal(status, 200)
  assert.deepEqual(body, { ok: true })
})
