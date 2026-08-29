import React, { useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'

interface Punto {
  x: number
  y: number
}

export function FirmaPad({ onFirmado }: { onFirmado: (firmado: boolean) => void }) {
  const t = useTheme()
  const [puntos, setPuntos] = useState<Punto[]>([])
  const puntosRef = useRef<Punto[]>([])

  const pad = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
          puntosRef.current = [...puntosRef.current, p]
          setPuntos(puntosRef.current)
        },
        onPanResponderMove: (e) => {
          const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
          puntosRef.current = [...puntosRef.current, p]
          setPuntos(puntosRef.current)
          if (puntosRef.current.length > 8) onFirmado(true)
        },
      }),
    [onFirmado],
  )

  return (
    <View
      style={[styles.canvas, { borderColor: t.line, backgroundColor: t.surface }]}
      {...pad.panHandlers}
      accessibilityLabel="Lienzo de firma"
      accessibilityHint="Deslizá el dedo para firmar"
    >
      {puntos.map((p, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[styles.punto, { left: p.x - 2, top: p.y - 2, backgroundColor: t.ink }]}
        />
      ))}
      {puntos.length === 0 ? (
        <Text style={[styles.hint, { color: t.muted }]}>Firme aquí</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    height: 140,
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  punto: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  hint: { position: 'absolute', alignSelf: 'center', top: 58, fontSize: 13 },
})
