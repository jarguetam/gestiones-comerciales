import React, { type ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { useTheme } from '../../theme'

export function Boton({
  etiqueta,
  onPress,
  disabled,
  cargando,
  variante = 'primary',
  accessibilityLabel,
}: {
  etiqueta: string
  onPress: () => void
  disabled?: boolean
  cargando?: boolean
  variante?: 'primary' | 'secondary' | 'ghost'
  accessibilityLabel?: string
}) {
  const t = useTheme()
  const bg =
    variante === 'primary' ? t.primary : variante === 'secondary' ? t.surface : 'transparent'
  const fg = variante === 'primary' ? t.onPrimary : t.ink
  const border = variante === 'secondary' ? t.line : 'transparent'
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || cargando}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? etiqueta}
      accessibilityState={{ disabled: !!(disabled || cargando), busy: !!cargando }}
      style={[
        styles.boton,
        { backgroundColor: bg, borderColor: border, borderWidth: variante === 'secondary' ? 1 : 0, opacity: disabled || cargando ? 0.6 : 1 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.texto, { color: fg }]}>{etiqueta}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  boton: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  texto: { fontWeight: '700', fontSize: 15 },
})
