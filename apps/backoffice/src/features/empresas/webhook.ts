export interface WebhookSecretStatus {
  tenantId: string
  configurado: boolean
  rotadoEn: string | null
  last4: string | null
}

export interface WebhookSecretRotado {
  secret: string
  status: WebhookSecretStatus
}

function objetoRpc(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('estado de webhook inválido')
  }
  return value as Record<string, unknown>
}

export function webhookSecretStatusDeRpc(value: unknown): WebhookSecretStatus {
  const data = objetoRpc(value)
  if (
    Object.hasOwn(data, 'secret')
    || typeof data.tenantId !== 'string'
    || typeof data.configurado !== 'boolean'
    || (data.rotadoEn !== null && typeof data.rotadoEn !== 'string')
    || (data.last4 !== null && typeof data.last4 !== 'string')
  ) {
    throw new Error('estado de webhook inválido')
  }

  return {
    tenantId: data.tenantId,
    configurado: data.configurado,
    rotadoEn: data.rotadoEn,
    last4: data.last4,
  }
}

export function webhookSecretRotadoDeRpc(value: unknown): WebhookSecretRotado {
  const data = objetoRpc(value)
  if (typeof data.secret !== 'string' || data.secret.length === 0) {
    throw new Error('Respuesta de rotación de webhook inválida')
  }

  const { secret, ...statusData } = data
  return {
    secret,
    status: webhookSecretStatusDeRpc(statusData),
  }
}

export function urlWebhookTenant(base: string | undefined): string {
  if (!base) return 'https://<proyecto>.supabase.co/functions/v1/webhook-tenant'
  return `${base.replace(/\/$/, '')}/functions/v1/webhook-tenant`
}

export function ejemploCurlWebhook(base: string, tenantId: string): string {
  const url = urlWebhookTenant(base)
  return [
    `curl -X POST '${url}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'X-GC-Tenant-Id: ${tenantId}' \\`,
    `  -H 'X-GC-Signature: $(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)' \\`,
    `  -d "$BODY"`,
  ].join('\n')
}
