/**
 * M-02 Agenda de visitas del día (spec F1.11).
 * Lista las visitas de hoy del asesor con su estado y permite check-in GPS
 * directo (M-04) desde cada tarjeta. Incluye rastreo por intervalo de la
 * config del tenant mientras el asesor está dentro de la ventana (GC-RAS-*).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'
import type { PuntoGps, Visita } from '../lib/tipos'
import { encolarYSync } from '../lib/colaStore'
import { ejecutarDemo, ejecutarMutacion } from '../lib/sync'

declare const process: { env: Record<string, string | undefined> }

const SUPABASE_FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1`

const ESTILO_ESTADO: Record<string, { bg: string; fg: string; texto: string }> = {
  programada: { bg: '#DBEAFE', fg: '#1D4ED8', texto: 'Programada' },
  completada: { bg: '#D1FAE5', fg: '#047857', texto: 'Completada' },
  aprobada: { bg: '#CCFBF1', fg: '#0F766E', texto: 'Aprobada' },
  rechazada: { bg: '#FEE2E2', fg: '#B91C1C', texto: 'Rechazada' },
  anulada: { bg: '#F3F4F6', fg: '#6B7280', texto: 'Anulada' },
}

const DEMO_VISITAS: Visita[] = [
  {
    id: 201,
    persona_nombre: 'Agropecuaria El Triunfo',
    direccion: 'Km 56 Carretera a Puerto San José',
    fecha_visita: '2026-08-28',
    hora_inicio: '08:30:00',
    estado: 'programada',
    actividad: 'Verificación de garantías',
  },
  {
    id: 202,
    persona_nombre: 'Agrícola El Roble S.A.',
    direccion: 'Zona 1, Escuintla',
    fecha_visita: '2026-08-28',
    hora_inicio: '11:00:00',
    estado: 'programada',
    actividad: 'Seguimiento de crédito',
  },
]

interface Props {
  perfil: Perfil
}

export default function AgendaScreen({ perfil }: Props) {
  const [visitas, setVisitas] = useState<Visita[]>(DEMO_MODE ? DEMO_VISITAS : [])
  const [cargando, setCargando] = useState(!DEMO_MODE)
  const [refrescando, setRefrescando] = useState(false)
  const [checkinDe, setCheckinDe] = useState<number | null>(null)
  const [checkins, setCheckins] = useState<Set<number>>(new Set())
  const [mensaje, setMensaje] = useState<string | null>(null)
  const colaRastreo = useRef<PuntoGps[]>([])
  const timerRastreo = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setVisitas(DEMO_VISITAS)
      setCargando(false)
      setRefrescando(false)
      return
    }
    const { data, error } = await supabase.rpc('visitas_del_dia')
    if (!error && data) setVisitas(data as Visita[])
    setCargando(false)
    setRefrescando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // ----- Rastreo por intervalo (config_rastreo del tenant) -----
  useEffect(() => {
    if (DEMO_MODE) return

    let activo = true
    async function iniciarRastreo() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted' || !activo) return

      // config del día: el servidor también la valida en rastreo-ingesta
      const { data: cfg } = await supabase
        .from('config_rastreo')
        .select('intervalo_min, hora_inicio, hora_fin')
        .eq('dia_semana', new Date().getDay())
        .maybeSingle()
      if (!cfg || !activo) return

      const intervaloMs = (cfg.intervalo_min ?? 15) * 60_000
      timerRastreo.current = setInterval(async () => {
        const ahora = new Date()
        const hhmmss = ahora.toTimeString().slice(0, 8)
        if (hhmmss < cfg.hora_inicio || hhmmss > cfg.hora_fin) return

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        colaRastreo.current.push({
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          precision_m: pos.coords.accuracy,
          velocidad_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
          registrado_en: new Date().toISOString(),
        })

        // Envía el lote al edge rastreo-ingesta (él aplica GC-RAS-001 y la ventana)
        if (colaRastreo.current.length >= 3) {
          const puntos = [...colaRastreo.current]
          colaRastreo.current = []
          const { data: sesion } = await supabase.auth.getSession()
          await fetch(`${SUPABASE_FUNCTIONS_URL}/rastreo-ingesta`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sesion.session?.access_token}`,
            },
            body: JSON.stringify({ puntos }),
          }).catch(() => {
            // offline: reencola (idempotente por registrado_en único)
            colaRastreo.current.unshift(...puntos)
          })
        }
      }, intervaloMs)
    }
    iniciarRastreo()
    return () => {
      activo = false
      if (timerRastreo.current) clearInterval(timerRastreo.current)
    }
  }, [])

  async function gps(): Promise<{ lat: number; lng: number }> {
    if (DEMO_MODE) return { lat: 14.6349, lng: -90.5069 }
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') throw new Error('GC-RAS-010: permiso de ubicación denegado')
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  }

  // ----- M-04: check-in / completar GPS (cola offline) -----
  async function handleCheckin(visita: Visita) {
    setMensaje(null)
    setCheckinDe(visita.id)
    try {
      const pos = await gps()
      await encolarYSync(
        {
          tipo: 'visita_checkin',
          payload: { visitaId: visita.id, latitud: pos.lat, longitud: pos.lng },
          clienteKey: `visita_checkin:${visita.id}`,
        },
        DEMO_MODE ? ejecutarDemo : ejecutarMutacion(supabase),
      )
      setCheckins((prev) => new Set(prev).add(visita.id))
      setMensaje(`Check-in encolado en ${visita.persona_nombre}`)
      if (!DEMO_MODE) await cargar()
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo registrar el check-in')
    } finally {
      setCheckinDe(null)
    }
  }

  async function handleCompletar(visita: Visita) {
    setMensaje(null)
    setCheckinDe(visita.id)
    try {
      const pos = await gps()
      await encolarYSync(
        {
          tipo: 'visita_completar',
          payload: { visitaId: visita.id, latitud: pos.lat, longitud: pos.lng },
          clienteKey: `visita_completar:${visita.id}`,
        },
        DEMO_MODE ? ejecutarDemo : ejecutarMutacion(supabase),
      )
      setVisitas((prev) => prev.map((v) => (v.id === visita.id ? { ...v, estado: 'completada' } : v)))
      setMensaje(`Visita completada · ${visita.persona_nombre}`)
      if (!DEMO_MODE) await cargar()
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo completar')
    } finally {
      setCheckinDe(null)
    }
  }

  function renderVisita({ item }: { item: Visita }) {
    const estilo = ESTILO_ESTADO[item.estado] ?? ESTILO_ESTADO.programada
    return (
      <View style={styles.tarjeta}>
        <View style={styles.tarjetaFila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombre}>{item.persona_nombre}</Text>
            {item.actividad && <Text style={styles.actividad}>{item.actividad}</Text>}
            {item.direccion && <Text style={styles.direccion}>{item.direccion}</Text>}
            {item.hora_inicio && <Text style={styles.hora}>{item.hora_inicio.slice(0, 5)}</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: estilo.bg }]}>
            <Text style={[styles.badgeTexto, { color: estilo.fg }]}>{estilo.texto}</Text>
          </View>
        </View>
        {item.estado === 'programada' && !checkins.has(item.id) && (
          <TouchableOpacity
            style={styles.botonCheckin}
            onPress={() => handleCheckin(item)}
            disabled={checkinDe === item.id}
          >
            {checkinDe === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.botonCheckinTexto}>Check-in GPS</Text>
            )}
          </TouchableOpacity>
        )}
        {item.estado === 'programada' && checkins.has(item.id) && (
          <TouchableOpacity
            style={[styles.botonCheckin, { backgroundColor: '#1D4ED8' }]}
            onPress={() => handleCompletar(item)}
            disabled={checkinDe === item.id}
          >
            <Text style={styles.botonCheckinTexto}>Completar visita</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    )
  }

  return (
    <View style={styles.contenedor}>
      {mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}
      <FlatList
        data={visitas}
        keyExtractor={(v) => String(v.id)}
        renderItem={renderVisita}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true)
              cargar()
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {DEMO_MODE ? 'Modo demo: sin backend conectado.' : 'Sin visitas programadas para hoy.'}
          </Text>
        }
        contentContainerStyle={{ padding: 16 }}
      />
      <Text style={styles.pie}>Asesor: {perfil.nombre}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F3F4F6' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mensaje: { margin: 12, color: '#047857', fontSize: 13 },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tarjetaFila: { flexDirection: 'row', alignItems: 'flex-start' },
  nombre: { fontSize: 16, fontWeight: '600', color: '#111827' },
  actividad: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  direccion: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  hora: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeTexto: { fontSize: 11, fontWeight: '600' },
  botonCheckin: {
    marginTop: 10,
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botonCheckinTexto: { color: '#fff', fontWeight: '600', fontSize: 14 },
  vacio: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  pie: { textAlign: 'center', color: '#9CA3AF', fontSize: 11, padding: 8 },
})
