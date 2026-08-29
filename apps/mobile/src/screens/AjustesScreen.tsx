/**
 * M-10 Ajustes: perfil, rastreo, cambio de contraseña y cierre de sesión.
 */
import React, { useState } from 'react'
import { ScrollView, Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Constants from 'expo-constants'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'
import { TEXTO_PERMISO_UBICACION } from '../services/rastreoServicio'

interface Props {
  perfil: Perfil
  rastreoOn: boolean
  onRastreo: (activo: boolean) => void
  onLogout: () => void
  onAbrirCola?: () => void
}

export default function AjustesScreen({ perfil, rastreoOn, onRastreo, onLogout, onAbrirCola }: Props) {
  const [nueva, setNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const version = Constants.expoConfig?.version ?? '1.0.0'

  async function handleLogout() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    onLogout()
  }

  async function handleRastreo(valor: boolean) {
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
    <ScrollView style={styles.contenedor} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Nombre</Text>
        <Text style={styles.valor}>{perfil.nombre}</Text>
        <Text style={styles.etiqueta}>Rol</Text>
        <Text style={styles.valor}>{perfil.rol}</Text>
        <Text style={styles.etiqueta}>Empresa</Text>
        <Text style={styles.valor}>{perfil.tenantNombre ?? '—'}</Text>
        <Text style={styles.etiqueta}>Versión</Text>
        <Text style={styles.valor}>{version}</Text>
      </View>

      <View style={styles.tarjeta}>
        <View style={styles.fila}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.valor}>Rastreo de jornada</Text>
            <Text style={styles.ayuda}>{TEXTO_PERMISO_UBICACION}</Text>
          </View>
          <Switch value={rastreoOn} onValueChange={(v) => void handleRastreo(v)} />
        </View>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Nueva contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={nueva}
          onChangeText={setNueva}
        />
        <TouchableOpacity style={styles.botonSec} onPress={() => void cambiarPassword()} disabled={guardando}>
          <Text style={styles.botonSecTexto}>{guardando ? 'Guardando…' : 'Cambiar contraseña'}</Text>
        </TouchableOpacity>
      </View>

      {onAbrirCola ? (
        <TouchableOpacity style={styles.botonCola} onPress={onAbrirCola}>
          <Text style={styles.botonColaTexto}>Cola de sincronización</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.botonSalir} onPress={() => void handleLogout()}>
        <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F3F4F6', padding: 16 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  etiqueta: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginTop: 8 },
  valor: { fontSize: 15, color: '#111827', fontWeight: '500', marginTop: 2 },
  ayuda: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  fila: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    color: '#111827',
  },
  botonSec: {
    marginTop: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonSecTexto: { color: '#1D4ED8', fontWeight: '600' },
  botonCola: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  botonColaTexto: { color: '#1D4ED8', fontWeight: '600', fontSize: 15 },
  botonSalir: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonSalirTexto: { color: '#B91C1C', fontWeight: '600', fontSize: 15 },
})
