/**
 * M-06 Solicitudes/firma (spec frontend). Visible si el módulo solicitudes está activo.
 * Crear, adjuntar nota y firmar (canvas táctil → PNG) vía Edge pdf-solicitud.
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { supabase, type Perfil } from '../lib/supabase'
import { Boton, Campo, Card, FirmaPad, Vacio } from '../components/ui'
import { useTheme } from '../theme'

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
  const t = useTheme()
  const [items, setItems] = useState<SolicitudRow[]>([])
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [desc, setDesc] = useState('')
  const [monto, setMonto] = useState('')
  const [adjunto, setAdjunto] = useState(false)
  const [firmado, setFirmado] = useState(false)

  const cargar = useCallback(async () => {
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
    await cargar()
  }

  return (
    <View style={styles.box}>
      <Boton etiqueta="Nueva solicitud" onPress={() => setMostrarNueva(true)} />
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        ListEmptyComponent={<Vacio titulo="Sin solicitudes" descripcion="Creá la primera con el botón de arriba." />}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.titulo}>{item.descripcion}</Text>
            <Text style={[styles.meta, { color: t.muted }]}>
              {item.estado?.nombre ?? item.estado?.codigo} · {item.monto ?? '—'}
            </Text>
          </Card>
        )}
      />
      <Modal visible={mostrarNueva} animationType="slide">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.h}>Crear solicitud</Text>
          <Campo label="Descripción" placeholder="Descripción" value={desc} onChangeText={setDesc} />
          <Campo label="Monto" placeholder="Monto" keyboardType="numeric" value={monto} onChangeText={setMonto} />
          <TouchableOpacity
            onPress={() => setAdjunto((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adjunto }}
          >
            <Text style={[styles.link, { color: t.primary }]}>{adjunto ? '✓ Adjunto listo' : 'Adjuntar archivo'}</Text>
          </TouchableOpacity>
          <Text style={[styles.label, { color: t.muted }]}>Firme en el recuadro</Text>
          <FirmaPad onFirmado={setFirmado} />
          <Boton etiqueta="Guardar" onPress={() => void crear()} />
          <TouchableOpacity onPress={() => setMostrarNueva(false)}>
            <Text style={[styles.link, { color: t.primary }]}>Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 12, gap: 12 },
  titulo: { fontWeight: '600' },
  meta: { marginTop: 4, fontSize: 12 },
  modal: { padding: 20, paddingTop: 56 },
  h: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  link: { fontWeight: '600', marginVertical: 8 },
  label: { fontSize: 12, marginTop: 8 },
})
