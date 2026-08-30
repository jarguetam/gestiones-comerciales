/**
 * @gc/mobile — App del asesor de campo.
 * Tabs de operación + inbox/cola/salir desde el header. Theming desde tenant.branding.
 * Producción: cola persistente (SQLite), push FCM, rastreo de jornada y deep links.
 */
import React, { useEffect, useState } from 'react'
import {
  AppState,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
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
import { supabase, type Perfil, cargarPerfil, resolverClaims } from './lib/supabase'
import { nombreComercial } from './lib/branding'
import { useCola } from './lib/useCola'
import { contarNoLeidas } from './lib/notificaciones'
import { configurarPersistencia, hidratarDesdePersistencia, sincronizarAhora } from './lib/colaStore'
import { abrirPersistenciaCola } from './lib/abrirCola'
import { ejecutarMutacion } from './lib/sync'
import { parseDeepLink } from './lib/deepLink'
import { registrarDispositivo } from './lib/dispositivo'
import { tokenPushNativo } from './lib/push'
import { detenerRastreo, iniciarRastreo } from './services/rastreoServicio'
import { ThemeProvider, useTheme } from './theme'
import { Cargando, Icono, Marca, type IconoName } from './components/ui'

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

export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    void (async () => {
      const persist = await abrirPersistenciaCola()
      configurarPersistencia(persist)
      await hidratarDesdePersistencia()
    })()
  }, [])

  useEffect(() => {
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
    const t = setInterval(() => {
      void sincronizarAhora(ejecutarMutacion(supabase))
    }, 30_000)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void sincronizarAhora(ejecutarMutacion(supabase))
      }
    })
    return () => {
      clearInterval(t)
      sub.remove()
    }
  }, [perfil])

  return (
    <ThemeProvider branding={perfil?.branding}>
      {!listo ? (
        <Cargando etiqueta="Cargando sesión…" />
      ) : !perfil ? (
        <View style={{ flex: 1 }}>
          <LoginScreen onLogin={setPerfil} />
          <ExpoStatusBar style="dark" />
        </View>
      ) : (
        <Shell perfil={perfil} onLogout={() => setPerfil(null)} />
      )}
    </ThemeProvider>
  )
}

