import assert from 'node:assert/strict'
import test from 'node:test'
import { environmentFromVite, requirePublicConfig } from '../src/lib/env.ts'

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
