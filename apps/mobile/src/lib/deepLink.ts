/** Deep-links `gestiones://{recurso}/{id}` (spec §3.4). */

export type TabDeepLink = 'agenda' | 'solicitudes' | 'personas' | 'leads' | 'notificaciones'

export interface DestinoDeepLink {
  tab: TabDeepLink
  id: string
}

const RE = /^gestiones:\/\/(?:[^/]+\/)?(visita|solicitud|persona|lead)\/([^/?#]+)/i

export function parseDeepLink(url: string | null | undefined): DestinoDeepLink | null {
  if (!url) return null
  const m = url.match(RE)
  if (!m) return null
  const recurso = m[1].toLowerCase()
  const id = decodeURIComponent(m[2])
  if (recurso === 'visita') return { tab: 'agenda', id }
  if (recurso === 'solicitud') return { tab: 'solicitudes', id }
  if (recurso === 'persona') return { tab: 'personas', id }
  if (recurso === 'lead') return { tab: 'leads', id }
  return null
}
