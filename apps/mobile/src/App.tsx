/**
 * @gc/mobile — App del asesor de campo.
 * Tabs de operación + notificaciones / cola. Theming desde tenant.branding.
 */
import React, { useEffect, useState } from 'react'
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
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
  | 'mas'
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
  mas: 'Más',
  formularios: 'Formularios',
  solicitudes: 'Solicitudes',
  depositos: 'Depósitos',
  ajustes: 'Ajustes',
  notificaciones: 'Notificaciones',
  sync: 'Sincronización',
}

const BARRA: { id: 'agenda' | 'personas' | 'leads' | 'mas'; etiqueta: string }[] = [
  { id: 'agenda', etiqueta: 'Agenda' },
  { id: 'personas', etiqueta: 'Cartera' },
  { id: 'leads', etiqueta: 'Leads' },
  { id: 'mas', etiqueta: 'Más' },
]

function tabBarDe(tab: Tab): (typeof BARRA)[number]['id'] {
  if (tab === 'agenda' || tab === 'personas' || tab === 'leads' || tab === 'mas') return tab
  return 'mas'
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
          setPerfil(await cargarPerfil(data.session, claims))
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
  const padTop = Platform.OS === 'ios' ? 54 : (RNStatusBar.currentHeight ?? 24) + 8

  const extras: { id: Tab; etiqueta: string; detalle: string }[] = [
    { id: 'formularios', etiqueta: 'Formularios', detalle: 'Fichas de campo' },
    ...(DEMO_MODE || perfil.modulos.includes('solicitudes')
      ? [{ id: 'solicitudes' as const, etiqueta: 'Solicitudes', detalle: 'Créditos y trámites' }]
      : []),
    ...(DEMO_MODE || perfil.modulos.includes('depositos')
      ? [{ id: 'depositos' as const, etiqueta: 'Depósitos', detalle: 'Boletas y recaudación' }]
      : []),
    { id: 'notificaciones', etiqueta: 'Avisos', detalle: noLeidas > 0 ? `${noLeidas} sin leer` : 'Notificaciones' },
    { id: 'sync', etiqueta: 'Cola offline', detalle: pendientes > 0 ? `${pendientes} pendientes` : 'Sincronización' },
    { id: 'ajustes', etiqueta: 'Ajustes', detalle: perfil.nombre },
  ]

  return (
    <View style={styles.fondo}>
      <View style={[styles.header, { backgroundColor: primario, paddingTop: padTop }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>{TITULOS[tab]}</Text>
          <Text style={styles.headerSub}>{perfil.tenantNombre ?? perfil.nombre}</Text>
        </View>
        {pendientes > 0 ? (
          <View style={styles.offlineBadge} accessibilityLabel="Pendientes de sincronizar">
            <Text style={styles.offlineTexto}>Cola {pendientes}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'agenda' && <AgendaScreen perfil={perfil} />}
        {tab === 'personas' && <PersonaScreen perfil={perfil} />}
        {tab === 'leads' && <LeadsScreen perfil={perfil} />}
        {tab === 'mas' && (
          <ScrollView contentContainerStyle={styles.masLista}>
            {extras.map((item) => (
              <Pressable
                key={item.id}
                style={styles.masItem}
                onPress={() => setTab(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.etiqueta}
              >
                <Text style={styles.masTitulo}>{item.etiqueta}</Text>
                <Text style={styles.masDetalle}>{item.detalle}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
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
        {BARRA.map((t) => {
          const activa = tabBarDe(tab) === t.id
          return (
            <Pressable
              key={t.id}
              style={styles.tab}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={t.etiqueta}
            >
              <Text style={[styles.tabTexto, activa && { color: primario, fontWeight: '800' }]}>{t.etiqueta}</Text>
            </Pressable>
          )
        })}
      </View>
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  headerTitulo: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  offlineBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  offlineTexto: { color: '#1B2430', fontSize: 11, fontWeight: '800' },
  masLista: { padding: 16, gap: 10 },
  masItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    minHeight: 64,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  masTitulo: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  masDetalle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'android' ? 12 : 22,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  tabTexto: { fontSize: 13, color: '#64748B', fontWeight: '600' },
})
