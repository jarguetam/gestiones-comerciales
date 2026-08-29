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
