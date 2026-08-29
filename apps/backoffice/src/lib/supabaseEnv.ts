/** Detecta URL + anon key reales (no placeholders de .env.example). */

const PLACEHOLDER = /tu[_-]?anon|your[_-]?anon|changeme|reemplazar/i

export function credencialesPublicasValidas(
  url?: string | null,
  key?: string | null,
): boolean {
  const u = url?.trim() ?? ''
  const k = key?.trim() ?? ''
  if (!u || !k) return false
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u)) return false
  if (PLACEHOLDER.test(k) || k.length < 20) return false
  return true
}
