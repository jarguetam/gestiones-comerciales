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
