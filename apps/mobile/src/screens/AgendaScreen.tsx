/**
 * M-02 Agenda del día + alta de visita (mismas validaciones GC-VIS que la web).
 * Check-in GPS directo (M-04) con aviso de geocerca; el rastreo por intervalo
 * vive en services/rastreoServicio y se activa desde App.
 */
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'
import type { Visita } from '../lib/tipos'
import { encolarYSync } from '../lib/colaStore'
import { ejecutarDemo, ejecutarMutacion } from '../lib/sync'
import { distanciaMetros, fueraDeRango } from '../lib/geocerca'
import { fechaLocalHoy } from '../lib/visita'
import NuevaVisitaModal from './NuevaVisitaModal'
import { BadgeEstado, Cargando, Icono, Vacio } from '../components/ui'
import { useTheme } from '../theme'
import { formatearFechaJornada, progresoJornada } from '../lib/jornada'

const ETIQUETA_ESTADO: Record<string, string> = {
  programada: 'Programada',
  completada: 'Completada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
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
  const t = useTheme()
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
    return (
      <View style={[styles.tarjeta, { borderColor: t.line, backgroundColor: t.surface }]}>
        <View style={styles.tarjetaFila}>
          <Text style={[styles.hora, { color: t.ink }]}>{item.hora_inicio ? item.hora_inicio.slice(0, 5) : '--:--'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nombre, { color: t.ink }]}>{item.persona_nombre}</Text>
            {item.actividad ? <Text style={[styles.actividad, { color: t.muted }]}>{item.actividad}</Text> : null}
            <Text style={[styles.direccion, { color: t.muted }]}>{item.direccion ?? 'Sin zona'}</Text>
          </View>
          <BadgeEstado estado={ETIQUETA_ESTADO[item.estado] ?? item.estado} />
        </View>
        {item.estado === 'programada' && !checkins.has(item.id) && (
          <TouchableOpacity
            style={[styles.botonCheckin, { backgroundColor: t.primary }]}
            onPress={() => void handleCheckin(item)}
            disabled={checkinDe === item.id}
            accessibilityRole="button"
            accessibilityLabel={`Check-in GPS de ${item.persona_nombre}`}
            accessibilityState={{ disabled: checkinDe === item.id, busy: checkinDe === item.id }}
          >
            {checkinDe === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.checkinFila}>
                <Icono name="checkin" color="#fff" size={16} />
                <Text style={styles.botonCheckinTexto}>Check-in GPS</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {item.estado === 'programada' && checkins.has(item.id) && (
          <TouchableOpacity
            style={[styles.botonCheckin, { backgroundColor: t.primary }]}
            onPress={() => void handleCompletar(item)}
            disabled={checkinDe === item.id}
            accessibilityRole="button"
            accessibilityLabel={`Completar visita de ${item.persona_nombre}`}
          >
            <Text style={styles.botonCheckinTexto}>Completar visita</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  if (cargando) {
    return <Cargando etiqueta="Cargando agenda…" />
  }

  const jornada = progresoJornada(visitas)
  const fechaHero = visitas[0]?.fecha_visita ?? fechaLocalHoy()

  return (
    <View style={[styles.contenedor, { backgroundColor: t.canvas }]}>
      {error ? (
        <Text style={[styles.errorBanner, { backgroundColor: t.surface, borderColor: t.danger, color: t.danger }]}>
          {error}
        </Text>
      ) : null}
      {mensaje && <Text style={[styles.mensaje, { color: t.success }]}>{mensaje}</Text>}
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
            tintColor={t.primary}
          />
        }
        ListHeaderComponent={
          <View style={[styles.hero, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={[styles.heroFecha, { color: t.ink }]}>{formatearFechaJornada(fechaHero)}</Text>
            <View style={styles.heroLinea}>
              <Text style={[styles.heroPct, { color: t.ink }]}>{jornada.pct}%</Text>
              <Text style={[styles.heroMeta, { color: t.muted }]}>
                {jornada.hechas} de {jornada.total} completadas
              </Text>
            </View>
            <View style={[styles.barra, { backgroundColor: t.canvas }]}>
              <View style={[styles.barraFill, { width: `${jornada.pct}%`, backgroundColor: t.primary }]} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Vacio
            titulo={DEMO_MODE ? 'Agenda de demostración vacía' : 'Sin visitas programadas para hoy'}
            descripcion={
              DEMO_MODE
                ? 'En DEMO no hay backend. En vivo aparecen las visitas de visitas_del_dia().'
                : 'Agendá una visita a un cliente de tu cartera o un prospecto.'
            }
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
      />
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: t.primary }]}
        onPress={() => setMostrarAlta(true)}
        accessibilityRole="button"
        accessibilityLabel="Agendar visita"
      >
        <Text style={styles.fabTexto}>Agendar</Text>
      </TouchableOpacity>
      <NuevaVisitaModal
        visible={mostrarAlta}
        colorPrimario={t.primary}
        onCerrar={() => setMostrarAlta(false)}
        onGuardada={() => void cargar()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  mensaje: { marginHorizontal: 16, marginTop: 12, fontSize: 13, fontWeight: '600' },
  errorBanner: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  hero: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12 },
  heroFecha: { fontSize: 18, fontWeight: '600' },
  heroLinea: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  heroPct: { fontSize: 16, fontWeight: '600' },
  heroMeta: { fontSize: 13 },
  barra: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  barraFill: { height: '100%', borderRadius: 999 },
  tarjeta: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  tarjetaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nombre: { fontSize: 15, fontWeight: '600' },
  actividad: { fontSize: 13, marginTop: 2 },
  direccion: { fontSize: 12, marginTop: 2 },
  hora: { fontSize: 16, fontWeight: '600', width: 56 },
  botonCheckin: {
    marginTop: 12,
    borderRadius: 10,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonCheckinTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  checkinFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
