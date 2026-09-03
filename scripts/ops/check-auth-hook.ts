/**
 * Gate 1 / Task 15 — verifica que el hook custom_access_token esté habilitado.
 * No imprime secretos JWT.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson, requireToken } from './supabase-mgmt.ts'

const DEFAULT_REF = 'xcoeipsnykceorcvjwve'

export type AuthHookReport = {
  ok: boolean
  code?: string
  message: string
  hookEnabled?: boolean
}

export function parseAuthHookConfig(body: unknown): AuthHookReport {
  const cfg = body as {
    hook_custom_access_token_enabled?: boolean
    HOOK_CUSTOM_ACCESS_TOKEN_ENABLED?: boolean
    custom_access_token?: { enabled?: boolean }
  }
  const enabled =
    cfg.hook_custom_access_token_enabled === true
    || cfg.HOOK_CUSTOM_ACCESS_TOKEN_ENABLED === true
    || cfg.custom_access_token?.enabled === true

  if (!enabled) {
    return {
      ok: false,
      code: 'GC-OPS-003',
      message: 'GC-OPS-003: custom_access_token hook deshabilitado en Auth',
      hookEnabled: false,
    }
  }
  return {
    ok: true,
    message: 'custom_access_token hook habilitado',
    hookEnabled: true,
  }
}

export async function checkAuthHook(
  env: NodeJS.ProcessEnv = process.env,
  projectRef = env.SUPABASE_PROJECT_REF?.trim() || DEFAULT_REF,
): Promise<AuthHookReport> {
  const token = requireToken(env)
  const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`
  const { status, body } = await getJson(url, token)
  if (status !== 200) {
    return {
      ok: false,
      code: 'GC-OPS-002',
      message: `GC-OPS-002: no se pudo leer config Auth (HTTP ${status})`,
    }
  }
  return parseAuthHookConfig(body)
}

async function main() {
  const report = await checkAuthHook()
  console.log(JSON.stringify({ ok: report.ok, code: report.code, message: report.message }))
  if (!report.ok) process.exit(1)
}

const entry = process.argv[1]
if (entry && fileURLToPath(import.meta.url) === path.resolve(entry)) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ ok: false, message: msg }))
    process.exit(1)
  })
}
