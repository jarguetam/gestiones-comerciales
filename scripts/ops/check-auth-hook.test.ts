import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAuthHookConfig } from './check-auth-hook.ts'

test('parseAuthHookConfig acepta hook_custom_access_token_enabled', () => {
  const r = parseAuthHookConfig({ hook_custom_access_token_enabled: true })
  assert.equal(r.ok, true)
  assert.equal(r.hookEnabled, true)
})

test('parseAuthHookConfig falla GC-OPS-003 si el hook está apagado', () => {
  const r = parseAuthHookConfig({ hook_custom_access_token_enabled: false })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'GC-OPS-003')
})

test('parseAuthHookConfig acepta custom_access_token.enabled anidado', () => {
  const r = parseAuthHookConfig({ custom_access_token: { enabled: true } })
  assert.equal(r.ok, true)
})
