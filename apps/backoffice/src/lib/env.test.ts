import assert from 'node:assert/strict'
import test from 'node:test'
import { requirePublicConfig } from './env.ts'

test('requirePublicConfig falla cerrado sin anon', () => {
  assert.throws(
    () => requirePublicConfig({ url: 'https://example.supabase.co', environment: 'local' }),
    /GC-CORE-001/,
  )
})
