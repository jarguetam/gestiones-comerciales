export function progresoJornada(items: { estado?: string | null }[]): { total: number; hechas: number; pct: number } {
  const total = items.length
  const hechas = items.filter((v) => ['completada', 'aprobada'].includes((v.estado ?? '').toLowerCase())).length
  const pct = total === 0 ? 0 : Math.round((hechas / total) * 100)
  return { total, hechas, pct }
}

export function formatearFechaJornada(iso: string, locale = 'es-GT'): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  const texto = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(dt)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
