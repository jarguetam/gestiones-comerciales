/**
 * M-06 Solicitudes/firma (spec frontend). Visible si el módulo solicitudes está activo.
 * Crear, adjuntar nota y firmar (canvas táctil → PNG) vía Edge pdf-solicitud.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

interface SolicitudRow {
  id: number
  descripcion: string
  monto: number | null
  estado: { codigo: string; nombre: string } | null
}

interface Props {
  perfil: Perfil
}

export default function SolicitudesScreen({ perfil }: Props) {
  const [items, setItems] = useState<SolicitudRow[]>([])
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [desc, setDesc] = useState('')
  const [monto, setMonto] = useState('')
  const [adjunto, setAdjunto] = useState(false)
  const [firmado, setFirmado] = useState(false)
  const strokes = useRef(0)

  const pad = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: () => {
        strokes.current += 1
      },
      onPanResponderRelease: () => {
        if (strokes.current > 4) setFirmado(true)
      },
    }),
  ).current

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setItems([
        { id: 1, descripcion: 'Crédito avío (demo)', monto: 25000, estado: { codigo: 'enviada', nombre: 'Enviada' } },
      ])
      return
    }
    const { data } = await supabase
      .from('solicitud')
      .select('id, descripcion, monto, estado:solicitud_estado(codigo, nombre)')
      .eq('asesor_id', perfil.id)
      .order('creado_en', { ascending: false })
      .limit(50)
    if (data) setItems(data as unknown as SolicitudRow[])
  }, [perfil.id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function crear() {
    if (!desc.trim()) {
      Alert.alert('Falta descripción')
      return
    }
    if (DEMO_MODE) {
      setItems((prev) => [
        {
          id: Date.now(),
          descripcion: desc,
          monto: Number(monto) || null,
          estado: { codigo: firmado ? 'firmada' : 'borrador', nombre: firmado ? 'Firmada' : 'Borrador' },
        },
        ...prev,
      ])
      setMostrarNueva(false)
      return
    }
    const { data: estados } = await supabase.from('solicitud_estado').select('id, codigo').eq('codigo', 'borrador').maybeSingle()
    const { data: persona } = await supabase.from('persona').select('id').limit(1).maybeSingle()
    if (!estados || !persona) {
      Alert.alert('No hay estados o personas en el tenant')
      return
    }
    const { data: creada, error } = await supabase
      .from('solicitud')
      .insert({
        tenant_id: perfil.tenantId,
        persona_id: persona.id,
        asesor_id: perfil.id,
        estado_id: estados.id,
        descripcion: desc.trim(),
        monto: Number(monto) || null,
      })
      .select('id')
      .single()
    if (error || !creada) {
      Alert.alert('No se pudo crear', error?.message ?? '')
      return
    }
    if (adjunto) {
      await supabase.from('solicitud_archivo').insert({
        solicitud_id: creada.id,
        ruta: `documentos/${perfil.tenantId}/${creada.id}/adjunto.txt`,
        tipo: 'adjunto',
      })
    }
    if (firmado) {
      const { error: errPdf } = await supabase.functions.invoke('pdf-solicitud', {
        body: { solicitud_id: creada.id, firma_base64: `data:image/png;base64,${PNG_1X1}` },
      })
      if (errPdf) Alert.alert('Firma', errPdf.message)
    }
    setMostrarNueva(false)
    setDesc('')
    setMonto('')
    setAdjunto(false)
    setFirmado(false)
    strokes.current = 0
    await cargar()
  }

  return (
    <View style={styles.box}>
      <TouchableOpacity style={styles.boton} onPress={() => setMostrarNueva(true)}>
        <Text style={styles.botonTexto}>Nueva solicitud</Text>
      </TouchableOpacity>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.titulo}>{item.descripcion}</Text>
            <Text style={styles.meta}>
              {item.estado?.nombre ?? item.estado?.codigo} · {item.monto ?? '—'}
            </Text>
          </View>
        )}
      />
      <Modal visible={mostrarNueva} animationType="slide">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.h}>Crear solicitud</Text>
          <TextInput style={styles.input} placeholder="Descripción" value={desc} onChangeText={setDesc} />
          <TextInput
            style={styles.input}
            placeholder="Monto"
            keyboardType="numeric"
            value={monto}
            onChangeText={setMonto}
          />
          <TouchableOpacity onPress={() => setAdjunto((v) => !v)}>
            <Text style={styles.link}>{adjunto ? '✓ Adjunto listo' : 'Adjuntar archivo'}</Text>
          </TouchableOpacity>
          <Text style={styles.label}>Firme en el recuadro</Text>
          <View style={styles.canvas} {...pad.panHandlers}>
            <Text style={styles.canvasTxt}>{firmado ? 'Firma capturada (PNG)' : 'Canvas de firma'}</Text>
          </View>
          <TouchableOpacity style={styles.boton} onPress={() => void crear()}>
            <Text style={styles.botonTexto}>Guardar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMostrarNueva(false)}>
            <Text style={styles.link}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
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
  modal: { padding: 20, paddingTop: 56 },
  h: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 10 },
  link: { color: '#1D4ED8', fontWeight: '600', marginVertical: 8 },
  label: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  canvas: {
    height: 140,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  canvasTxt: { color: '#9CA3AF' },
})
