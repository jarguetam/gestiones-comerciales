import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'

export function Cargando({ etiqueta = 'Cargando…' }: { etiqueta?: string }) {
  const t = useTheme()
  return (
    <View style={styles.box} accessibilityRole="progressbar" accessibilityLabel={etiqueta}>
      <ActivityIndicator size="large" color={t.primary} />
      <Text style={[styles.texto, { color: t.muted }]}>{etiqueta}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  texto: { fontSize: 13 },
})
