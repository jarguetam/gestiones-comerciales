import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'

export function BadgeEstado({ estado }: { estado: string }) {
  const t = useTheme()
  const e = estado.toLowerCase()
  let fg = t.ink
  let border = t.line
  if (['programada', 'pendiente', 'borrador', 'contactado'].includes(e)) {
    fg = t.warn
    border = t.warn
  } else if (['completada', 'nuevo', 'aprobada', 'firmada', 'enviada', 'enviado', 'confirmado'].includes(e)) {
    fg = e.startsWith('aprob') || e.startsWith('firm') || e.startsWith('env') ? t.success : t.primary
    border = fg
  } else if (['rechazada', 'rechazado', 'perdido', 'anulada', 'error'].includes(e)) {
    fg = t.danger
    border = t.danger
  }
  return (
    <View style={[styles.badge, { borderColor: border, backgroundColor: t.surface }]}>
      <Text style={[styles.texto, { color: fg }]}>{estado}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  texto: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
})
