/**
 * Servicio de rastreo de campo. Vive a nivel de App (no de una pantalla)
 * y envía lotes a Edge `rastreo-ingesta`.
 */
import * as Location from 'expo-location'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  enVentanaHoraria,
  intervaloMs,
  tomarLote,
  puntoDesdeCoords,
  type ConfigRastreoDia,
} from '../lib/rastreo'
import type { PuntoGps } from '../lib/tipos'

declare const process: { env: Record<string, string | undefined> }

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1`

export const TEXTO_PERMISO_UBICACION =
  'Durante tu jornada la app registra la ubicación para el check-in de visitas y el rastreo que configuró tu empresa. Podés apagarlo en Ajustes.'

let timer: ReturnType<typeof setInterval> | null = null
let cola: PuntoGps[] = []
let activo = false

export function rastreoActivo(): boolean {
  return activo
}

async function flushLote(cliente: SupabaseClient): Promise<void> {
  const { lote, resto } = tomarLote(cola)
  if (!lote.length) return
  cola = resto
  const { data: sesion } = await cliente.auth.getSession()
  const token = sesion.session?.access_token
  if (!token || !FUNCTIONS_URL) {
    cola = [...lote, ...cola]
    return
  }
  try {
    const res = await fetch(`${FUNCTIONS_URL}/rastreo-ingesta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ puntos: lote }),
    })
    if (!res.ok) cola = [...lote, ...cola]
  } catch {
    cola = [...lote, ...cola]
  }
}

export async function detenerRastreo(cliente?: SupabaseClient): Promise<void> {
  activo = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (cliente && cola.length) {
    const pendiente = [...cola]
    cola = []
    const { data: sesion } = await cliente.auth.getSession()
    const token = sesion.session?.access_token
    if (token && FUNCTIONS_URL) {
      await fetch(`${FUNCTIONS_URL}/rastreo-ingesta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ puntos: pendiente }),
      }).catch(() => {
        cola = [...pendiente, ...cola]
      })
    } else {
      cola = [...pendiente, ...cola]
    }
  }
}

export async function iniciarRastreo(cliente: SupabaseClient): Promise<'ok' | 'permiso' | 'sin-config'> {
  if (activo) return 'ok'
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return 'permiso'

  const { data: cfg } = await cliente
    .from('config_rastreo')
    .select('intervalo_min, hora_inicio, hora_fin, precision_max_m')
    .eq('dia_semana', new Date().getDay())
    .maybeSingle()
  if (!cfg) return 'sin-config'

  const config = cfg as ConfigRastreoDia
  const ms = intervaloMs(config.intervalo_min)
  activo = true
  timer = setInterval(() => {
    void (async () => {
      if (!activo) return
      const hhmmss = new Date().toTimeString().slice(0, 8)
      if (!enVentanaHoraria(hhmmss, config.hora_inicio, config.hora_fin)) return
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      cola.push(
        puntoDesdeCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        }),
      )
      await flushLote(cliente)
    })()
  }, ms)
  return 'ok'
}
