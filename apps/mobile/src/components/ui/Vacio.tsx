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
  const marca = titulo.trim().slice(0, 1).toUpperCase() || '—'
  return (
    <View style={[styles.box, { borderColor: t.line, backgroundColor: t.surface }]}>
      <Text style={[styles.marca, { color: t.ink }]} accessibilityElementsHidden>
        {marca}
      </Text>
      <Text style={[styles.titulo, { color: t.ink }]}>{titulo}</Text>
      {descripcion ? <Text style={[styles.desc, { color: t.muted }]}>{descripcion}</Text> : null}
      {cta ? (
        <View style={{ marginTop: 12, alignSelf: 'stretch' }}>
          <Boton etiqueta={cta.etiqueta} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 28, alignItems: 'center', margin: 12 },
  marca: { fontSize: 56, fontWeight: '800', letterSpacing: -2, opacity: 0.15 },
  titulo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', marginTop: 8 },
  desc: { fontSize: 13, textAlign: 'center', marginTop: 8 },
})
