/**
 * M-08 Notificaciones (spec frontend).
 * Inbox in-app + marcar leídas + deep-link gestiones://visita|solicitud.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { DEMO_MODE, supabase } from '../lib/supabase'
import {
  contarNoLeidas,
  demoNotificaciones,
  deepLinkDe,
  marcarLeida,
  type ItemNotificacion,
} from '../lib/notificaciones'
import { Card, Vacio } from '../components/ui'
import { useTheme } from '../theme'

interface Props {
  colorPrimario: string
}

export default function NotificacionesScreen({ colorPrimario }: Props) {
  const t = useTheme()
  const primario = colorPrimario || t.primary
  const [items, setItems] = useState<ItemNotificacion[]>(demoNotificaciones())
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setItems(demoNotificaciones())
      return
    }
    const { data, error } = await supabase
      .from('notificacion')
      .select('id, titulo, cuerpo, leida, creado_en, datos')
      .order('creado_en', { ascending: false })
      .limit(100)
    if (error) {
      setError(error.message)
      return
    }
    setItems(
      ((data ?? []) as Array<Record<string, unknown>>).map((n) => ({
        id: String(n.id),
        titulo: String(n.titulo),
        cuerpo: String(n.cuerpo),
        leida: Boolean(n.leida),
        creado_en: String(n.creado_en),
        datos: (n.datos as Record<string, unknown> | undefined) ?? undefined,
      })),
    )
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function leer(item: ItemNotificacion) {
    setItems((prev) => marcarLeida(prev, item.id))
    const link = deepLinkDe(item.datos)
    if (link) void Linking.openURL(link).catch(() => undefined)
    if (DEMO_MODE) return
    const { error } = await supabase.from('notificacion').update({ leida: true }).eq('id', item.id)
    if (error) setError(error.message)
  }

  const pendientes = contarNoLeidas(items)

  return (
    <View style={styles.box}>
      <Text style={[styles.hint, { color: t.muted }]}>{pendientes} sin leer</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<Vacio titulo="Sin notificaciones" />}
        renderItem={({ item }) => (
          <Card style={!item.leida ? { borderColor: primario } : undefined}>
            <Text style={styles.titulo}>{item.titulo}</Text>
            <Text style={styles.cuerpo}>{item.cuerpo}</Text>
            {deepLinkDe(item.datos) ? (
              <Text style={[styles.link, { color: primario }]}>{deepLinkDe(item.datos)}</Text>
            ) : null}
            {!item.leida ? (
              <TouchableOpacity onPress={() => void leer(item)}>
                <Text style={[styles.accion, { color: primario }]}>Marcar leída</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 12 },
  hint: { fontSize: 11, marginBottom: 8 },
  error: { color: '#B91C1C', marginBottom: 8 },
  titulo: { fontWeight: '700', fontSize: 15, color: '#111827' },
  cuerpo: { color: '#4B5563', marginTop: 4, fontSize: 13 },
  link: { marginTop: 6, fontSize: 11, fontWeight: '600' },
  accion: { marginTop: 10, fontWeight: '700', fontSize: 13 },
})
