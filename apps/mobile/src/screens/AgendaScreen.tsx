/**
 * M-02 Agenda del día + alta de visita (mismas validaciones GC-VIS que la web).
 */
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'
import type { Visita } from '../lib/tipos'
import { encolarYSync } from '../lib/colaStore'
import { ejecutarDemo, ejecutarMutacion } from '../lib/sync'
import { distanciaMetros, fueraDeRango } from '../lib/geocerca'
import { colorPrimario } from '../lib/branding'
import { fechaLocalHoy } from '../lib/visita'
import NuevaVisitaModal from './NuevaVisitaModal'

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
    fecha_visita: fechaLocalHoy(),
    hora_inicio: '08:30:00',
    estado: 'programada',
    actividad: 'Verificación de garantías',
    latitud: 14.3,
    longitud: -90.78,
  },
]

const UMBRAL_GEOCERCA_M = 200

function mapFila(row: Record<string, unknown>): Visita {
  const act = row.actividad
  let actividad: string | null = null
  if (typeof act === 'string') actividad = act
  else if (act && typeof act === 'object' && 'nombre' in act) {
    actividad = String((act as { nombre: unknown }).nombre)
  }
  return {
    id: Number(row.id),
    persona_nombre: String(row.persona_nombre ?? '—'),
    direccion: (row.direccion as string | null) ?? null,
    fecha_visita: String(row.fecha_visita ?? ''),
    hora_inicio: (row.hora_inicio as string | null) ?? null,
    estado: (row.estado as Visita['estado']) ?? 'programada',
    actividad,
    latitud: row.latitud != null ? Number(row.latitud) : null,
    longitud: row.longitud != null ? Number(row.longitud) : null,
  }
}

export default function AgendaScreen({ perfil }: { perfil: Perfil }) {
  const primario = colorPrimario(perfil.branding)
  const [visitas, setVisitas] = useState<Visita[]>(DEMO_MODE ? DEMO_VISITAS : [])
  const [cargando, setCargando] = useState(!DEMO_MODE)
  const [refrescando, setRefrescando] = useState(false)
  const [checkinDe, setCheckinDe] = useState<number | null>(null)
  const [checkins, setCheckins] = useState<Set<number>>(new Set())
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mostrarAlta, setMostrarAlta] = useState(false)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setVisitas(DEMO_VISITAS)
      setCargando(false)
      setRefrescando(false)
      return
    }
    const hoy = fechaLocalHoy()
    const rpc = await supabase.rpc('visitas_del_dia', { p_fecha: hoy })
    if (!rpc.error && rpc.data) {
      setVisitas((rpc.data as Array<Record<string, unknown>>).map(mapFila))
      setError(null)
    } else {
      const q = await supabase
        .from('visita')
        .select('id, persona_nombre, direccion, fecha_visita, hora_inicio, estado, latitud, longitud, actividad(nombre)')
        .eq('fecha_visita', hoy)
        .order('hora_inicio')
      if (q.error) {
        setError(q.error.message || rpc.error?.message || 'No se pudo leer la agenda')
        setVisitas([])
      } else {
        setVisitas(((q.data ?? []) as Array<Record<string, unknown>>).map(mapFila))
        setError(null)
      }
    }
    setCargando(false)
    setRefrescando(false)
  }, [])

  React.useEffect(() => {
    void cargar()
  }, [cargar])

  async function gps(): Promise<{ lat: number; lng: number }> {
    if (DEMO_MODE) return { lat: 14.6349, lng: -90.5069 }
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') throw new Error('GC-RAS-010: permiso de ubicación denegado')
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  }

  function avisoGeocerca(visita: Visita, lat: number, lng: number): string | null {
    if (visita.latitud == null || visita.longitud == null) return null
    const d = distanciaMetros(lat, lng, visita.latitud, visita.longitud)
    if (fueraDeRango(d, UMBRAL_GEOCERCA_M)) {
      return `Check-in fuera de geocerca (${Math.round(d)} m). Se registra, no se bloquea.`
    }
    return null
  }

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
      setMensaje(avisoGeocerca(visita, pos.lat, pos.lng) ?? `Check-in en ${visita.persona_nombre}`)
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
            {item.actividad ? <Text style={styles.actividad}>{item.actividad}</Text> : null}
            {item.direccion ? <Text style={styles.direccion}>{item.direccion}</Text> : null}
            {item.hora_inicio ? <Text style={styles.hora}>{item.hora_inicio.slice(0, 5)}</Text> : null}
          </View>
          <View style={[styles.badge, { backgroundColor: estilo.bg }]}>
            <Text style={[styles.badgeTexto, { color: estilo.fg }]}>{estilo.texto}</Text>
          </View>
        </View>
        {item.estado === 'programada' && !checkins.has(item.id) ? (
          <Pressable
            style={[styles.botonAccion, { backgroundColor: '#047857' }]}
            onPress={() => void handleCheckin(item)}
            disabled={checkinDe === item.id}
            accessibilityRole="button"
            accessibilityLabel="Check-in GPS"
          >
            {checkinDe === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.botonAccionTexto}>Check-in GPS</Text>
            )}
          </Pressable>
        ) : null}
        {item.estado === 'programada' && checkins.has(item.id) ? (
          <Pressable
            style={[styles.botonAccion, { backgroundColor: primario }]}
            onPress={() => void handleCompletar(item)}
            disabled={checkinDe === item.id}
            accessibilityRole="button"
            accessibilityLabel="Completar visita"
          >
            <Text style={styles.botonAccionTexto}>Completar visita</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={primario} />
      </View>
    )
  }

  return (
    <View style={styles.contenedor}>
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
      <FlatList
        data={visitas}
        keyExtractor={(v) => String(v.id)}
        renderItem={renderVisita}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true)
              void cargar()
            }}
            tintColor={primario}
          />
        }
        ListEmptyComponent={
          <View style={styles.vacioCaja}>
            <Text style={styles.vacioTitulo}>Nada agendado hoy</Text>
            <Text style={styles.vacio}>Agendá una visita a un cliente de tu cartera o un prospecto.</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
      />
      <Pressable
        style={[styles.fab, { backgroundColor: primario }]}
        onPress={() => setMostrarAlta(true)}
        accessibilityRole="button"
        accessibilityLabel="Agendar visita"
      >
        <Text style={styles.fabTexto}>Agendar</Text>
      </Pressable>
      <NuevaVisitaModal
        visible={mostrarAlta}
        colorPrimario={primario}
        onCerrar={() => setMostrarAlta(false)}
        onGuardada={() => void cargar()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F8FAFC' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mensaje: { marginHorizontal: 16, marginTop: 12, color: '#047857', fontSize: 13, fontWeight: '600' },
  errorBanner: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tarjetaFila: { flexDirection: 'row', alignItems: 'flex-start' },
  nombre: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  actividad: { fontSize: 14, color: '#475569', marginTop: 4 },
  direccion: { fontSize: 13, color: '#64748B', marginTop: 4 },
  hora: { fontSize: 13, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  badgeTexto: { fontSize: 11, fontWeight: '700' },
  botonAccion: {
    marginTop: 12,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonAccionTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  vacioCaja: { marginTop: 48, paddingHorizontal: 24, alignItems: 'center' },
  vacioTitulo: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  vacio: { textAlign: 'center', color: '#64748B', fontSize: 15, lineHeight: 22 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: Platform.OS === 'android' ? 16 : 24,
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fabTexto: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
