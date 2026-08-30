/**
 * Servicio de rastreo de campo. TaskManager + Location.startLocationUpdatesAsync.
 * El asesor no puede apagarlo. Intervalo y ventana salen de config_rastreo.
 */
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
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

export const TAREA_RASTREO = 'gc-rastreo-campo'

export const TEXTO_PERMISO_UBICACION =
  'Durante tu jornada la app registra la ubicación para el check-in de visitas y el rastreo que configuró tu empresa.'

export const TEXTO_NOTIFICACION_RUTA = 'Gestiones Comerciales está registrando la ruta'

let cola: PuntoGps[] = []
let activo = false
let clienteRef: SupabaseClient | null = null
let configRef: ConfigRastreoDia | null = null

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

TaskManager.defineTask(TAREA_RASTREO, async ({ data, error }) => {
  if (error || !clienteRef || !configRef) return
  const hhmmss = new Date().toTimeString().slice(0, 8)
  if (!enVentanaHoraria(hhmmss, configRef.hora_inicio, configRef.hora_fin)) return
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? []
  for (const pos of locations) {
    cola.push(
      puntoDesdeCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      }),
    )
  }
  await flushLote(clienteRef)
})

function accuracyDe(precisionMaxM?: number) {
  if (precisionMaxM != null && precisionMaxM <= 30) return Location.Accuracy.High
  return Location.Accuracy.Balanced
}

export async function leerConfigRastreo(cliente: SupabaseClient): Promise<ConfigRastreoDia | null> {
  const { data: cfg } = await cliente
    .from('config_rastreo')
    .select('intervalo_min, hora_inicio, hora_fin, precision_max_m')
    .eq('dia_semana', new Date().getDay())
    .maybeSingle()
  return (cfg as ConfigRastreoDia | null) ?? null
}

export async function detenerRastreo(cliente?: SupabaseClient): Promise<void> {
  activo = false
  const started = await Location.hasStartedLocationUpdatesAsync(TAREA_RASTREO).catch(() => false)
  if (started) {
    await Location.stopLocationUpdatesAsync(TAREA_RASTREO).catch(() => undefined)
  }
  const dest = cliente ?? clienteRef
  if (dest && cola.length) {
    const pendiente = [...cola]
    cola = []
    const { data: sesion } = await dest.auth.getSession()
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
  clienteRef = null
  configRef = null
}

export async function iniciarRastreo(cliente: SupabaseClient): Promise<'ok' | 'permiso' | 'sin-config'> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return 'permiso'
  await Location.requestBackgroundPermissionsAsync().catch(() => undefined)

  const config = await leerConfigRastreo(cliente)
  if (!config) return 'sin-config'

  clienteRef = cliente
  configRef = config
  const ms = intervaloMs(config.intervalo_min)
  const ya = await Location.hasStartedLocationUpdatesAsync(TAREA_RASTREO).catch(() => false)
  if (!ya) {
    await Location.startLocationUpdatesAsync(TAREA_RASTREO, {
      accuracy: accuracyDe(config.precision_max_m),
      timeInterval: ms,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Gestiones Comerciales',
        notificationBody: TEXTO_NOTIFICACION_RUTA,
      },
    })
  }
  activo = true
  return 'ok'
}

export function suscribirRastreoAuth(cliente: SupabaseClient): () => void {
  const { data } = cliente.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      void detenerRastreo(cliente)
    }
    if (event === 'SIGNED_IN') {
      void resolveYArrancar(cliente)
    }
  })
  return () => data.subscription.unsubscribe()
}

async function resolveYArrancar(cliente: SupabaseClient) {
  const { resolveCampoAccess } = await import('./permisosCampo')
  const acceso = await resolveCampoAccess()
  if (acceso === 'ok') await iniciarRastreo(cliente)
}
