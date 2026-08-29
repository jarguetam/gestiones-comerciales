/** Serialización de la cola M-09. El almacén (SQLite/KV) se inyecta; así se testea en Node. */

import type { EstadoCola, ItemCola, TipoMutacion } from './cola'

const TIPOS: TipoMutacion[] = [
  'visita_checkin',
  'visita_completar',
  'formulario_enviar',
  'deposito',
  'solicitud',
  'persona',
  'lead',
]
const ESTADOS: EstadoCola[] = ['pendiente', 'enviado', 'error']

export const PREFIJO_COLA = 'gc.cola.v1'

export function claveCola(userId: string): string {
  return `${PREFIJO_COLA}:${userId}`
}

export interface AlmacenCola {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

export function serializarCola(items: ItemCola[]): string {
  return JSON.stringify(items)
}

function esItemCola(raw: unknown): raw is ItemCola {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const o = raw as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    TIPOS.includes(o.tipo as TipoMutacion) &&
    ESTADOS.includes(o.estado as EstadoCola) &&
    typeof o.clienteKey === 'string' &&
    typeof o.intentos === 'number' &&
    typeof o.maxIntentos === 'number' &&
    typeof o.creadoEn === 'string' &&
    typeof o.proximoIntentoEn === 'number' &&
    o.payload !== null &&
    typeof o.payload === 'object' &&
    !Array.isArray(o.payload)
  )
}

export function hidratarColaJson(raw: string | null | undefined): ItemCola[] | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const items = parsed.filter(esItemCola)
    return items.length === parsed.length ? items : items
  } catch {
    return null
  }
}
