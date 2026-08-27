/**
 * @gc/mobile — App del asesor de campo (F1.11 MVP).
 * Tabs: M-02 Agenda (con M-04 check-in GPS y rastreo por intervalo),
 * M-03 Persona (cartera + alta) y M-10 Ajustes. M-01 Login si no hay sesión.
 */
import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import LoginScreen from './screens/LoginScreen'
import AgendaScreen from './screens/AgendaScreen'
import PersonaScreen from './screens/PersonaScreen'
import AjustesScreen from './screens/AjustesScreen'
import { claimsDe, DEMO_MODE, supabase, type Perfil, cargarPerfil } from './lib/supabase'

type Tab = 'agenda' | 'personas' | 'ajustes'

export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [tab, setTab] = useState<Tab>('agenda')
  const [listo, setListo] = useState(false)

  // Restaura la sesión si el usuario ya ingresó antes
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

  return (
    <View style={styles.fondo}>
      <View style={styles.header}>
        <Text style={styles.headerTitulo}>
          {tab === 'agenda' ? 'Agenda de hoy' : tab === 'personas' ? 'Cartera' : 'Ajustes'}
        </Text>
        <Text style={styles.headerSub}>{perfil.tenantNombre ?? perfil.nombre}</Text>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'agenda' && <AgendaScreen perfil={perfil} />}
        {tab === 'personas' && <PersonaScreen />}
        {tab === 'ajustes' && <AjustesScreen perfil={perfil} onLogout={() => setPerfil(null)} />}
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'agenda', etiqueta: 'Agenda' },
            { id: 'personas', etiqueta: 'Cartera' },
            { id: 'ajustes', etiqueta: 'Ajustes' },
          ] as { id: Tab; etiqueta: string }[]
        ).map((t) => (
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
  tabTexto: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  tabActivo: { color: '#1D4ED8', fontWeight: '700' },
})
