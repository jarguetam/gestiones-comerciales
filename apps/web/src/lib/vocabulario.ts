import type { BrandingTenant } from './branding'

export type ClaveVocabulario = 'persona' | 'visita' | 'lead' | 'solicitud'

const FALLBACK: Record<ClaveVocabulario, { singular: string; plural: string }> = {
  persona: { singular: 'Persona', plural: 'Personas' },
  visita: { singular: 'Visita', plural: 'Visitas' },
  lead: { singular: 'Lead', plural: 'Leads' },
  solicitud: { singular: 'Solicitud', plural: 'Solicitudes' },
}

export function vocabularioDe(b: BrandingTenant | null | undefined): Partial<Record<ClaveVocabulario, string>> {
  return b?.vocabulario ?? {}
}

/** Label de nav/header. Si el JSON trae un string, se usa tal cual (plural o singular a criterio del tenant). */
export function etiquetaVocab(
  b: BrandingTenant | null | undefined,
  clave: ClaveVocabulario,
  fallback?: string,
): string {
  const raw = b?.vocabulario?.[clave]
  const t = typeof raw === 'string' ? raw.trim() : ''
  if (t) return t
  return fallback ?? FALLBACK[clave].plural
}
