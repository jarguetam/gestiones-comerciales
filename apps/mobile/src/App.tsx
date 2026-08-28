/**
 * @gc/mobile — App del asesor de campo.
 * Tabs de operación + M-08/M-09 desde el header. Theming desde tenant.branding.
 */
import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
import { claimsDe, DEMO_MODE, supabase, type Perfil, cargarPerfil } from './lib/supabase'
import { colorPrimario } from './lib/branding'
import { useCola } from './lib/useCola'
import { demoNotificaciones, contarNoLeidas } from './lib/notificaciones'
import { sincronizarAhora } from './lib/colaStore'
import { ejecutarDemo, ejecutarMutacion } from './lib/sync'

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
  const [tab, setTab] = useState<Tab>('agenda')
  const [listo, setListo] = useState(false)
  const { pendientes } = useCola()
  const noLeidas = contarNoLeidas(demoNotificaciones())

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
        <TouchableOpacity style={styles.headerBtn} onPress={() => setTab('notificaciones')} accessibilityLabel="Notificaciones">
          <Text style={styles.headerBtnTexto}>M-08</Text>
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
          <AjustesScreen perfil={perfil} onLogout={() => setPerfil(null)} onAbrirCola={() => setTab('sync')} />
        )}
        {tab === 'notificaciones' && <NotificacionesScreen colorPrimario={primario} />}
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
