import assert from 'node:assert/strict'
import test from 'node:test'
import { missingSecrets, parseGhSecretList, PRODUCTION_SECRETS, STAGING_SECRETS } from './required-secrets.ts'

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

test('producción exige organización y proyectos Sentry antes de Pages', () => {
  const present = [
    'SUPABASE_PROJECT_REF',
    'SUPABASE_DB_PASSWORD',
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SENTRY_DSN',
    'SENTRY_AUTH_TOKEN',
  ]
  assert.deepEqual(missingSecrets(present, PRODUCTION_SECRETS), [
    'SENTRY_ORG',
    'SENTRY_PROJECT_WEB',
    'SENTRY_PROJECT_BACKOFFICE',
  ])
})
