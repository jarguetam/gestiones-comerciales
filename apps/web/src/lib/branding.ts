export interface BrandingTenant {
  nombre_comercial?: string
  color_primario?: string
  logo_url?: string
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function brandingDeJson(raw: unknown): BrandingTenant {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const nombre =
    typeof o.nombre_comercial === 'string'
      ? o.nombre_comercial
      : typeof o.nombre === 'string'
        ? o.nombre
        : undefined
  return {
    nombre_comercial: nombre,
    color_primario: typeof o.color_primario === 'string' ? o.color_primario : undefined,
    logo_url: typeof o.logo_url === 'string' ? o.logo_url : undefined,
  }
}

export function colorCssValido(c: string | undefined | null): string | null {
  if (!c) return null
  const t = c.trim()
  return HEX.test(t) ? t : null
}

export function varsDeBranding(b: BrandingTenant | null | undefined): Record<string, string> {
  const color = colorCssValido(b?.color_primario)
  return color ? { '--gc-primary': color } : {}
}

export function nombreComercial(b: BrandingTenant | null | undefined, fallback: string): string {
  const n = b?.nombre_comercial?.trim()
  return n && n.length > 0 ? n : fallback
}

export const BRANDING_DEMO: BrandingTenant = {
  nombre_comercial: 'AgroMoney S.A.',
  color_primario: '#6D28D9',
}
