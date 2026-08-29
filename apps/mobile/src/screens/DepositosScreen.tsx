/**
 * M-07 Depósitos (spec frontend). Visible si el módulo depositos está activo.
 * Registrar depósito con referencia (foto de boleta en demo = marca de adjunto).
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'
import { encolarYSync } from '../lib/colaStore'
import { ejecutarDemo, ejecutarMutacion } from '../lib/sync'
import { Boton, Campo, Card, Vacio } from '../components/ui'
import { useTheme } from '../theme'

interface DepoRow {
  id: number
  monto: number
  referencia: string | null
  estado: string
}

interface Props {
  perfil: Perfil
}

export default function DepositosScreen({ perfil }: Props) {
  const t = useTheme()
  const [items, setItems] = useState<DepoRow[]>([])
  const [mostrar, setMostrar] = useState(false)
  const [monto, setMonto] = useState('')
  const [ref, setRef] = useState('')
  const [foto, setFoto] = useState(false)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setItems([{ id: 1, monto: 2500, referencia: 'BOLETA-1044', estado: 'pendiente' }])
      return
    }
    const { data } = await supabase
      .from('deposito')
      .select('id, monto, referencia, estado')
      .eq('asesor_id', perfil.id)
      .order('creado_en', { ascending: false })
      .limit(50)
    if (data) setItems(data as DepoRow[])
  }, [perfil.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function registrar() {
    const n = Number(monto)
    if (!n || n <= 0) {
      Alert.alert('Monto inválido')
      return
    }
    if (DEMO_MODE) {
      await encolarYSync(
        {
          tipo: 'deposito',
          payload: { monto: n, referencia: ref || (foto ? 'boleta.jpg' : null), asesorId: perfil.id, tenantId: perfil.tenantId },
          clienteKey: `deposito:${n}:${Date.now()}`,
        },
        ejecutarDemo,
      )
      setItems((prev) => [
        { id: Date.now(), monto: n, referencia: ref || (foto ? 'boleta.jpg' : null), estado: 'pendiente' },
        ...prev,
      ])
      setMostrar(false)
      return
    }
    await encolarYSync(
      {
        tipo: 'deposito',
        payload: { monto: n, referencia: ref.trim() || (foto ? 'boleta' : null), asesorId: perfil.id, tenantId: perfil.tenantId },
        clienteKey: `deposito:${n}:${Date.now()}`,
      },
      ejecutarMutacion(supabase),
    )
    setMostrar(false)
    setMonto('')
    setRef('')
    setFoto(false)
    await cargar()
  }

  return (
    <View style={styles.box}>
      <Boton etiqueta="Registrar depósito" onPress={() => setMostrar(true)} />
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        ListEmptyComponent={<Vacio titulo="Sin depósitos" descripcion="Registrá el primero con boleta o referencia." />}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.titulo}>Q {item.monto.toFixed(2)}</Text>
            <Text style={[styles.meta, { color: t.muted }]}>
              {item.referencia ?? 'sin boleta'} · {item.estado}
            </Text>
          </Card>
        )}
      />
      <Modal visible={mostrar} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.h}>Nuevo depósito</Text>
          <Campo label="Monto" placeholder="Monto" keyboardType="numeric" value={monto} onChangeText={setMonto} />
          <Campo label="Referencia" placeholder="Referencia / boleta" value={ref} onChangeText={setRef} />
          <TouchableOpacity
            onPress={() => setFoto((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: foto }}
          >
            <Text style={[styles.link, { color: t.primary }]}>{foto ? '✓ Foto de boleta adjunta' : 'Adjuntar foto de boleta'}</Text>
          </TouchableOpacity>
          <Boton etiqueta="Enviar" onPress={() => void registrar()} />
          <TouchableOpacity onPress={() => setMostrar(false)}>
            <Text style={[styles.link, { color: t.primary }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 12, gap: 12 },
  titulo: { fontWeight: '600' },
  meta: { marginTop: 4, fontSize: 12 },
  modal: { padding: 20, paddingTop: 56, flex: 1 },
  h: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  link: { fontWeight: '600', marginVertical: 8 },
})
