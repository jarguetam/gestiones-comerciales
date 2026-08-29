import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  actualizarWebhookSecretRevelado,
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

test('webhookSecretStatusDeRpc acepta estado no configurado con metadata null', () => {
  assert.deepEqual(
    webhookSecretStatusDeRpc({
      tenantId: 'tenant-uuid',
      configurado: false,
      rotadoEn: null,
      last4: null,
    }),
    {
      tenantId: 'tenant-uuid',
      configurado: false,
      rotadoEn: null,
      last4: null,
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

test('webhookSecretRotadoDeRpc conserva el contrato histórico text', () => {
  assert.equal(
    webhookSecretRotadoDeRpc('secreto-emitido-una-vez'),
    'secreto-emitido-una-vez',
  )
  assert.throws(
    () => webhookSecretRotadoDeRpc({ secret: 'rompe-compatibilidad' }),
    /Respuesta de rotación de webhook inválida/,
  )
})

test('el plaintext se revela únicamente tras una rotación exitosa', () => {
  assert.deepEqual(
    actualizarWebhookSecretRevelado(null, {
      tipo: 'rotacion_exitosa',
      tenantId: 'tenant-uuid',
      respuesta: 'secreto-emitido-una-vez',
    }),
    {
      tenantId: 'tenant-uuid',
      secret: 'secreto-emitido-una-vez',
    },
  )
})

test('nueva rotación, descarte y cambio de tenant limpian el plaintext', () => {
  const revelado = {
    tenantId: 'tenant-uuid',
    secret: 'secreto-emitido-una-vez',
  }

  for (const tipo of ['rotacion_iniciada', 'descartado', 'tenant_cambiado'] as const) {
    assert.equal(
      actualizarWebhookSecretRevelado(revelado, { tipo }),
      null,
    )
  }
})
