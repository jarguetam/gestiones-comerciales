export interface BrandingTenant {
  nombre_comercial?: string
  color_primario?: string
  logo_url?: string
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const COLOR_DEFAULT = '#1D4ED8'

export function colorHexValido(c: string | undefined | null): string | null {
  if (!c) return null
  const t = c.trim()
  return HEX.test(t) ? t : null
}

export function colorPrimario(b: BrandingTenant | null | undefined): string {
  return colorHexValido(b?.color_primario) ?? COLOR_DEFAULT
}

export function nombreComercial(b: BrandingTenant | null | undefined, fallback: string): string {
  const n = b?.nombre_comercial?.trim()
  return n && n.length > 0 ? n : fallback
}

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

export const BRANDING_DEMO: BrandingTenant = {
  nombre_comercial: 'AgroMoney S.A.',
  color_primario: '#1D4ED8',
}
