/**
 * M-02 Agenda del día + alta de visita (mismas validaciones GC-VIS que la web).
 * La lista sale del servidor o, sin señal, de la copia guardada, más la cola local.
 * Check-in GPS y cierre (M-04) se guardan en la cola y se envían en segundo plano;
 * el rastreo por intervalo vive en services/rastreoServicio y se activa desde App.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
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
import { supabase, type Perfil } from '../lib/supabase'
import type { Visita } from '../lib/tipos'
import { agendaConCola, descargarAgenda } from '../lib/agendaLocal'
import { abrirCacheCampo } from '../lib/abrirCache'
import { conRespaldo } from '../lib/respaldo'
import { mensajeDeError } from '../lib/mensajeError'
import { useCola } from '../lib/useCola'
import { encolarEnFondo } from '../lib/colaStore'
import type { ItemCola } from '../lib/cola'
import { avisoAgendaGuardada, type EstadoAgendaGuardada } from '../lib/avisoGuardado'
import { claveParticionCola } from '../lib/colaParticion'
import { ejecutarMutacion } from '../lib/sync'
import { fechaLocalHoy } from '../lib/visita'
import NuevaVisitaModal from './NuevaVisitaModal'
import ResumenHoy, { type DestinoResumen } from './ResumenHoy'
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

export default function AgendaScreen({
  perfil,
  onAbrir,
}: {
  perfil: Perfil
  onAbrir: (destino: DestinoResumen) => void
}) {
  const t = useTheme()
  const [base, setBase] = useState<Visita[]>([])
  // 'servidor' o, si se ve la copia guardada, por qué: refrescando, sin señal o tras un error.
  const [fuente, setFuente] = useState<'servidor' | EstadoAgendaGuardada>('servidor')
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [checkinDe, setCheckinDe] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [mensajeEsError, setMensajeEsError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [version, setVersion] = useState(0)
  const tieneDatos = useRef(false)
  // Solo la carga más reciente escribe estado: una anterior que responde tarde no la pisa.
  const turno = useRef(0)
  const { items: cola, resumen } = useCola()
  const claveCola = claveParticionCola(perfil.tenantId, perfil.id)

  const hoy = fechaLocalHoy()
  const visitas = useMemo(
    () => agendaConCola(base.filter((v) => v.fecha_visita === hoy), cola, hoy),
    [base, cola, hoy],
  )

  const cargar = useCallback(async () => {
    const mio = ++turno.current
    const vigente = () => mio === turno.current
    const dia = fechaLocalHoy()
    const cache = abrirCacheCampo()
    const clave = claveParticionCola(perfil.tenantId, perfil.id)
    try {
      // Primero lo guardado, para no dejar la pantalla en blanco mientras responde la red.
      if (!tieneDatos.current) {
        const previo = await cache.leer<Visita[]>(clave, 'agenda').catch((e: unknown) => {
          // Es solo un adelanto: si la copia no se lee, se espera al servidor.
          console.warn('GC-CACHE-002: no se pudo leer la agenda guardada', e)
          return null
        })
        if (previo && vigente() && !tieneDatos.current) {
          tieneDatos.current = true
          setBase(previo.datos)
          setFuente('actualizando')
          setGuardadoEn(previo.guardadoEn)
          setCargando(false)
        }
      }
      // descargarAgenda exige sesión vigente (GC-NET-004): sin ella se usa la copia.
      const r = await conRespaldo<Visita[]>({
        cargar: () => descargarAgenda(supabase, dia),
        leer: () => cache.leer<Visita[]>(clave, 'agenda'),
        guardar: (datos) => cache.guardar(clave, 'agenda', datos),
      })
      if (!vigente()) return
      tieneDatos.current = true
      setBase(r.datos)
      setFuente(r.origen === 'cache' ? 'sin_conexion' : 'servidor')
      setGuardadoEn(r.guardadoEn ?? null)
      setError(null)
    } catch (e) {
      if (!vigente()) return
      // Un fallo no vacía la lista: se conserva lo que ya se ve, pero ya no se está actualizando.
      setError(mensajeDeError(e, 'No se pudo leer la agenda'))
      setFuente((f) => (f === 'actualizando' ? 'error' : f))
    } finally {
      if (vigente()) {
        setCargando(false)
        setRefrescando(false)
        setVersion((n) => n + 1)
      }
    }
  }, [perfil.tenantId, perfil.id])

  // Al montar y cada vez que algo de la cola llega al servidor (App.tsx sincroniza cada 30 s).
  React.useEffect(() => {
    void cargar()
  }, [cargar, resumen.enviados])

  async function gps(): Promise<{ lat: number; lng: number }> {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') throw new Error('GC-RAS-010: permiso de ubicación denegado')
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  }

  async function registrar(
    visita: Visita,
    tipo: 'visita_checkin' | 'visita_completar',
    exito: string,
    fallo: string,
  ) {
    setMensaje(null)
    setMensajeEsError(false)
    setCheckinDe(visita.cliente_key)
    let envio: Promise<ItemCola | undefined> | null = null
    try {
      const pos = await gps()
      // Se espera solo el guardado en el teléfono; el envío sigue en segundo plano.
      const r = await encolarEnFondo(
        {
          tipo,
          payload: {
            ...(visita.id != null ? { visitaId: visita.id } : {}),
            visitaClienteKey: visita.cliente_key,
            latitud: pos.lat,
            longitud: pos.lng,
          },
          clienteKey: `${tipo}:${visita.cliente_key}`,
        },
        ejecutarMutacion(supabase),
        claveCola,
      )
      envio = r.envio
      setMensaje(exito)
    } catch (e) {
      setMensajeEsError(true)
      setMensaje(mensajeDeError(e, fallo))
    } finally {
      setCheckinDe(null)
    }
    // Si el servidor lo rechaza, se avisa con su código GC-* (la fila también lo muestra).
    envio?.then(
      (item) => {
        if (item?.estado === 'error' && item.ultimoError) {
          setMensajeEsError(true)
          setMensaje(item.ultimoError)
        }
      },
      (e: unknown) => {
        setMensajeEsError(true)
        setMensaje(mensajeDeError(e, 'GC-SYNC-002: no se pudo sincronizar la cola'))
      },
    )
  }

  function handleCheckin(visita: Visita) {
    return registrar(visita, 'visita_checkin', `Check-in en ${visita.persona_nombre}`, 'No se pudo registrar el check-in')
  }

  function handleCompletar(visita: Visita) {
    return registrar(visita, 'visita_completar', `Visita completada · ${visita.persona_nombre}`, 'No se pudo completar')
  }

  function renderVisita({ item }: { item: Visita }) {
    const conCheckin = item.latitud != null
    const ocupado = checkinDe === item.cliente_key
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
        {item.errorEnvio ? (
          <Text style={[styles.direccion, { color: t.danger }]}>No se pudo enviar · {item.errorEnvio}</Text>
        ) : item.pendiente ? (
          <Text style={[styles.direccion, { color: t.muted }]}>Pendiente de enviar</Text>
        ) : null}
        {item.estado === 'programada' && !conCheckin && (
          <TouchableOpacity
            style={[styles.botonCheckin, { backgroundColor: t.primary }]}
            onPress={() => void handleCheckin(item)}
            disabled={ocupado}
            accessibilityRole="button"
            accessibilityLabel={`Check-in GPS de ${item.persona_nombre}`}
            accessibilityState={{ disabled: ocupado, busy: ocupado }}
          >
            {ocupado ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.checkinFila}>
                <Icono name="checkin" color="#fff" size={16} />
                <Text style={styles.botonCheckinTexto}>Check-in GPS</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {item.estado === 'programada' && conCheckin && (
          <TouchableOpacity
            style={[styles.botonCheckin, { backgroundColor: t.primary }]}
            onPress={() => void handleCompletar(item)}
            disabled={ocupado}
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
  // Sin señal y sin copia: el aviso de arriba ya trae el código; la lista vacía no lo repite.
  const sinAgendaGuardada = error?.startsWith('GC-NET-002') ?? false

  return (
    <View style={[styles.contenedor, { backgroundColor: t.canvas }]}>
      {error ? (
        <Text style={[styles.errorBanner, { backgroundColor: t.surface, borderColor: t.danger, color: t.danger }]}>
          {error}
        </Text>
      ) : null}
      {fuente !== 'servidor' ? (
        <Text style={[styles.aviso, { color: t.muted }]}>{avisoAgendaGuardada(fuente, guardadoEn)}</Text>
      ) : null}
      {mensaje && <Text style={[styles.mensaje, { color: mensajeEsError ? t.danger : t.success }]}>{mensaje}</Text>}
      <FlatList
        data={visitas}
        keyExtractor={(v) => v.cliente_key}
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
          <View>
            <Text style={[styles.heroFecha, { color: t.ink }]}>{formatearFechaJornada(fechaHero)}</Text>
            <ResumenHoy perfil={perfil} jornada={jornada} version={version} onAbrir={onAbrir} />
          </View>
        }
        ListEmptyComponent={
          <Vacio
            titulo={sinAgendaGuardada ? 'Sin conexión y sin agenda guardada' : 'Sin visitas programadas para hoy'}
            descripcion={
              sinAgendaGuardada
                ? 'Podés agendar visitas sin señal; se envían cuando vuelva la conexión.'
                : (error ?? 'Agendá una visita a un cliente de tu cartera o un prospecto.')
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
        perfil={perfil}
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
  aviso: { marginHorizontal: 16, marginTop: 12, fontSize: 13 },
  errorBanner: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  heroFecha: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
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
