import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { requirePublicConfig as webConfig } from '../apps/web/src/lib/env.ts'
import { requirePublicConfig as backofficeConfig } from '../apps/backoffice/src/lib/env.ts'
import { credencialesPublicasValidas as webCredentials, varsFaltantesSupabase } from '../apps/web/src/lib/supabaseEnv.ts'
import { credencialesPublicasValidas as backofficeCredentials } from '../apps/backoffice/src/lib/supabaseEnv.ts'

const localUrls = [
  'http://localhost:54321',
  'http://127.0.0.1:54321',
  'http://[::1]:54321',
  'http://10.0.2.2:54321',
  'http://192.168.1.20:54321',
  'http://172.16.0.2:54321',
  'http://172.31.255.254:54321',
]

test('los clientes reales reconocen credenciales locales sin habilitar el backend remoto', () => {
  for (const credentials of [webCredentials, backofficeCredentials]) {
    assert.equal(credentials('http://127.0.0.1:54321', 'anon-public-test-key-mas-de-20', 'local'), true)
    assert.equal(credentials('https://example.supabase.co', 'anon-public-test-key-mas-de-20', 'local'), false)
    assert.equal(credentials('http://127.0.0.1:54321', 'tu_anon_key_aqui', 'local'), false)
  }
  assert.deepEqual(varsFaltantesSupabase('http://127.0.0.1:54321', 'anon-public-test-key-mas-de-20', { url: 'URL', key: 'KEY' }, 'local'), [])
})

for (const [name, requireConfig] of [['web', webConfig], ['backoffice', backofficeConfig]] as const) {
  test(`${name}: local permite loopback y LAN; production los rechaza`, () => {
    for (const url of localUrls) {
      assert.equal(requireConfig({ url, anonKey: 'public-key', environment: 'local' }).url, url)
      assert.throws(() => requireConfig({ url, anonKey: 'public-key', environment: 'production' }), /GC-CORE-001/, url)
    }
  })

  test(`${name}: local rechaza servidores públicos y URL engañosas`, () => {
    for (const url of [
      'https://example.supabase.co',
      'http://172.32.0.1:54321',
      'http://192.169.1.20:54321',
      'http://localhost.evil.test:54321',
      'http://localhost@evil.test:54321',
      'http://user:pass@localhost:54321',
      'http://localhost:54321/rest/v1',
      'http://localhost:54321?target=production',
      'http://localhost:54321#production',
      'file://localhost/',
      'not-a-url',
    ]) {
      assert.throws(() => requireConfig({ url, anonKey: 'public-key', environment: 'local' }), /GC-CORE-001/, url)
    }
  })

  test(`${name}: production requiere HTTPS`, () => {
    assert.throws(() => requireConfig({ url: 'http://example.supabase.co', anonKey: 'public-key', environment: 'production' }), /GC-CORE-001/)
    assert.equal(requireConfig({ url: 'https://example.supabase.co', anonKey: 'public-key', environment: 'production' }).environment, 'production')
  })
}

test('jobs remotos de staging requieren habilitación explícita', () => {
  for (const name of ['supabase-staging', 'e2e-staging', 'ops-backup-staging']) {
    const workflow = readFileSync(`.github/workflows/${name}.yml`, 'utf8')
    assert.match(workflow, /jobs:\s*\n  \w+:\s*\n    if:.*vars\.ENABLE_STAGING == 'true'/, name)
  }
})

test('CI de fixtures locales no apunta a un backend público', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
  const urls = [...workflow.matchAll(/VITE_SUPABASE_URL:\s*(\S+)/g)].map((m) => m[1])
  assert.ok(urls.length > 0)
  for (const url of urls) assert.equal(url, 'http://127.0.0.1:54321')
})
