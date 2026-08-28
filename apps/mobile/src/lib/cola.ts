/** M-09 — cola local de mutaciones (pendiente | enviado | error) con backoff. */

export type EstadoCola = 'pendiente' | 'enviado' | 'error'

export type TipoMutacion =
  | 'visita_checkin'
  | 'visita_completar'
  | 'formulario_enviar'
  | 'deposito'
  | 'solicitud'
  | 'persona'
  | 'lead'

export interface ItemCola {
  id: string
  tipo: TipoMutacion
  payload: Record<string, unknown>
  estado: EstadoCola
  intentos: number
  maxIntentos: number
  clienteKey: string
  ultimoError?: string
  creadoEn: string
  proximoIntentoEn: number
}

export interface AltaCola {
  tipo: TipoMutacion
  payload: Record<string, unknown>
  clienteKey: string
  ahora?: number
  id?: string
}

const MAX_BACKOFF_MS = 60_000

export function backoffMs(intentos: number): number {
  const n = Math.max(1, intentos)
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (n - 1))
}

function nuevoId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function encolar(items: ItemCola[], alta: AltaCola): ItemCola[] {
  const duplicado = items.find((i) => i.clienteKey === alta.clienteKey && i.estado !== 'enviado')
  if (duplicado) return items
  const ahora = alta.ahora ?? Date.now()
  const item: ItemCola = {
    id: alta.id ?? nuevoId(),
    tipo: alta.tipo,
    payload: alta.payload,
    estado: 'pendiente',
    intentos: 0,
    maxIntentos: 5,
    clienteKey: alta.clienteKey,
    creadoEn: new Date(ahora).toISOString(),
    proximoIntentoEn: 0,
  }
  return [...items, item]
}

export function contarPendientes(items: ItemCola[]): number {
  return items.filter((i) => i.estado === 'pendiente' || (i.estado === 'error' && i.intentos < i.maxIntentos)).length
}

export function reintentables(items: ItemCola[], ahora: number): ItemCola[] {
  return items.filter(
    (i) =>
      (i.estado === 'pendiente' || i.estado === 'error') &&
      i.intentos < i.maxIntentos &&
      i.proximoIntentoEn <= ahora,
  )
}

export function marcarEnviado(items: ItemCola[], id: string): ItemCola[] {
  return items.map((i) => (i.id === id ? { ...i, estado: 'enviado' as const, ultimoError: undefined } : i))
}

export function marcarError(items: ItemCola[], id: string, error: string, ahora = Date.now()): ItemCola[] {
  return items.map((i) => {
    if (i.id !== id) return i
    const intentos = i.intentos + 1
    return {
      ...i,
      estado: 'error' as const,
      intentos,
      ultimoError: error,
      proximoIntentoEn: ahora + backoffMs(intentos),
    }
  })
}

export async function procesarCola(
  items: ItemCola[],
  ejecutar: (item: ItemCola) => Promise<void>,
  ahora = Date.now(),
): Promise<ItemCola[]> {
  let next = items
  for (const item of reintentables(items, ahora)) {
    try {
      await ejecutar(item)
      next = marcarEnviado(next, item.id)
    } catch (err) {
      next = marcarError(next, item.id, err instanceof Error ? err.message : 'error', ahora)
    }
  }
  return next
}

export function resumenCola(items: ItemCola[]): { pendientes: number; errores: number; enviados: number } {
  return {
    pendientes: items.filter((i) => i.estado === 'pendiente').length,
    errores: items.filter((i) => i.estado === 'error').length,
    enviados: items.filter((i) => i.estado === 'enviado').length,
  }
}

export function demoCola(): ItemCola[] {
  return [
    {
      id: 'd1',
      tipo: 'visita_checkin',
      payload: { visitaId: 104, latitud: 14.63, longitud: -90.51 },
      estado: 'pendiente',
      intentos: 0,
      maxIntentos: 5,
      clienteKey: 'visita_checkin:104',
      creadoEn: '2026-08-28T12:05:00.000Z',
      proximoIntentoEn: 0,
    },
    {
      id: 'd2',
      tipo: 'formulario_enviar',
      payload: { plantillaId: 1, respuestas: { cultivo: 'Maíz' } },
      estado: 'pendiente',
      intentos: 0,
      maxIntentos: 5,
      clienteKey: 'formulario:1:demo',
      creadoEn: '2026-08-28T12:08:00.000Z',
      proximoIntentoEn: 0,
    },
    {
      id: 'd3',
      tipo: 'deposito',
      payload: { monto: 2500, referencia: 'BOLETA-1044' },
      estado: 'error',
      intentos: 2,
      maxIntentos: 5,
      clienteKey: 'deposito:1044',
      ultimoError: 'GC-NET: sin cobertura',
      creadoEn: '2026-08-28T11:40:00.000Z',
      proximoIntentoEn: Date.now() + 30_000,
    },
    {
      id: 'd4',
      tipo: 'solicitud',
      payload: { descripcion: 'Crédito avío' },
      estado: 'enviado',
      intentos: 1,
      maxIntentos: 5,
      clienteKey: 'solicitud:1',
      creadoEn: '2026-08-28T10:00:00.000Z',
      proximoIntentoEn: 0,
    },
  ]
}
