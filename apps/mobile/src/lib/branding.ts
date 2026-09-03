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

export function logoUrlValido(url: string | undefined | null): string | null {
  if (!url) return null
  const t = url.trim()
  if (!t || t.length > 2048) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    return u.href
  } catch {
    return null
  }
}

export function monograma(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'GC'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

function expandirHex(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim()
  if (!HEX.test(t)) return null
  const h = t.slice(1)
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/** Mezcla el primario con blanco para subtítulos sobre header de marca. */
export function tintaSobrePrimario(hex: string, mezcla = 0.72): string {
  const c = expandirHex(hex)
  if (!c) return 'rgba(255,255,255,0.8)'
  const r = Math.round(c.r + (255 - c.r) * mezcla)
  const g = Math.round(c.g + (255 - c.g) * mezcla)
  const b = Math.round(c.b + (255 - c.b) * mezcla)
  return `rgb(${r}, ${g}, ${b})`
}
