declare const process: { env: Record<string, string | undefined> }

const PLACEHOLDER = /tu[_-]?anon|your[_-]?anon|changeme|reemplazar/i

function credencialesOk(url: string | undefined, key: string | undefined, environment: string): boolean {
  const u = url?.trim() ?? ''
  const k = key?.trim() ?? ''
  if (!u || !k) return false
  if (PLACEHOLDER.test(k) || k.length < 20) return false
  if (environment === 'production' || environment === 'staging') {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u)
  }
  if (environment !== 'local') return false
  // Evita depender de las propiedades URL no implementadas por algunas versiones de RN.
  const endpoint = /^https?:\/\/(localhost|\[::1\]|(?:\d{1,3}\.){3}\d{1,3})(?::(\d{1,5}))?\/?$/i.exec(u)
  if (!endpoint || (endpoint[2] && (Number(endpoint[2]) < 1 || Number(endpoint[2]) > 65535))) return false
  const host = endpoint[1].toLowerCase()
  if (host === 'localhost' || host === '[::1]') return true
  const octets = host.split('.').map(Number)
  if (octets.some((n) => n > 255)) return false
  return octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
}

export function requireMobileEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'local'
  if (!url || !key || !credencialesOk(url, key, environment)) {
    throw new Error('Configuración EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY incompatible con EXPO_PUBLIC_ENVIRONMENT (GC-CORE-001)')
  }
  return { url, key, sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN }
}
