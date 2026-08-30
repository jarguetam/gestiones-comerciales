declare const process: { env: Record<string, string | undefined> }

const PLACEHOLDER = /tu[_-]?anon|your[_-]?anon|changeme|reemplazar/i

function credencialesOk(url?: string, key?: string): boolean {
  const u = url?.trim() ?? ''
  const k = key?.trim() ?? ''
  if (!u || !k) return false
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u)) return false
  if (PLACEHOLDER.test(k) || k.length < 20) return false
  return true
}

export function requireMobileEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !credencialesOk(url, key)) {
    throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY (GC-CORE-001)')
  }
  return { url, key, sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN }
}
