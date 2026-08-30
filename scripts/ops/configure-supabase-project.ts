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
    return { site_url: site, additional_redirect_urls: [site] }
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
  configureProject(process.env)
    .then((r) => {
      console.log(
        JSON.stringify({
          ok: r.ok,
          ref: r.ref,
          site_url: r.urls.site_url,
          hook: r.hook,
        }),
      )
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
