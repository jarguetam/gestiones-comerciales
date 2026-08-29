export const PAGE_SIZE_VISITAS = 10

export const ESTADOS_VISITA = ['todas', 'programada', 'completada', 'aprobada', 'rechazada', 'anulada'] as const
export type FiltroEstadoVisita = (typeof ESTADOS_VISITA)[number]

export interface FiltrosVisita {
  estado: FiltroEstadoVisita
  asesor: string
  zona: string
  desde: string
  hasta: string
  pagina: number
}

export interface VisitaFiltrable {
  estado?: string | null
  date: string
  asesorId?: string
  zonaId?: number | string
}

const ESTADOS_SET = new Set<string>(ESTADOS_VISITA)

export function parseFiltrosVisita(params: URLSearchParams): FiltrosVisita {
  const estadoRaw = params.get('estado') ?? 'todas'
  const estado = ESTADOS_SET.has(estadoRaw) ? (estadoRaw as FiltroEstadoVisita) : 'todas'
  const pagina = Math.max(1, Number(params.get('pagina') ?? '1') || 1)
  return {
    estado,
    asesor: params.get('asesor') ?? '',
    zona: params.get('zona') ?? '',
    desde: params.get('desde') ?? '',
    hasta: params.get('hasta') ?? '',
    pagina,
  }
}

export function serializarFiltrosVisita(f: FiltrosVisita): URLSearchParams {
  const p = new URLSearchParams()
  if (f.estado && f.estado !== 'todas') p.set('estado', f.estado)
  if (f.asesor) p.set('asesor', f.asesor)
  if (f.zona) p.set('zona', f.zona)
  if (f.desde) p.set('desde', f.desde)
  if (f.hasta) p.set('hasta', f.hasta)
  if (f.pagina > 1) p.set('pagina', String(f.pagina))
  return p
}

export function filtrarVisitas<T extends VisitaFiltrable>(items: T[], f: FiltrosVisita): T[] {
  return items.filter((v) => {
    if (f.estado !== 'todas' && (v.estado ?? 'programada') !== f.estado) return false
    if (f.asesor && v.asesorId !== f.asesor) return false
    if (f.zona && String(v.zonaId ?? '') !== f.zona) return false
    if (f.desde && v.date < f.desde) return false
    if (f.hasta && v.date > f.hasta) return false
    return true
  })
}

export function paginar<T>(items: T[], pagina: number, size = PAGE_SIZE_VISITAS): {
  slice: T[]
  total: number
  paginas: number
} {
  const total = items.length
  const paginas = Math.max(1, Math.ceil(total / size))
  const p = Math.min(Math.max(1, pagina), paginas)
  const start = (p - 1) * size
  return { slice: items.slice(start, start + size), total, paginas }
}
