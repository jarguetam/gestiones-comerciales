import assert from 'node:assert/strict'
import test from 'node:test'
import { missingSecrets, parseGhSecretList, STAGING_SECRETS } from './required-secrets.ts'

test('parseGhSecretList extrae nombres de la tabla gh', () => {
  const out = `NAME	UPDATED
SUPABASE_PROJECT_REF	2026-08-29
VITE_SUPABASE_URL	2026-08-29
`
  assert.deepEqual(parseGhSecretList(out), ['SUPABASE_PROJECT_REF', 'VITE_SUPABASE_URL'])
})

test('missingSecrets lista los requeridos ausentes', () => {
  const missing = missingSecrets(['VITE_SUPABASE_URL'], ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  assert.deepEqual(missing, ['VITE_SUPABASE_ANON_KEY'])
})

test('staging exige service_role; production no en la lista de Pages', () => {
  assert.ok(STAGING_SECRETS.includes('SUPABASE_SERVICE_ROLE_KEY'))
})
