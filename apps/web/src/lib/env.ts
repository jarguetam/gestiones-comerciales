export type EnvironmentName = 'local' | 'staging' | 'production'

export interface PublicSupabaseConfig {
  url: string
  anonKey: string
  environment: EnvironmentName
}

export function requirePublicConfig(input: {
  url?: string | null
  anonKey?: string | null
  environment: EnvironmentName
}): PublicSupabaseConfig {
  if (!input.url || !input.anonKey) throw new Error('GC-CORE-001')
  return { url: input.url, anonKey: input.anonKey, environment: input.environment }
}

export function environmentFromVite(value?: string | null): EnvironmentName {
  if (value === 'staging' || value === 'production' || value === 'local') return value
  return 'local'
}

export interface PublicBuildConfig extends PublicSupabaseConfig {
  sentryDsn: string
  release: string
}

export function requireBuildEnv(env: Record<string, string | undefined>): PublicBuildConfig {
  const cfg = requirePublicConfig({
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    environment: environmentFromVite(env.VITE_ENVIRONMENT),
  })
  if (!env.VITE_SENTRY_DSN || !env.VITE_RELEASE) throw new Error('GC-CORE-001')
  return { ...cfg, sentryDsn: env.VITE_SENTRY_DSN, release: env.VITE_RELEASE }
}
