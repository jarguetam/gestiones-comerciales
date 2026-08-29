/**
 * M-09 Sincronización (spec frontend).
 * Estado de la cola local: pendientes, errores y reintentos con backoff.
 */
import React, { useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { DEMO_MODE, supabase } from '../lib/supabase'
import { useCola } from '../lib/useCola'
import { sincronizarAhora } from '../lib/colaStore'
import { ejecutarDemo, ejecutarMutacion } from '../lib/sync'

interface Props {
  colorPrimario: string
}

export default function SyncScreen({ colorPrimario }: Props) {
  const { items, resumen } = useCola()
  const [syncing, setSyncing] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function sync() {
    setSyncing(true)
    setAviso(null)
    try {
      const next = await sincronizarAhora(DEMO_MODE ? ejecutarDemo : ejecutarMutacion(supabase))
      const r = next.filter((i) => i.estado === 'enviado').length
      setAviso(`Sincronizado. Enviados en cola: ${r}.`)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.hint}>Cola local · backoff automático</Text>
      <View style={styles.kpis}>
        <Kpi etiqueta="Pendientes" valor={resumen.pendientes} />
        <Kpi etiqueta="Errores" valor={resumen.errores} />
        <Kpi etiqueta="Enviados" valor={resumen.enviados} />
      </View>
      <TouchableOpacity
        style={[styles.boton, { backgroundColor: colorPrimario }]}
        onPress={() => void sync()}
        disabled={syncing}
      >
        {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Sincronizar ahora</Text>}
      </TouchableOpacity>
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.tipo}>{item.tipo}</Text>
            <Text style={styles.estado}>
              {item.estado} · intentos {item.intentos}/{item.maxIntentos}
            </Text>
            {item.ultimoError ? <Text style={styles.error}>{item.ultimoError}</Text> : null}
            <Text style={styles.meta}>{item.clienteKey}</Text>
          </View>
        )}
      />
    </View>
  )
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValor}>{valor}</Text>
      <Text style={styles.kpiEtiqueta}>{etiqueta}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 12 },
  hint: { fontSize: 11, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 },
  kpis: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpi: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  kpiValor: { fontSize: 22, fontWeight: '700', color: '#111827' },
  kpiEtiqueta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  boton: { borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 8 },
  botonTexto: { color: '#fff', fontWeight: '700' },
  aviso: { color: '#047857', fontSize: 13, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  tipo: { fontWeight: '700', color: '#111827' },
  estado: { color: '#4B5563', marginTop: 4, fontSize: 12 },
  error: { color: '#B91C1C', marginTop: 4, fontSize: 12 },
  meta: { color: '#9CA3AF', marginTop: 4, fontSize: 11 },
})
