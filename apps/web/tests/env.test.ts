import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { environmentFromVite, requireBuildEnv, requirePublicConfig } from '../src/lib/env.ts'

test('requirePublicConfig exige url y anon', () => {
  assert.throws(
    () => requirePublicConfig({ url: '', anonKey: 'anon', environment: 'local' }),
    /GC-CORE-001/,
  )
  assert.throws(
    () => requirePublicConfig({ url: 'https://example.supabase.co', anonKey: null, environment: 'staging' }),
    /GC-CORE-001/,
  )
})

test('requirePublicConfig devuelve el entorno', () => {
  const cfg = requirePublicConfig({
    url: 'https://example.supabase.co',
    anonKey: 'anon-key-value',
    environment: 'production',
  })
  assert.equal(cfg.environment, 'production')
  assert.equal(cfg.url, 'https://example.supabase.co')
})

test('environmentFromVite cae a local si falta', () => {
  assert.equal(environmentFromVite(undefined), 'local')
  assert.equal(environmentFromVite('staging'), 'staging')
})

test('requireBuildEnv lanza GC-CORE-001 sin URL', () => {
  assert.throws(
    () =>
      requireBuildEnv({
        VITE_SUPABASE_ANON_KEY: 'anon-key-value',
        VITE_ENVIRONMENT: 'production',
        VITE_SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
        VITE_RELEASE: 'test',
      }),
    /GC-CORE-001/,
  )
})

test('requireBuildEnv lanza GC-CORE-001 sin DSN o release', () => {
  const base = {
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key-value',
    VITE_ENVIRONMENT: 'staging' as const,
  }
  assert.throws(() => requireBuildEnv({ ...base, VITE_RELEASE: 'r1' }), /GC-CORE-001/)
  assert.throws(() => requireBuildEnv({ ...base, VITE_SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0' }), /GC-CORE-001/)
})

test('requireBuildEnv devuelve config pública más sentry y release', () => {
  const cfg = requireBuildEnv({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key-value',
    VITE_ENVIRONMENT: 'production',
    VITE_SENTRY_DSN: 'https://public@o0.ingest.sentry.io/1',
    VITE_RELEASE: 'gate-3',
  })
  assert.equal(cfg.environment, 'production')
  assert.equal(cfg.sentryDsn, 'https://public@o0.ingest.sentry.io/1')
  assert.equal(cfg.release, 'gate-3')
})

test('vite.config registra enforceEnv sobre requireBuildEnv', () => {
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  assert.match(vite, /enforceEnv/)
  assert.match(vite, /requireBuildEnv/)
})
