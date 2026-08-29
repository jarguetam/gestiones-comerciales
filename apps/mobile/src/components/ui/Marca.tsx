import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'
import { logoUrlValido, monograma } from '../../lib/branding'

export function Marca({ nombre, logoUrl, compact }: { nombre: string; logoUrl?: string | null; compact?: boolean }) {
  const t = useTheme()
  const url = logoUrlValido(logoUrl)
  const size = compact ? 28 : 40
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityLabel={`Logo de ${nombre}`}
        style={{ width: size, height: size, borderRadius: 8, backgroundColor: t.surface }}
      />
    )
  }
  return (
    <View
      style={[styles.mono, { width: size, height: size, backgroundColor: t.primary }]}
      accessibilityLabel={nombre}
    >
      <Text style={[styles.letras, { fontSize: compact ? 11 : 14, color: t.onPrimary }]}>{monograma(nombre)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  mono: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  letras: { fontWeight: '800' },
})
