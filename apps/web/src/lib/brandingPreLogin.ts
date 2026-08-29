import { BRANDING_DEMO, brandingDeJson, type BrandingTenant } from './branding.ts'

export const LS_BRANDING_ULTIMO = 'gc.branding.ultimo'
export const LS_BRANDING_HOST_PREFIX = 'gc.branding.host.'
export const LS_BRANDING_CODIGO_PREFIX = 'gc.branding.codigo.'

/**
 * Gap: no hay RPC público host/codigo → tenant.branding (tenant_select es
 * authenticated + propio tenant; filtrar todos los tenants al anon sería inseguro).
 * Pre-sesión: ?tenant= / localStorage de la última sesión / DEMO.
 */

export function slugTenantDeUrl(search: string, hash: string): string | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('tenant')
  if (q?.trim()) return q.trim().toLowerCase()
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const h = new URLSearchParams(hashQuery).get('tenant')
  return h?.trim().toLowerCase() || null
}

export function claveHost(host: string): string {
  return `${LS_BRANDING_HOST_PREFIX}${host.toLowerCase()}`
}

export function claveCodigo(codigo: string): string {
  return `${LS_BRANDING_CODIGO_PREFIX}${codigo.trim().toLowerCase()}`
}

export function parseBrandingCache(raw: string | null): BrandingTenant | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    const b = brandingDeJson(parsed)
    return Object.keys(b).length > 0 ? b : null
  } catch {
    return null
  }
}

export function guardarBrandingCache(
  branding: BrandingTenant,
  opts: { host: string; codigo?: string | null },
): void {
  if (typeof localStorage === 'undefined') return
  const payload = JSON.stringify(branding)
  localStorage.setItem(LS_BRANDING_ULTIMO, payload)
  if (opts.host) localStorage.setItem(claveHost(opts.host), payload)
  if (opts.codigo?.trim()) localStorage.setItem(claveCodigo(opts.codigo), payload)
}

export function leerBrandingCache(opts: {
  host: string
  codigo?: string | null
  storage?: Pick<Storage, 'getItem'>
}): BrandingTenant | null {
  const st = opts.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  if (!st) return null
  if (opts.codigo?.trim()) {
    const porCodigo = parseBrandingCache(st.getItem(claveCodigo(opts.codigo)))
    if (porCodigo) return porCodigo
  }
  const porHost = parseBrandingCache(st.getItem(claveHost(opts.host)))
  if (porHost) return porHost
  return parseBrandingCache(st.getItem(LS_BRANDING_ULTIMO))
}

export function brandingPreLogin(opts: {
  demo: boolean
  host: string
  search: string
  hash: string
  storage?: Pick<Storage, 'getItem'>
}): BrandingTenant {
  const slug = slugTenantDeUrl(opts.search, opts.hash)
  const cache = leerBrandingCache({ host: opts.host, codigo: slug, storage: opts.storage })
  if (cache) return cache
  if (opts.demo) return BRANDING_DEMO
  return {}
}
