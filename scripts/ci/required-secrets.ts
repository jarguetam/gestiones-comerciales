export const STAGING_SECRETS = [
  'SUPABASE_PROJECT_REF',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
] as const

export const PRODUCTION_SECRETS = [
  'SUPABASE_PROJECT_REF',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
] as const

export type EnvironmentSecrets = 'staging' | 'production'

export function parseGhSecretList(output: string): string[] {
  const names: string[] = []
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^NAME\b/i.test(trimmed)) continue
    const name = trimmed.split(/\s+/)[0]
    if (name) names.push(name)
  }
  return names
}

export function missingSecrets(present: string[], required: readonly string[]): string[] {
  const have = new Set(present)
  return required.filter((name) => !have.has(name))
}
