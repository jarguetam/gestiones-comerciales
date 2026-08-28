export interface PuntoMapa {
  usuarioId: string
  nombre: string
  rol: string
  jefeId: string | null
  lat: number
  lng: number
  registradoEn: string
  precisionM?: number | null
}

export interface BoundsMapa {
  sur: number
  norte: number
  oeste: number
  este: number
}

export interface Coordenada {
  lat: number
  lng: number
}

function finito(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Extrae lat/lng de GeoJSON Point (coords [lng, lat]) o WKT POINT. */
export function coordenadasDe(posicion: unknown): Coordenada | null {
  if (posicion == null) return null
  if (typeof posicion === 'string') {
    const wkt = posicion.trim().replace(/^SRID=\d+;/i, '')
    const m = /^POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)$/i.exec(wkt)
    if (!m) return null
    const lng = Number(m[1])
    const lat = Number(m[2])
    return finito(lat) && finito(lng) ? { lat, lng } : null
  }
  if (typeof posicion !== 'object') return null
  const obj = posicion as { type?: string; coordinates?: unknown; geometry?: { type?: string; coordinates?: unknown } }
  const coords = obj.type === 'Point' ? obj.coordinates : obj.geometry?.type === 'Point' ? obj.geometry.coordinates : null
  if (!Array.isArray(coords) || coords.length < 2) return null
  const lng = Number(coords[0])
  const lat = Number(coords[1])
  return finito(lat) && finito(lng) ? { lat, lng } : null
}

export function ultimaPorAsesor(puntos: PuntoMapa[]): PuntoMapa[] {
  const porId = new Map<string, PuntoMapa>()
  for (const p of puntos) {
    const prev = porId.get(p.usuarioId)
    if (!prev || Date.parse(p.registradoEn) >= Date.parse(prev.registradoEn)) porId.set(p.usuarioId, p)
  }
  return [...porId.values()]
}

export function recorridoDe(puntos: PuntoMapa[], usuarioId: string): PuntoMapa[] {
  return puntos
    .filter((p) => p.usuarioId === usuarioId)
    .slice()
    .sort((a, b) => Date.parse(a.registradoEn) - Date.parse(b.registradoEn))
}

export function filtrarEquipo(puntos: PuntoMapa[], supervisorId: string | null | undefined): PuntoMapa[] {
  if (!supervisorId) return puntos
  return puntos.filter((p) => p.usuarioId === supervisorId || p.jefeId === supervisorId)
}

export function boundsDe(puntos: Array<Pick<PuntoMapa, 'lat' | 'lng'>>): BoundsMapa | null {
  if (puntos.length === 0) return null
  let sur = puntos[0].lat
  let norte = puntos[0].lat
  let oeste = puntos[0].lng
  let este = puntos[0].lng
  for (const p of puntos) {
    sur = Math.min(sur, p.lat)
    norte = Math.max(norte, p.lat)
    oeste = Math.min(oeste, p.lng)
    este = Math.max(este, p.lng)
  }
  return { sur, norte, oeste, este }
}
