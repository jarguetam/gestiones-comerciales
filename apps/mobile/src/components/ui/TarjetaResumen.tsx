import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '../../theme'
import { Icono, type IconoName } from './Icono'

interface Props {
  icono: IconoName
  titulo: string
  valor: string
  contexto: string
  /** 0–100. Solo Visitas pinta progreso con el primario. */
  progreso?: number
  destino?: string
  onPress?: () => void
}

/** M-02: tarjeta resumen de Hoy. Borde neutro, sin rail ni tinte. */
export function TarjetaResumen({ icono, titulo, valor, contexto, progreso, destino, onPress }: Props) {
  const t = useTheme()
  const etiqueta = `${titulo}: ${valor}. ${contexto}${destino ? `. Abre ${destino}` : ''}`
  const contenido = (
    <>
      <View style={styles.cabecera}>
        <Text style={[styles.titulo, { color: t.muted }]}>{titulo}</Text>
        <Icono name={icono} color={t.muted} size={18} />
      </View>
      <Text style={[styles.valor, { color: t.ink }]}>{valor}</Text>
      <Text style={[styles.contexto, { color: t.muted }]} numberOfLines={2}>
        {contexto}
      </Text>
      {progreso != null ? (
        <View style={[styles.barra, { backgroundColor: t.canvas }]}>
          <View style={[styles.barraFill, { width: `${progreso}%`, backgroundColor: t.primary }]} />
        </View>
      ) : null}
    </>
  )
  const estilo = [styles.tarjeta, { backgroundColor: t.surface, borderColor: t.line }]
  if (!onPress) {
    return (
      <View style={estilo} accessible accessibilityLabel={etiqueta}>
        {contenido}
      </View>
    )
  }
  return (
    <TouchableOpacity style={estilo} onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta}>
      {contenido}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  tarjeta: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 13, fontWeight: '600' },
  valor: { fontSize: 26, fontWeight: '700', marginTop: 6 },
  contexto: { fontSize: 12, marginTop: 2 },
  barra: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  barraFill: { height: '100%', borderRadius: 999 },
})
