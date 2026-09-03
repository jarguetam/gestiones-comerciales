/**
 * Bloqueo de campo cuando no hay permiso de ubicación.
 * Solo permite abrir ajustes del sistema y cerrar sesión.
 */
import React from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { Boton } from '../components/ui'
import { useTheme } from '../theme'

interface Props {
  onLogout: () => void
}

export default function CampoBloqueadoScreen({ onLogout }: Props) {
  const t = useTheme()

  return (
    <View style={[styles.box, { backgroundColor: t.canvas }]} accessibilityRole="alert">
      <Text style={[styles.titulo, { color: t.ink }]}>Ubicación requerida</Text>
      <Text style={[styles.cuerpo, { color: t.muted }]}>
        Sin permiso de ubicación no se puede usar la agenda, el check-in ni la sincronización.
        Activá Ubicación en los ajustes del teléfono.
      </Text>
      <Boton etiqueta="Abrir ajustes" onPress={() => void Linking.openSettings()} />
      <Boton etiqueta="Cerrar sesión" variante="ghost" onPress={onLogout} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  titulo: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  cuerpo: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
})
