import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'
import { Boton } from './Boton'

export function Vacio({
  titulo,
  descripcion,
  cta,
}: {
  titulo: string
  descripcion?: string
  cta?: { etiqueta: string; onPress: () => void }
}) {
  const t = useTheme()
  return (
    <View style={[styles.box, { borderColor: t.line, backgroundColor: t.surface }]}>
      <Text style={[styles.titulo, { color: t.ink }]}>{titulo}</Text>
      {descripcion ? <Text style={[styles.desc, { color: t.muted }]}>{descripcion}</Text> : null}
      {cta ? (
        <View style={{ marginTop: 12 }}>
          <Boton etiqueta={cta.etiqueta} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 24, alignItems: 'center', margin: 12 },
  titulo: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  desc: { fontSize: 13, textAlign: 'center', marginTop: 8 },
})