function Shell({ perfil, onLogout }: { perfil: Perfil; onLogout: () => void }) {
  const t = useTheme()
  const [tab, setTab] = useState<Tab>('agenda')
  const [mas, setMas] = useState(false)
  const [noLeidas, setNoLeidas] = useState(0)
  const { pendientes } = useCola()
  const marca = nombreComercial(perfil.branding, perfil.tenantNombre ?? perfil.nombre)

  useEffect(() => {
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
  }, [perfil.id])

  useEffect(() => {
    void iniciarRastreo(supabase)
    return () => {
      void detenerRastreo(supabase)
    }
  }, [perfil.id])

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
    supabase
      .from('notificacion')
      .select('id', { count: 'exact', head: true })
      .eq('leida', false)
      .then(({ count }) => {
        if (typeof count === 'number') setNoLeidas(count)
      })
  }, [tab])

  async function handleLogout() {
    await detenerRastreo(supabase)
    await supabase.auth.signOut()
    onLogout()
  }

  const extras: { id: Extract<IconoName, 'solicitudes' | 'depositos' | 'ajustes'>; etiqueta: string }[] = [
    ...(perfil.modulos.includes('solicitudes')
      ? [{ id: 'solicitudes' as const, etiqueta: 'Solicitudes' }]
      : []),
    ...(perfil.modulos.includes('depositos')
      ? [{ id: 'depositos' as const, etiqueta: 'Depósitos' }]
      : []),
    { id: 'ajustes', etiqueta: 'Ajustes' },
  ]
  const principales: { id: Extract<IconoName, 'agenda' | 'personas' | 'leads' | 'formularios'>; etiqueta: string }[] = [
    { id: 'agenda', etiqueta: 'Agenda' },
    { id: 'personas', etiqueta: 'Cartera' },
    { id: 'leads', etiqueta: 'Leads' },
    { id: 'formularios', etiqueta: 'Fichas' },
  ]
  const masActivo = extras.some((e) => e.id === tab)

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.canvas }]}>
      <View style={[styles.header, { backgroundColor: t.surface, borderBottomColor: t.line, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 8) : 8 }]}>
        <Marca nombre={marca} logoUrl={perfil.branding.logo_url} compact />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitulo, { color: t.ink }]}>{TITULOS[tab]}</Text>
          <Text style={[styles.headerSub, { color: t.muted }]}>{marca}</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, { borderColor: t.line }]}
          onPress={() => setTab('notificaciones')}
          accessibilityLabel="Notificaciones"
          accessibilityState={{ selected: tab === 'notificaciones' }}
        >
          <Icono name="inbox" color={t.ink} size={18} />
          {noLeidas > 0 ? (
            <View style={[styles.badge, { backgroundColor: t.primary }]}>
              <Text style={styles.badgeTexto}>{noLeidas}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerBtn, { borderColor: t.line }]}
          onPress={() => setTab('sync')}
          accessibilityLabel="Sincronización"
          accessibilityState={{ selected: tab === 'sync' }}
        >
          <Icono name="cola" color={t.ink} size={18} />
          {pendientes > 0 ? (
            <View style={[styles.badge, { backgroundColor: t.warn }]}>
              <Text style={styles.badgeTexto}>{pendientes}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerBtn, { borderColor: t.line }]}
          onPress={() => void handleLogout()}
          accessibilityLabel="Salir"
          accessibilityRole="button"
        >
          <Icono name="salir" color={t.ink} size={18} />
          <Text style={[styles.headerBtnTexto, { color: t.ink }]}>Salir</Text>
        </TouchableOpacity>
      </View>

      {pendientes > 0 ? (
        <View style={[styles.offline, { backgroundColor: t.warningBg, borderColor: t.warningBorder }]} accessibilityRole="alert">
          <Text style={[styles.offlineTexto, { color: t.warningText }]}>
            {pendientes} mutaciones pendientes de enviar
          </Text>
        </View>
      ) : null}

      <View style={[styles.body, { backgroundColor: t.canvas }]}>
        {tab === 'agenda' && <AgendaScreen perfil={perfil} />}
        {tab === 'personas' && <PersonaScreen perfil={perfil} />}
        {tab === 'leads' && <LeadsScreen perfil={perfil} />}
        {tab === 'formularios' && <FormulariosScreen perfil={perfil} />}
        {tab === 'solicitudes' && <SolicitudesScreen perfil={perfil} />}
        {tab === 'depositos' && <DepositosScreen perfil={perfil} />}
        {tab === 'ajustes' && (
          <AjustesScreen
            perfil={perfil}
            onLogout={() => void handleLogout()}
            onAbrirCola={() => setTab('sync')}
          />
        )}
        {tab === 'notificaciones' && (
          <NotificacionesScreen
            colorPrimario={t.primary}
            onDeepLink={(url) => {
              const dest = parseDeepLink(url)
              if (dest) setTab(dest.tab)
            }}
          />
        )}
        {tab === 'sync' && <SyncScreen colorPrimario={t.primary} />}
      </View>

      <View style={[styles.tabs, { backgroundColor: t.surface, borderTopColor: t.line }]}>
        {principales.map((item) => {
          const activo = tab === item.id
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.tab}
              onPress={() => setTab(item.id)}
              accessibilityRole="tab"
              accessibilityLabel={item.etiqueta}
              accessibilityState={{ selected: activo }}
            >
              <View style={[styles.tabIndicador, { backgroundColor: activo ? t.primary : 'transparent' }]} />
              <Icono name={item.id} color={activo ? t.primary : t.muted} size={22} />
              <Text style={[styles.tabTexto, { color: activo ? t.primary : t.muted, fontWeight: activo ? '700' : '500' }]}>
                {item.etiqueta}
              </Text>
            </TouchableOpacity>
          )
        })}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setMas(true)}
          accessibilityRole="button"
          accessibilityLabel="Más opciones"
          accessibilityState={{ selected: masActivo }}
        >
          <View style={[styles.tabIndicador, { backgroundColor: masActivo ? t.primary : 'transparent' }]} />
          <Icono name="mas" color={masActivo ? t.primary : t.muted} size={22} />
          <Text style={[styles.tabTexto, { color: masActivo ? t.primary : t.muted, fontWeight: masActivo ? '700' : '500' }]}>
            Más
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={mas} transparent animationType="fade" onRequestClose={() => setMas(false)}>
        <TouchableOpacity style={styles.masFondo} activeOpacity={1} onPress={() => setMas(false)}>
          <View style={[styles.masHoja, { backgroundColor: t.surface }]}>
            {extras.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.masItem}
                onPress={() => {
                  setTab(item.id)
                  setMas(false)
                }}
                accessibilityRole="button"
                accessibilityLabel={item.etiqueta}
              >
                <Icono name={item.id} color={t.ink} size={20} />
                <Text style={[styles.masTexto, { color: t.ink }]}>{item.etiqueta}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.masItem, { marginTop: 8, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 16 }]}
              onPress={() => {
                setMas(false)
                void handleLogout()
              }}
              accessibilityRole="button"
              accessibilityLabel="Salir"
            >
              <Icono name="salir" color={t.ink} size={20} />
              <Text style={[styles.masTexto, { color: t.ink }]}>Salir</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderBottomWidth: 1,
  },
  headerTitulo: { fontSize: 17, fontWeight: '600' },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerBtn: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnTexto: { fontSize: 10, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 999,
    minWidth: 16,
    paddingHorizontal: 4,
  },
  badgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  offline: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  offlineTexto: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  body: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 6,
    minHeight: 56,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, paddingTop: 6, paddingBottom: 8, gap: 3 },
  tabIndicador: { position: 'absolute', top: 0, width: 18, height: 2, borderRadius: 1 },
  tabTexto: { fontSize: 11 },
  masFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  masHoja: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28, gap: 4 },
  masItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  masTexto: { fontSize: 16, fontWeight: '600' },
})
