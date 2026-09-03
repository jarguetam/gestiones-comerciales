import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Gate 1 / Task 17 — rota HMAC de webhook por tenant activo.
 * Usa PLATFORM_JWT (superadmin plataforma + AAL2) para RPC.
 * Lista tenants con SUPABASE_SERVICE_ROLE_KEY si está disponible.
 */
export type RotationRow = { tenant_id: string; secret: string }

async function rest<T>(
  base: string,
  key: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

export async function rotateAllWebhookSecrets(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: boolean; code?: string; message: string; rotated: RotationRow[] }> {
  const url = env.SUPABASE_URL?.trim()
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const platformJwt = env.PLATFORM_JWT?.trim()
  if (!url || !serviceKey) {
    return {
      ok: false,
      code: 'GC-OPS-001',
      message: 'GC-OPS-001: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY',
      rotated: [],
    }
  }
  if (!platformJwt) {
    return {
      ok: false,
      code: 'GC-OPS-006',
      message: 'GC-OPS-006: falta PLATFORM_JWT (superadmin plataforma con AAL2)',
      rotated: [],
    }
  }

  const tenants = await rest<{ id: string }[]>(
    url,
    serviceKey,
    '/rest/v1/tenant?activo=eq.true&select=id',
  )

  const rotated: RotationRow[] = []
  for (const t of tenants) {
    const secret = await rest<string>(url, platformJwt, '/rest/v1/rpc/admin_webhook_rotar_secret', {
      method: 'POST',
      body: JSON.stringify({ p_tenant_id: t.id }),
    })
    rotated.push({ tenant_id: t.id, secret })
  }

  return {
    ok: true,
    message: `Rotados ${rotated.length} tenants`,
    rotated,
  }
}

async function main() {
  const report = await rotateAllWebhookSecrets()
  console.log(JSON.stringify({ ok: report.ok, code: report.code, message: report.message, count: report.rotated.length }))
  if (!report.ok) process.exit(1)
}

const entry = process.argv[1]
if (entry && fileURLToPath(import.meta.url) === path.resolve(entry)) {
  main().catch((err: unknown) => {
    console.error(JSON.stringify({ ok: false, message: String(err) }))
    process.exit(1)
  })
}
