import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  ejemploCurlWebhook,
  urlWebhookTenant,
  webhookSecretRotadoDeRpc,
  webhookSecretStatusDeRpc,
} from './webhook.ts'

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

test('webhookSecretStatusDeRpc acepta el estado canónico sin plaintext', () => {
  assert.deepEqual(
    webhookSecretStatusDeRpc({
      tenantId: 'tenant-uuid',
      configurado: true,
      rotadoEn: '2026-08-29T23:30:00+00:00',
      last4: 'c0de',
    }),
    {
      tenantId: 'tenant-uuid',
      configurado: true,
      rotadoEn: '2026-08-29T23:30:00+00:00',
      last4: 'c0de',
    },
  )
})

test('webhookSecretStatusDeRpc rechaza respuestas que expongan plaintext', () => {
  assert.throws(
    () =>
      webhookSecretStatusDeRpc({
        tenantId: 'tenant-uuid',
        configurado: true,
        rotadoEn: '2026-08-29T23:30:00+00:00',
        last4: 'c0de',
        secret: 'no-debe-estar-aqui',
      }),
    /estado de webhook inválido/,
  )
})

test('webhookSecretRotadoDeRpc separa plaintext y estado de una rotación', () => {
  assert.deepEqual(
    webhookSecretRotadoDeRpc({
      tenantId: 'tenant-uuid',
      configurado: true,
      rotadoEn: '2026-08-29T23:30:00+00:00',
      last4: 'c0de',
      secret: 'secreto-emitido-una-vez',
    }),
    {
      secret: 'secreto-emitido-una-vez',
      status: {
        tenantId: 'tenant-uuid',
        configurado: true,
        rotadoEn: '2026-08-29T23:30:00+00:00',
        last4: 'c0de',
      },
    },
  )
})
