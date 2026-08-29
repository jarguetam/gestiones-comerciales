export type VisitaJornada = {
  date?: string
  estado?: string | null
  startTime?: string
  title?: string
  personaName?: string | null
  location?: string | null
  zonaNombre?: string | null
}

const HECHAS = new Set(['completada', 'aprobada'])

export function visitasDelDia(items: VisitaJornada[], fecha: string): VisitaJornada[] {
  return items.filter((v) => v.date === fecha)
}

export function progresoJornada(items: VisitaJornada[]): { total: number; hechas: number; pct: number } {
  const total = items.length
  const hechas = items.filter((v) => HECHAS.has((v.estado ?? '').toLowerCase())).length
  const pct = total === 0 ? 0 : Math.round((hechas / total) * 100)
  return { total, hechas, pct }
}

export function fechaJornada(items: VisitaJornada[], hoy = '2026-08-29'): string {
  if (items.some((v) => v.date === hoy)) return hoy
  const fechas = items.map((v) => v.date).filter((d): d is string => Boolean(d)).sort()
  return fechas[0] ?? hoy
}

export function formatearFechaJornada(iso: string, locale = 'es-GT'): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  const texto = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(dt)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function etiquetaLugar(v: VisitaJornada): string {
  return v.zonaNombre || v.location || 'Sin zona'
}
