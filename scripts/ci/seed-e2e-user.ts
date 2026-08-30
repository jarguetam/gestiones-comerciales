#!/usr/bin/env node
/**
 * Crea o actualiza usuarios sintéticos de staging vía Auth admin.
 * Service role solo en el job e2e-staging.
 */

type SeedUser = { email: string; password: string; role: 'asesor' | 'admin' }

export function stagingUsersFromEnv(env: NodeJS.ProcessEnv): SeedUser[] {
  const asesorPass = env.E2E_ASESOR_PASSWORD?.trim()
  const adminPass = env.E2E_ADMIN_PASSWORD?.trim()
  if (!asesorPass || !adminPass) {
    throw new Error('GC-OPS-008: faltan E2E_ASESOR_PASSWORD o E2E_ADMIN_PASSWORD')
  }
  return [
    { email: 'asesor@staging.test', password: asesorPass, role: 'asesor' },
    { email: 'admin@staging.test', password: adminPass, role: 'admin' },
  ]
}

export async function upsertAuthUser(
  baseUrl: string,
  serviceRole: string,
  user: SeedUser,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/auth/v1/admin/users`
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      apikey: serviceRole,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      app_metadata: { tenant_id: '00000000-0000-4000-8000-000000000001', rol: user.role },
    }),
  })
  if (res.status === 422) {
    return
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GC-OPS-008: no se pudo sembrar ${user.email}: ${res.status} ${body}`)
  }
}

async function main(env = process.env) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !service) {
    throw new Error('GC-OPS-008: faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  for (const user of stagingUsersFromEnv(env)) {
    await upsertAuthUser(url, service, user)
    console.log(`OK seed ${user.email}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
