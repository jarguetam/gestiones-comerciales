/**
 * @gc/mobile — App del asesor de campo (F1.11 MVP + F3 módulos).
 * Tabs: M-02 Agenda, M-03 Persona, M-11 Leads, M-06 Solicitudes, M-07 Depósitos, M-10 Ajustes.
 * M-06/M-07 solo si el tenant tiene el módulo activo (en DEMO_MODE se muestran).
 */
import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import LoginScreen from './screens/LoginScreen'
import AgendaScreen from './screens/AgendaScreen'
import PersonaScreen from './screens/PersonaScreen'
import LeadsScreen from './screens/LeadsScreen'
import SolicitudesScreen from './screens/SolicitudesScreen'
import DepositosScreen from './screens/DepositosScreen'
import AjustesScreen from './screens/AjustesScreen'
import { claimsDe, DEMO_MODE, supabase, type Perfil, cargarPerfil } from './lib/supabase'

type Tab = 'agenda' | 'personas' | 'leads' | 'solicitudes' | 'depositos' | 'ajustes'

const TITULOS: Record<Tab, string> = {
  agenda: 'Agenda de hoy',
  personas: 'Cartera',
  leads: 'Mis leads',
  solicitudes: 'Solicitudes',
  depositos: 'Depósitos',
  ajustes: 'Ajustes',
}

export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [tab, setTab] = useState<Tab>('agenda')
  const [listo, setListo] = useState(false)

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

  if (!listo) return <View style={styles.fondo} />

  if (!perfil) {
    return (
      <View style={styles.fondo}>
        <LoginScreen onLogin={setPerfil} />
        <StatusBar style="dark" />
      </View>
    )
  }

  const tabs: { id: Tab; etiqueta: string }[] = [
    { id: 'agenda', etiqueta: 'Agenda' },
    { id: 'personas', etiqueta: 'Cartera' },
    { id: 'leads', etiqueta: 'Leads' },
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
      <View style={styles.header}>
        <Text style={styles.headerTitulo}>{TITULOS[tab]}</Text>
        <Text style={styles.headerSub}>{perfil.tenantNombre ?? perfil.nombre}</Text>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'agenda' && <AgendaScreen perfil={perfil} />}
        {tab === 'personas' && <PersonaScreen />}
        {tab === 'leads' && <LeadsScreen perfil={perfil} />}
        {tab === 'solicitudes' && <SolicitudesScreen perfil={perfil} />}
        {tab === 'depositos' && <DepositosScreen perfil={perfil} />}
        {tab === 'ajustes' && <AjustesScreen perfil={perfil} onLogout={() => setPerfil(null)} />}
      </View>

      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.id} style={styles.tab} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabTexto, tab === t.id && styles.tabActivo]}>{t.etiqueta}</Text>
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
    backgroundColor: '#1D4ED8',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerTitulo: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#BFDBFE', fontSize: 12, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 24,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabTexto: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  tabActivo: { color: '#1D4ED8', fontWeight: '700' },
})
