/** Detecta URL + anon key reales (no placeholders de .env.example). */
import { endpointCompatible, type EnvironmentName } from './env.ts'

const PLACEHOLDER = /tu[_-]?anon|your[_-]?anon|changeme|reemplazar/i

export function credencialesPublicasValidas(
  url?: string | null,
  key?: string | null,
  environment: EnvironmentName = 'production',
): boolean {
  const u = url?.trim() ?? ''
  const k = key?.trim() ?? ''
  if (!u || !k) return false
  if (!endpointCompatible(u, environment)) return false
  if (PLACEHOLDER.test(k) || k.length < 20) return false
  return true
}
