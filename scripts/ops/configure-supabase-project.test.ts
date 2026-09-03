import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSmtpEnabled, assertSmtpOrThrow, authUrlsFor, requiredSmtpVars } from './configure-supabase-project.ts'

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
