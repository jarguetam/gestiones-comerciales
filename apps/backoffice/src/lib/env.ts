export type EnvironmentName = 'local' | 'staging' | 'production'

export interface PublicSupabaseConfig {
  url: string
  anonKey: string
  environment: EnvironmentName
}

export function endpointCompatible(url: string, environment: EnvironmentName): boolean {
  const endpoint = /^(https?):\/\/(localhost|\[::1\]|[a-z0-9.-]+)(?::(\d{1,5}))?\/?$/i.exec(url)
  if (!endpoint || (endpoint[3] && (Number(endpoint[3]) < 1 || Number(endpoint[3]) > 65535))) return false
  const host = endpoint[2].toLowerCase()
  const octets = host.split('.').map(Number)
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) && octets.every((n) => n <= 255)
  const local = host === 'localhost' || host === '[::1]' || (ipv4 && (
    octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  ))
  return environment === 'local' ? local : endpoint[1].toLowerCase() === 'https' && !local
}

export function requirePublicConfig(input: {
  url?: string | null
  anonKey?: string | null
  environment: EnvironmentName
}): PublicSupabaseConfig {
  if (!input.url || !input.anonKey || !endpointCompatible(input.url, input.environment)) {
    throw new Error('GC-CORE-001: URL de Supabase incompatible con el entorno; local requiere loopback o LAN y producción requiere HTTPS público')
  }
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
