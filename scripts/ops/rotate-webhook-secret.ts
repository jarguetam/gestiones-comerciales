export async function rotateWebhookSecret(opts: {
  url: string
  serviceRole: string
  tenantId: string
  fetchImpl?: typeof fetch
}): Promise<{ last4: string; rotadoEn: string | null }> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const endpoint = `${opts.url.replace(/\/$/, '')}/rest/v1/rpc/admin_webhook_rotar_secret`
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      apikey: opts.serviceRole,
      Authorization: `Bearer ${opts.serviceRole}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_tenant_id: opts.tenantId }),
  })
  if (!res.ok) {
    throw new Error(`GC-OPS-008: rotación webhook falló (${res.status})`)
  }
  const body = (await res.json()) as { secret?: string; last4?: string; rotado_en?: string }
  const last4 = body.last4 ?? (typeof body.secret === 'string' ? body.secret.slice(-4) : '')
  if (!last4) throw new Error('GC-OPS-008: RPC no devolvió last4')
  const result = { last4, rotadoEn: body.rotado_en ?? null }
  console.log(JSON.stringify({ ok: true, tenant_id: opts.tenantId, last4: result.last4 }))
  return result
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tenantId = process.env.TENANT_ID
  if (!url || !service || !tenantId) {
    console.error('GC-OPS-008: faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o TENANT_ID')
    process.exit(1)
  }
  rotateWebhookSecret({ url, serviceRole: service, tenantId })
    .then((r) => {
      console.log(JSON.stringify({ ok: true, last4: r.last4 }))
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
