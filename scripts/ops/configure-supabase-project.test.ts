import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyAuthConfig, assertSmtpEnabled, assertSmtpOrThrow, authConfigPatch, authUrlsFor, requiredSmtpVars,
} from './configure-supabase-project.ts'

test('SMTP ausente es GC-OPS-008', () => {
  assert.deepEqual(requiredSmtpVars({}), [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_ADMIN_EMAIL',
  ])
  assert.throws(() => assertSmtpOrThrow({}), /GC-OPS-008/)
})

test('assertSmtpEnabled exige smtp.enabled', () => {
  assert.throws(() => assertSmtpEnabled({ smtp: { enabled: false } }), /GC-OPS-008/)
  assert.doesNotThrow(() => assertSmtpEnabled({ smtp: { enabled: true } }))
})

test('staging usa Vite local; prod exige Pages URL', () => {
  assert.deepEqual(authUrlsFor('staging').additional_redirect_urls, [
    'http://127.0.0.1:4173',
    'http://localhost:5173',
  ])
  assert.throws(() => authUrlsFor('production'), /GC-OPS-008/)
  assert.equal(authUrlsFor('production', 'https://example.github.io').site_url, 'https://example.github.io')
})

const smtp = {
  SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_ADMIN_EMAIL: 'no-reply@example.com',
}

test('prod permite redirects de Pages (hash #/recuperar) y gc://recuperar', () => {
  const patch = authConfigPatch('production', { ...smtp, PAGES_PROD_URL: 'https://example.github.io/gc' })
  assert.equal(patch.site_url, 'https://example.github.io/gc')
  assert.equal(patch.uri_allow_list, 'https://example.github.io/gc/**,gc://recuperar')
  assert.equal(patch.smtp_port, '587')
})

test('sin CONFIGURE_APPLY no llama a la API ni muestra la contraseña SMTP', async () => {
  let calls = 0
  const r = await applyAuthConfig(
    { ...smtp, SUPABASE_ACCESS_TOKEN: 't', SUPABASE_PROJECT_REF: 'ref', CONFIGURE_TARGET: 'production', PAGES_PROD_URL: 'https://x.io/' },
    (async () => { calls++; return new Response('{}') }) as typeof fetch,
  )
  assert.equal(r.applied, false)
  assert.equal(calls, 0)
  assert.equal(JSON.stringify(r).includes('"p"'), false)
})

test('CONFIGURE_APPLY=1 aplica y falla si la relectura no coincide', async () => {
  const env = {
    ...smtp, SUPABASE_ACCESS_TOKEN: 't', SUPABASE_PROJECT_REF: 'ref', CONFIGURE_TARGET: 'production' as const,
    PAGES_PROD_URL: 'https://x.io/', CONFIGURE_APPLY: '1',
  }
  const metodos: string[] = []
  const fake = (body: unknown) => (async (_u: unknown, init?: RequestInit) => {
    metodos.push(init?.method ?? 'GET')
    return new Response(JSON.stringify(body))
  }) as typeof fetch
  const expected = authConfigPatch('production', env)
  const ok = await applyAuthConfig(env, fake(expected))
  assert.equal(ok.applied, true)
  assert.deepEqual(metodos, ['PATCH', 'GET'])
  await assert.rejects(applyAuthConfig(env, fake({ ...expected, smtp_host: '' })), /GC-OPS-008: .*smtp_host/)
})
