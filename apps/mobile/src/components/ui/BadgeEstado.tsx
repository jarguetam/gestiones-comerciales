import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'

export function BadgeEstado({ estado }: { estado: string }) {
  const t = useTheme()
  const e = estado.toLowerCase()
  let bg = t.canvas
  let fg = t.ink
  if (['programada', 'pendiente', 'borrador', 'contactado'].includes(e)) {
    bg = '#FEF3C7'
    fg = '#92400E'
  } else if (['completada', 'nuevo'].includes(e)) {
    bg = t.primary + '22'
    fg = t.primary
  } else if (['aprobada', 'firmada', 'enviada', 'enviado', 'confirmado'].includes(e)) {
    bg = '#D1FAE5'
    fg = t.success
  } else if (['rechazada', 'rechazado', 'perdido', 'anulada', 'error'].includes(e)) {
    bg = '#FEE2E2'
    fg = t.danger
  }
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.texto, { color: fg }]}>{estado}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  texto: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
})
