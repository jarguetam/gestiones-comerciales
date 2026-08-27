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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'

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
      setItems((prev) => [
        { id: Date.now(), monto: n, referencia: ref || (foto ? 'boleta.jpg' : null), estado: 'pendiente' },
        ...prev,
      ])
      setMostrar(false)
      return
    }
    const { error } = await supabase.from('deposito').insert({
      tenant_id: perfil.tenantId,
      asesor_id: perfil.id,
      monto: n,
      referencia: ref.trim() || (foto ? 'boleta' : null),
      estado: 'pendiente',
    })
    if (error) {
      Alert.alert('No se pudo registrar', error.message)
      return
    }
    setMostrar(false)
    setMonto('')
    setRef('')
    setFoto(false)
    await cargar()
  }

  return (
    <View style={styles.box}>
      <TouchableOpacity style={styles.boton} onPress={() => setMostrar(true)}>
        <Text style={styles.botonTexto}>Registrar depósito</Text>
      </TouchableOpacity>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.titulo}>Q {item.monto.toFixed(2)}</Text>
            <Text style={styles.meta}>
              {item.referencia ?? 'sin boleta'} · {item.estado}
            </Text>
          </View>
        )}
      />
      <Modal visible={mostrar} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.h}>Nuevo depósito</Text>
          <TextInput
            style={styles.input}
            placeholder="Monto"
            keyboardType="numeric"
            value={monto}
            onChangeText={setMonto}
          />
          <TextInput style={styles.input} placeholder="Referencia / boleta" value={ref} onChangeText={setRef} />
          <TouchableOpacity onPress={() => setFoto((v) => !v)}>
            <Text style={styles.link}>{foto ? '✓ Foto de boleta adjunta' : 'Adjuntar foto de boleta'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boton} onPress={() => void registrar()}>
            <Text style={styles.botonTexto}>Enviar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMostrar(false)}>
            <Text style={styles.link}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 12 },
  boton: { backgroundColor: '#1D4ED8', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  botonTexto: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  titulo: { fontWeight: '600' },
  meta: { color: '#6B7280', marginTop: 4, fontSize: 12 },
  modal: { padding: 20, paddingTop: 56, flex: 1 },
  h: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 10 },
  link: { color: '#1D4ED8', fontWeight: '600', marginVertical: 8 },
})
