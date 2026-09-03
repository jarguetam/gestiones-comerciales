/**
 * Estado de rastreo de jornada (solo lectura).
 * El intervalo lo define el admin en config_rastreo; el asesor no puede apagarlo.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'

export interface RastreoEstadoProps {
  bloqueado: boolean
  intervaloMin?: number | null
}

export function RastreoEstado({ bloqueado, intervaloMin }: RastreoEstadoProps) {
  const t = useTheme()
  const minutos = Math.max(1, intervaloMin ?? 15)
  const texto = bloqueado ? 'Bloqueado: activá Ubicación' : `Activo · cada ${minutos} min`

  return (
    <View accessibilityRole="text" accessibilityLabel={`Rastreo de jornada: ${texto}`}>
      <Text style={[styles.titulo, { color: t.ink }]}>Rastreo de jornada</Text>
      <Text style={[styles.estado, { color: bloqueado ? t.danger : t.ink }]}>{texto}</Text>
      <Text style={[styles.ayuda, { color: t.muted }]}>
        Lo configura tu empresa. No se puede apagar desde el dispositivo.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  titulo: { fontSize: 15, fontWeight: '500' },
  estado: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  ayuda: { fontSize: 12, marginTop: 4 },
})
