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

export function varsFaltantesSupabase(
  url?: string | null,
  key?: string | null,
  nombres: { url: string; key: string } = {
    url: 'EXPO_PUBLIC_SUPABASE_URL',
    key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  },
): string[] {
  const falta: string[] = []
  if (!credencialesPublicasValidas(url, key)) {
    const u = url?.trim() ?? ''
    const k = key?.trim() ?? ''
    if (!u || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u)) falta.push(nombres.url)
    if (!k || PLACEHOLDER.test(k) || k.length < 20) falta.push(nombres.key)
  }
  return falta
}

export function mensajePreviewSinBackend(faltantes: string[]): string {
  if (faltantes.length === 0) {
    return 'Conectado a Supabase. Podés ingresar con tu cuenta o entrar en demostración.'
  }
  return (
    `Este APK de releases/ es preview DEMO: no está conectado al backend. ` +
    `Falta ${faltantes.join(' y ')} en el build. ` +
    `Recompilá con esas variables (ver apps/mobile/.env.example y scripts/build-apk.sh).`
  )
}
