#!/usr/bin/env node
import { getJson, requireToken } from './supabase-mgmt.ts'

const API = 'https://api.supabase.com/v1'

export type ConfigureTarget = 'staging' | 'production'

export function requiredSmtpVars(env: NodeJS.ProcessEnv): string[] {
  const names = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_ADMIN_EMAIL']
  return names.filter((name) => !env[name]?.trim())
}

export function authUrlsFor(target: ConfigureTarget, pagesProdUrl?: string) {
  if (target === 'production') {
    const site = pagesProdUrl?.trim()
    if (!site) throw new Error('GC-OPS-008: falta PAGES_PROD_URL para production')
    // Web y backoffice piden recuperación a `<pathname>#/recuperar`; móvil a gc://recuperar.
    return { site_url: site, additional_redirect_urls: [`${site.replace(/\/?$/, '/')}**`, 'gc://recuperar'] }
  }
  return {
    site_url: 'http://127.0.0.1:4173',
    additional_redirect_urls: ['http://127.0.0.1:4173', 'http://localhost:5173'],
  }
}

export function assertSmtpOrThrow(env: NodeJS.ProcessEnv) {
  const missing = requiredSmtpVars(env)
  if (missing.length > 0) {
    throw new Error(`GC-OPS-008: faltan ${missing.join(', ')}`)
  }
}

export function assertSmtpEnabled(auth: { smtp?: { enabled?: boolean } | null }) {
  if (!auth.smtp?.enabled) throw new Error('GC-OPS-008: SMTP Auth no está habilitado')
}

/** Cuerpo de PATCH /v1/projects/{ref}/config/auth. */
export function authConfigPatch(target: ConfigureTarget, env: NodeJS.ProcessEnv) {
  assertSmtpOrThrow(env)
  const urls = authUrlsFor(target, env.PAGES_PROD_URL)
  return {
    site_url: urls.site_url,
    uri_allow_list: urls.additional_redirect_urls.join(','),
    smtp_host: env.SMTP_HOST!.trim(),
    smtp_port: env.SMTP_PORT!.trim(),
    smtp_user: env.SMTP_USER!.trim(),
    smtp_pass: env.SMTP_PASS!,
    smtp_admin_email: env.SMTP_ADMIN_EMAIL!.trim(),
    smtp_sender_name: env.SMTP_SENDER_NAME?.trim() || 'Gestiones Comerciales',
  }
}

function sinSecretos(patch: ReturnType<typeof authConfigPatch>) {
  return { ...patch, smtp_pass: '[redacted]' }
}

export function verifyAuthConfig(
  current: Record<string, unknown>,
  expected: ReturnType<typeof authConfigPatch>,
): string[] {
  const errores: string[] = []
  if (current.site_url !== expected.site_url) errores.push('site_url')
  if (current.uri_allow_list !== expected.uri_allow_list) errores.push('uri_allow_list')
  if (current.smtp_host !== expected.smtp_host) errores.push('smtp_host')
  return errores
}

/** CONFIGURE_APPLY=1 aplica y verifica; sin él solo muestra el cambio (sin secretos). */
export async function applyAuthConfig(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch) {
  const token = requireToken(env)
  const ref = env.SUPABASE_PROJECT_REF?.trim()
  const target = env.CONFIGURE_TARGET as ConfigureTarget
  if (!ref) throw new Error('GC-OPS-008: falta SUPABASE_PROJECT_REF')
  if (target !== 'staging' && target !== 'production') {
    throw new Error('GC-OPS-008: CONFIGURE_TARGET debe ser staging|production')
  }
  const patch = authConfigPatch(target, env)
  if (env.CONFIGURE_APPLY !== '1') return { applied: false, ref, patch: sinSecretos(patch) }

  const url = `${API}/projects/${ref}/config/auth`
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const res = await fetchImpl(url, { method: 'PATCH', headers, body: JSON.stringify(patch) })
  if (!res.ok) throw new Error(`GC-OPS-003: PATCH config/auth falló (${res.status})`)
  const check = await fetchImpl(url, { headers })
  if (!check.ok) throw new Error(`GC-OPS-002: no se pudo releer config/auth (${check.status})`)
  const errores = verifyAuthConfig((await check.json()) as Record<string, unknown>, patch)
  if (errores.length > 0) throw new Error(`GC-OPS-008: config Auth no quedó aplicada: ${errores.join(', ')}`)
  return { applied: true, ref, patch: sinSecretos(patch) }
}

export async function configureProject(env: NodeJS.ProcessEnv) {
  const token = requireToken(env)
  const ref = env.SUPABASE_PROJECT_REF?.trim()
  const target = env.CONFIGURE_TARGET as ConfigureTarget
  if (!ref) throw new Error('GC-OPS-008: falta SUPABASE_PROJECT_REF')
  if (target !== 'staging' && target !== 'production') {
    throw new Error('GC-OPS-008: CONFIGURE_TARGET debe ser staging|production')
  }
  assertSmtpOrThrow(env)
  const urls = authUrlsFor(target, env.PAGES_PROD_URL)
  const { status, body } = await getJson(`${API}/projects/${ref}`, token)
  if (status >= 400) {
    throw new Error(`GC-OPS-003: no puede leer proyecto (${status})`)
  }
  return { ok: true, ref, urls, project: body, hook: 'custom_access_token' }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyAuthConfig(process.env)
    .then((r) => {
      console.log(JSON.stringify(r, null, 2))
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
