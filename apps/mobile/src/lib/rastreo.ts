/** Ventana e intervalo de rastreo (config_rastreo del tenant, no hardcode). */

import type { PuntoGps } from './tipos'

export interface ConfigRastreoDia {
  intervalo_min: number
  hora_inicio: string
  hora_fin: string
  precision_max_m?: number
}

export const TAMANO_LOTE_INGESTA = 3

/** `hora` en HH:MM:SS o HH:MM. */
export function enVentanaHoraria(hora: string, inicio: string, fin: string): boolean {
  const n = (h: string) => (h.length >= 8 ? h.slice(0, 8) : `${h}:00`.slice(0, 8))
  const t = n(hora)
  return t >= n(inicio) && t <= n(fin)
}

export function intervaloMs(intervaloMin: number | null | undefined): number {
  const min = Math.max(1, Math.min(240, intervaloMin ?? 15))
  return min * 60_000
}

export function loteListo(puntos: PuntoGps[], minimo = TAMANO_LOTE_INGESTA): boolean {
  return puntos.length >= minimo
}

export function tomarLote(cola: PuntoGps[], minimo = TAMANO_LOTE_INGESTA): { lote: PuntoGps[]; resto: PuntoGps[] } {
  if (!loteListo(cola, minimo)) return { lote: [], resto: cola }
  return { lote: cola.slice(0, minimo), resto: cola.slice(minimo) }
}

export function puntoDesdeCoords(coords: {
  latitude: number
  longitude: number
  accuracy?: number | null
  speed?: number | null
  timestamp?: number
}): PuntoGps {
  return {
    latitud: coords.latitude,
    longitud: coords.longitude,
    precision_m: coords.accuracy ?? null,
    velocidad_kmh: coords.speed != null ? coords.speed * 3.6 : null,
    registrado_en: new Date(coords.timestamp ?? Date.now()).toISOString(),
  }
}
