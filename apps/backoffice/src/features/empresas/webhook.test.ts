import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ejemploCurlWebhook, urlWebhookTenant } from './webhook.ts'

test('urlWebhookTenant apunta a functions/v1/webhook-tenant', () => {
  assert.equal(
    urlWebhookTenant('https://xcoeipsnykceorcvjwve.supabase.co'),
    'https://xcoeipsnykceorcvjwve.supabase.co/functions/v1/webhook-tenant',
  )
  assert.equal(urlWebhookTenant(undefined), 'https://<proyecto>.supabase.co/functions/v1/webhook-tenant')
})

test('ejemploCurlWebhook incluye HMAC y tenant', () => {
  const curl = ejemploCurlWebhook('https://ejemplo.supabase.co', 'tenant-uuid')
  assert.match(curl, /X-GC-Signature/)
  assert.match(curl, /X-GC-Tenant-Id: tenant-uuid/)
  assert.match(curl, /webhook-tenant/)
})
