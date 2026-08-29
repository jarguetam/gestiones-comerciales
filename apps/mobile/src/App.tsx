/**
 * @gc/mobile — App del asesor de campo.
 * Tabs de operación + inbox/cola desde el header. Theming desde tenant.branding.
 */
import React, { useEffect, useState } from 'react'
import { Modal, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
import { claimsDe, DEMO_MODE, supabase, type Perfil, cargarPerfil } from './lib/supabase'
import { nombreComercial } from './lib/branding'
import { useCola } from './lib/useCola'
import { demoNotificaciones, contarNoLeidas } from './lib/notificaciones'
import { configurarPersistencia, hidratarDesdePersistencia, sincronizarAhora } from './lib/colaStore'
import { abrirPersistenciaCola } from './lib/abrirCola'
import { ejecutarDemo, ejecutarMutacion } from './lib/sync'
import { ThemeProvider, useTheme } from './theme'
import { Cargando, Marca } from './components/ui'

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

const ICONOS: Record<string, string> = {
  agenda: '📅',
  personas: '👤',
  leads: '🎯',
  formularios: '📋',
  solicitudes: '📄',
  depositos: '💰',
  ajustes: '⚙',
  mas: '⋯',
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
    if (DEMO_MODE) {
      setListo(true)
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const claims = claimsDe(data.session.access_token)
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
    const t = setInterval(() => {
      void sincronizarAhora(DEMO_MODE ? ejecutarDemo : ejecutarMutacion(supabase))
    }, 30_000)
    return () => clearInterval(t)
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
  const { pendientes } = useCola()
  const noLeidas = contarNoLeidas(demoNotificaciones())
  const marca = nombreComercial(perfil.branding, perfil.tenantNombre ?? perfil.nombre)

  const extras: { id: Tab; etiqueta: string }[] = [
    ...(DEMO_MODE || perfil.modulos.includes('solicitudes')
      ? [{ id: 'solicitudes' as const, etiqueta: 'Solicitudes' }]
      : []),
    ...(DEMO_MODE || perfil.modulos.includes('depositos')
      ? [{ id: 'depositos' as const, etiqueta: 'Depósitos' }]
      : []),
    { id: 'ajustes', etiqueta: 'Ajustes' },
  ]
  const principales: { id: Tab; etiqueta: string }[] = [
    { id: 'agenda', etiqueta: 'Agenda' },
    { id: 'personas', etiqueta: 'Cartera' },
    { id: 'leads', etiqueta: 'Leads' },
    { id: 'formularios', etiqueta: 'Fichas' },
  ]
  const masActivo = extras.some((e) => e.id === tab)

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.primary }]}>
      <View style={[styles.header, { backgroundColor: t.primary, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 8) : 8 }]}>
        <Marca nombre={marca} logoUrl={perfil.branding.logo_url} compact />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitulo, { color: t.onPrimary }]}>{TITULOS[tab]}</Text>
          <Text style={[styles.headerSub, { color: t.onPrimaryMuted }]}>{marca}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setTab('notificaciones')}
          accessibilityLabel="Notificaciones"
          accessibilityState={{ selected: tab === 'notificaciones' }}
        >
          <Text style={styles.headerBtnTexto}>🔔</Text>
          {noLeidas > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{noLeidas}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setTab('sync')}
          accessibilityLabel="Sincronización"
          accessibilityState={{ selected: tab === 'sync' }}
        >
          <Text style={styles.headerBtnTexto}>Cola</Text>
          {pendientes > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{pendientes}</Text>
            </View>
          ) : null}
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
          <AjustesScreen perfil={perfil} onLogout={onLogout} onAbrirCola={() => setTab('sync')} />
        )}
        {tab === 'notificaciones' && <NotificacionesScreen colorPrimario={t.primary} />}
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
              <Text style={{ fontSize: 16 }}>{ICONOS[item.id]}</Text>
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
          <Text style={{ fontSize: 16 }}>{ICONOS.mas}</Text>
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
                <Text style={{ fontSize: 18 }}>{ICONOS[item.id]}</Text>
                <Text style={[styles.masTexto, { color: t.ink }]}>{item.etiqueta}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      <ExpoStatusBar style="light" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  headerTitulo: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
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
  offline: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  offlineTexto: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  body: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 8,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  tabTexto: { fontSize: 10 },
  masFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  masHoja: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28, gap: 4 },
  masItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  masTexto: { fontSize: 16, fontWeight: '600' },
})
