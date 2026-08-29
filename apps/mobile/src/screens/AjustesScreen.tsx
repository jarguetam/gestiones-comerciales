/**
 * M-10 Ajustes: perfil, rastreo de jornada, cambio de contraseña y cierre de sesión.
 */
import React, { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import Constants from 'expo-constants'
import { BACKEND_CONFIGURADO, DEMO_MODE, desactivarSesionDemo, supabase, type Perfil } from '../lib/supabase'
import { TEXTO_PERMISO_UBICACION } from '../services/rastreoServicio'
import { Boton, Campo, Card } from '../components/ui'
import { useTheme } from '../theme'

interface Props {
  perfil: Perfil
  rastreoOn: boolean
  onRastreo: (activo: boolean) => void
  onLogout: () => void
  onAbrirCola?: () => void
}

export default function AjustesScreen({ perfil, rastreoOn, onRastreo, onLogout, onAbrirCola }: Props) {
  const t = useTheme()
  const [nueva, setNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const version = Constants.expoConfig?.version ?? '1.0.0'

  async function handleLogout() {
    desactivarSesionDemo()
    if (BACKEND_CONFIGURADO) await supabase.auth.signOut()
    onLogout()
  }

  function handleRastreo(valor: boolean) {
    if (valor) {
      Alert.alert('Ubicación durante la jornada', TEXTO_PERMISO_UBICACION, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => onRastreo(true) },
      ])
      return
    }
    onRastreo(false)
  }

  async function cambiarPassword() {
    if (DEMO_MODE) {
      Alert.alert('Modo demo', 'El cambio de contraseña requiere backend.')
      return
    }
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
        <View style={styles.fila}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.valor, { color: t.ink }]}>Rastreo de jornada</Text>
            <Text style={[styles.ayuda, { color: t.muted }]}>{TEXTO_PERMISO_UBICACION}</Text>
          </View>
          <Switch
            value={rastreoOn}
            onValueChange={handleRastreo}
            accessibilityLabel="Rastreo de jornada"
            accessibilityState={{ checked: rastreoOn }}
          />
        </View>
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
  ayuda: { fontSize: 12, marginTop: 4 },
  fila: { flexDirection: 'row', alignItems: 'center' },
})
