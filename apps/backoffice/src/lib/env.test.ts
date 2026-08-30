import assert from 'node:assert/strict'
import test from 'node:test'
import { requireBuildEnv, requirePublicConfig } from './env.ts'

test('requirePublicConfig falla cerrado sin anon', () => {
  assert.throws(
    () => requirePublicConfig({ url: 'https://example.supabase.co', environment: 'local' }),
    /GC-CORE-001/,
  )
})

test('requireBuildEnv lanza GC-CORE-001 sin DSN', () => {
  assert.throws(
    () =>
      requireBuildEnv({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key-value',
        VITE_ENVIRONMENT: 'local',
        VITE_RELEASE: 'bo',
      }),
    /GC-CORE-001/,
  )
})
