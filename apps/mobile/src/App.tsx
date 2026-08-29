/**
 * @gc/mobile — App del asesor de campo.
 * Tabs de operación + notificaciones / cola. Theming desde tenant.branding.
 */
import React, { useEffect, useState } from 'react'
import { AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import LoginScreen from './screens/LoginScreen'
import AgendaScreen from './screens/AgendaScreen'
import PersonaScreen from './screens/PersonaScreen'
import LeadsScreen from './screens/LeadsScreen'
import FormulariosScreen from './screens/FormulariosScreen'
import SolicitudesScreen from './screens/SolicitudesScreen'
import DepositosScreen from './screens/DepositosScreen'
import AjustesScreen from './screens/AjustesScreen'
import NotificacionesScreen from './screens/NotificacionesScreen'
import SyncScreen from './screens/SyncScreen'
import { DEMO_MODE, supabase, type Perfil, cargarPerfil, resolverClaims } from './lib/supabase'
import { colorPrimario } from './lib/branding'
import { useCola } from './lib/useCola'
import { demoCola } from './lib/cola'
import { configurarPersistencia, hidratarDesdeAlmacen, sincronizarAhora } from './lib/colaStore'
import { ejecutarDemo, ejecutarMutacion } from './lib/sync'
import { parseDeepLink } from './lib/deepLink'
import { registrarDispositivo } from './lib/dispositivo'
import { tokenPushNativo } from './lib/push'
import { detenerRastreo, iniciarRastreo } from './services/rastreoServicio'

type Tab =
  | 'agenda'
  | 'personas'
  | 'leads'
  | 'formularios'
  | 'solicitudes'
  | 'depositos'
  | 'ajustes'
  | 'notificaciones'
  | 'sync'

const TITULOS: Record<Tab, string> = {
  agenda: 'Agenda de hoy',
  personas: 'Cartera',
  leads: 'Mis leads',
  formularios: 'Formularios',
  solicitudes: 'Solicitudes',
  depositos: 'Depósitos',
  ajustes: 'Ajustes',
  notificaciones: 'Notificaciones',
  sync: 'Sincronización',
}

function claveRastreo(userId: string) {
  return `gc.rastreo:${userId}`
}

export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [tab, setTab] = useState<Tab>('agenda')
  const [listo, setListo] = useState(false)
  const [rastreoOn, setRastreoOn] = useState(true)
  const [noLeidas, setNoLeidas] = useState(0)
  const { pendientes } = useCola()

  useEffect(() => {
    if (DEMO_MODE) {
      setListo(true)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const claims = await resolverClaims(data.session)
        if (claims) {
          const p = await cargarPerfil(data.session.user.id, claims.tenantId, claims.rol)
          if (p) setPerfil(p)
        }
      }
      setListo(true)
    })
  }, [])

  useEffect(() => {
    if (!perfil) return
    configurarPersistencia(AsyncStorage, perfil.id)
    void hidratarDesdeAlmacen(DEMO_MODE ? demoCola() : [])
    void AsyncStorage.getItem(claveRastreo(perfil.id)).then((v) => {
      setRastreoOn(v !== '0')
    })
  }, [perfil?.id])

  useEffect(() => {
    if (!perfil || DEMO_MODE) return
    let cancel = false
    tokenPushNativo()
      .then((token) => {
        if (!token || cancel) return
        return registrarDispositivo(supabase, perfil.id, token)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [perfil?.id])

  useEffect(() => {
    if (!perfil || DEMO_MODE) return
    if (!rastreoOn) {
      void detenerRastreo(supabase)
      return
    }
    void iniciarRastreo(supabase)
    return () => {
      void detenerRastreo(supabase)
    }
  }, [perfil, rastreoOn])

  useEffect(() => {
    if (!perfil) return
    const t = setInterval(() => {
      void sincronizarAhora(DEMO_MODE ? ejecutarDemo : ejecutarMutacion(supabase))
    }, 30_000)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void sincronizarAhora(DEMO_MODE ? ejecutarDemo : ejecutarMutacion(supabase))
      }
    })
    return () => {
      clearInterval(t)
      sub.remove()
    }
  }, [perfil])

  useEffect(() => {
    function aplicarUrl(url: string | null) {
      const dest = parseDeepLink(url)
      if (!dest) return
      setTab(dest.tab)
    }
    const sub = Linking.addEventListener('url', ({ url }) => aplicarUrl(url))
    void Linking.getInitialURL().then(aplicarUrl)
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!perfil || DEMO_MODE) return
    supabase
      .from('notificacion')
      .select('id', { count: 'exact', head: true })
      .eq('leida', false)
      .then(({ count }) => {
        if (typeof count === 'number') setNoLeidas(count)
      })
  }, [perfil, tab])

  async function handleLogout() {
    await detenerRastreo(DEMO_MODE ? undefined : supabase)
    setPerfil(null)
    setTab('agenda')
  }

  async function handleRastreo(next: boolean) {
    if (!perfil) return
    setRastreoOn(next)
    await AsyncStorage.setItem(claveRastreo(perfil.id), next ? '1' : '0')
  }

  if (!listo) return <View style={styles.fondo} />

  if (!perfil) {
    return (
      <View style={styles.fondo}>
        <LoginScreen onLogin={setPerfil} />
        <StatusBar style="dark" />
      </View>
    )
  }

  const primario = colorPrimario(perfil.branding)
  const tabs: { id: Tab; etiqueta: string }[] = [
    { id: 'agenda', etiqueta: 'Agenda' },
    { id: 'personas', etiqueta: 'Cartera' },
    { id: 'leads', etiqueta: 'Leads' },
    { id: 'formularios', etiqueta: 'Fichas' },
    ...(DEMO_MODE || perfil.modulos.includes('solicitudes')
      ? [{ id: 'solicitudes' as const, etiqueta: 'Solicitudes' }]
      : []),
    ...(DEMO_MODE || perfil.modulos.includes('depositos')
      ? [{ id: 'depositos' as const, etiqueta: 'Depósitos' }]
      : []),
    { id: 'ajustes', etiqueta: 'Ajustes' },
  ]

  return (
    <View style={styles.fondo}>
      <View style={[styles.header, { backgroundColor: primario }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>{TITULOS[tab]}</Text>
          <Text style={styles.headerSub}>{perfil.tenantNombre ?? perfil.nombre}</Text>
        </View>
        {pendientes > 0 ? (
          <View style={styles.offlineBadge} accessibilityLabel="Pendientes de sincronizar">
            <Text style={styles.offlineTexto}>Offline {pendientes}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.headerBtn} onPress={() => setTab('notificaciones')} accessibilityLabel="Notificaciones">
          <Text style={styles.headerBtnTexto}>Avisos</Text>
          {noLeidas > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{noLeidas}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setTab('sync')} accessibilityLabel="Sincronización">
          <Text style={styles.headerBtnTexto}>Cola</Text>
          {pendientes > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{pendientes}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'agenda' && <AgendaScreen perfil={perfil} />}
        {tab === 'personas' && <PersonaScreen perfil={perfil} />}
        {tab === 'leads' && <LeadsScreen perfil={perfil} />}
        {tab === 'formularios' && <FormulariosScreen perfil={perfil} />}
        {tab === 'solicitudes' && <SolicitudesScreen perfil={perfil} />}
        {tab === 'depositos' && <DepositosScreen perfil={perfil} />}
        {tab === 'ajustes' && (
          <AjustesScreen
            perfil={perfil}
            rastreoOn={rastreoOn}
            onRastreo={handleRastreo}
            onLogout={() => void handleLogout()}
            onAbrirCola={() => setTab('sync')}
          />
        )}
        {tab === 'notificaciones' && (
          <NotificacionesScreen colorPrimario={primario} onDeepLink={(url) => {
            const dest = parseDeepLink(url)
            if (dest) setTab(dest.tab)
          }} />
        )}
        {tab === 'sync' && <SyncScreen colorPrimario={primario} />}
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.id} style={styles.tab} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabTexto, tab === t.id && { color: primario, fontWeight: '700' }]}>{t.etiqueta}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  headerTitulo: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#BFDBFE', fontSize: 12, marginTop: 2 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  headerBtnTexto: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    minWidth: 16,
    paddingHorizontal: 4,
  },
  badgeTexto: { color: '#1B2430', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  offlineBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  offlineTexto: { color: '#1B2430', fontSize: 10, fontWeight: '800' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 24,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabTexto: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
})
