/**
 * M-10 Ajustes: perfil, estado de rastreo (solo lectura), cambio de contraseña y cierre de sesión.
 */
import React, { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import Constants from 'expo-constants'
import { supabase, type Perfil } from '../lib/supabase'
import { RastreoEstado } from '../components/RastreoEstado'
import { Boton, Campo, Card } from '../components/ui'
import { useTheme } from '../theme'

interface Props {
  perfil: Perfil
  rastreoBloqueado?: boolean
  intervaloRastreoMin?: number | null
  onLogout: () => void
  onAbrirCola?: () => void
}

export default function AjustesScreen({
  perfil,
  rastreoBloqueado = false,
  intervaloRastreoMin,
  onLogout,
  onAbrirCola,
}: Props) {
  const t = useTheme()
  const [nueva, setNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const version = Constants.expoConfig?.version ?? '1.0.0'

  async function handleLogout() {
    await supabase.auth.signOut()
    onLogout()
  }

  async function cambiarPassword() {
    if (nueva.trim().length < 8) {
      Alert.alert('Contraseña débil', 'Usá al menos 8 caracteres.')
      return
    }
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: nueva.trim() })
    setGuardando(false)
    if (error) Alert.alert('No se pudo cambiar', error.message)
    else {
      setNueva('')
      Alert.alert('Listo', 'Contraseña actualizada.')
    }
  }

  return (
    <ScrollView
      style={[styles.contenedor, { backgroundColor: t.canvas }]}
      contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
    >
      <Card>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Nombre</Text>
        <Text style={[styles.valor, { color: t.ink }]}>{perfil.nombre}</Text>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Rol</Text>
        <Text style={[styles.valor, { color: t.ink }]}>{perfil.rol}</Text>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Empresa</Text>
        <Text style={[styles.valor, { color: t.ink }]}>{perfil.tenantNombre ?? '—'}</Text>
        <Text style={[styles.etiqueta, { color: t.muted }]}>Versión</Text>
        <Text style={[styles.valor, { color: t.ink }]}>{version}</Text>
      </Card>

      <Card>
        <RastreoEstado bloqueado={rastreoBloqueado} intervaloMin={intervaloRastreoMin} />
      </Card>

      <Card>
        <Campo
          label="Nueva contraseña"
          hint="Mínimo 8 caracteres"
          secureTextEntry
          value={nueva}
          onChangeText={setNueva}
        />
        <Boton
          etiqueta={guardando ? 'Guardando…' : 'Cambiar contraseña'}
          variante="secondary"
          onPress={() => void cambiarPassword()}
          disabled={guardando}
          cargando={guardando}
        />
      </Card>

      <View style={{ gap: 10 }}>
        {onAbrirCola ? (
          <Boton etiqueta="Cola de sincronización" variante="secondary" onPress={onAbrirCola} />
        ) : null}
        <Boton etiqueta="Salir" variante="ghost" onPress={() => void handleLogout()} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, padding: 16 },
  etiqueta: { fontSize: 12, marginTop: 8 },
  valor: { fontSize: 15, fontWeight: '500', marginTop: 2 },
})
