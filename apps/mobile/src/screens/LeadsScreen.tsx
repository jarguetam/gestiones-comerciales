/**
 * M-11 Mis leads + M-12 detalle (spec F2.4).
 * Lista los leads del asesor con su etapa del embudo, alta offline-friendly
 * (dedupe por teléfono), acciones llamar/WhatsApp, agendar visita y
 * convertir (lead_convertir → persona del núcleo). Las transiciones pasan
 * por el RPC lead_transicion (reglas GC-CRM-* en el servidor).
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'
import { colorPrimario } from '../lib/branding'
import NuevaVisitaModal from './NuevaVisitaModal'

interface LeadRow {
  id: number
  nombre: string
  telefono: string
  documento: string | null
  direccion: string | null
  monto_estimado: number | null
  persona_id: number | null
  estado: { codigo: string; nombre: string } | null
}

interface EstadoRow {
  id: number
  codigo: string
  nombre: string
  orden: number
  es_ganado: boolean
  es_perdido: boolean
}

const ESTILO: Record<string, { bg: string; fg: string }> = {
  nuevo: { bg: '#DBEAFE', fg: '#1D4ED8' },
  contactado: { bg: '#E0E7FF', fg: '#4338CA' },
  calificado: { bg: '#FEF3C7', fg: '#B45309' },
  ganado: { bg: '#D1FAE5', fg: '#047857' },
  perdido: { bg: '#FEE2E2', fg: '#B91C1C' },
}

interface Props {
  perfil: Perfil
}

export default function LeadsScreen({ perfil }: Props) {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [estados, setEstados] = useState<EstadoRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [seleccionado, setSeleccionado] = useState<LeadRow | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [agendarLead, setAgendarLead] = useState<LeadRow | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // alta
  const [nNombre, setNNombre] = useState('')
  const [nTelefono, setNTelefono] = useState('')
  const [nMonto, setNMonto] = useState('')

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setLeads([]); setEstados([]); setCargando(false); return
    }
    const [{ data: e }, { data: l }] = await Promise.all([
      supabase.from('lead_estado').select('id, codigo, nombre, orden, es_ganado, es_perdido')
        .eq('activo', true).order('orden'),
      supabase.from('lead').select('id, nombre, telefono, documento, direccion, monto_estimado, persona_id, estado:lead_estado(codigo, nombre)')
        .order('creado_en', { ascending: false }),
    ])
    if (e) setEstados(e as EstadoRow[])
    if (l) setLeads(l as unknown as LeadRow[])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function transicion(lead: LeadRow, estadoCod: string) {
    if (DEMO_MODE) return
    setOcupado(true)
    let motivo: string | undefined
    const destino = estados.find((e) => e.codigo === estadoCod)
    if (destino?.es_perdido) {
      // CRM-2: exige motivo — en RN pedimos con Alert.prompt (iOS) o bloqueamos
      motivo = undefined
    }
    const { error } = await supabase.rpc('lead_transicion', {
      p_lead_id: lead.id,
      p_estado_cod: estadoCod,
      p_motivo: motivo ?? null,
    })
    setOcupado(false)
    if (error) {
      Alert.alert('No permitido', error.message)
    } else {
      setSeleccionado(null)
      await cargar()
    }
  }

  async function convertir(lead: LeadRow) {
    if (DEMO_MODE) return
    setOcupado(true)
    const { error } = await supabase.rpc('lead_convertir', { p_lead_id: lead.id })
    setOcupado(false)
    if (error) Alert.alert('Error', error.message)
    else { setSeleccionado(null); await cargar() }
  }

  async function guardarLead() {
    if (!nNombre.trim() || !nTelefono.trim()) {
      Alert.alert('Requerido', 'Nombre y teléfono son requeridos')
      return
    }
    if (DEMO_MODE) { setMostrarNuevo(false); return }
    setOcupado(true)
    const estadoInicial = estados.find((e) => e.codigo === 'nuevo') ?? estados[0]
    const { error } = await supabase.from('lead').insert({
      tenant_id: perfil.tenantId,
      nombre: nNombre.trim(),
      telefono: nTelefono.trim(),
      estado_id: estadoInicial?.id,
      monto_estimado: nMonto ? Number(nMonto) : null,
      asesor_id: perfil.id,
    })
    setOcupado(false)
    if (error) {
      Alert.alert('No se pudo guardar', error.message) // dedupe por teléfono (índice único)
    } else {
      setNNombre(''); setNTelefono(''); setNMonto(''); setMostrarNuevo(false)
      await cargar()
    }
  }

  function llamar(tel: string) { Linking.openURL(`tel:${tel.replace(/\s/g, '')}`).catch(() => {}) }
  function whatsapp(tel: string) {
    Linking.openURL(`https://wa.me/${tel.replace(/[^0-9]/g, '')}`).catch(() => {})
  }

  const fmt = (n?: number | null) => (n == null ? '' : 'Q ' + n.toLocaleString('es-GT'))

  return (
    <View style={styles.contenedor}>
      {cargando ? (
        <View style={styles.centro}><ActivityIndicator size="large" color="#1D4ED8" /></View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const cod = item.estado?.codigo ?? 'nuevo'
            const estilo = ESTILO[cod] ?? ESTILO.nuevo
            return (
              <TouchableOpacity style={styles.tarjeta} onPress={() => setSeleccionado(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombre}>{item.nombre}</Text>
                  <Text style={styles.detalle}>{item.telefono}</Text>
                  {item.monto_estimado != null && (
                    <Text style={styles.monto}>{fmt(item.monto_estimado)}</Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: estilo.bg }]}>
                  <Text style={[styles.badgeTexto, { color: estilo.fg }]}>
                    {item.estado?.nombre ?? cod}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <Text style={styles.vacio}>
              {DEMO_MODE ? 'Modo demo: sin backend conectado.' : 'Sin leads asignados.'}
            </Text>
          }
        />
      )}

      {/* FAB nuevo */}
      <TouchableOpacity style={styles.fab} onPress={() => setMostrarNuevo(true)}>
        <Text style={styles.fabTexto}>+</Text>
      </TouchableOpacity>

      {/* Detalle (M-12) */}
      <Modal visible={!!seleccionado} transparent animationType="slide" onRequestClose={() => setSeleccionado(null)}>
        <View style={styles.modalFondo}>
          <View style={styles.modal}>
            {seleccionado && (
              <ScrollView>
                <Text style={styles.modalTitulo}>{seleccionado.nombre}</Text>
                <Text style={styles.modalDetalle}>
                  {seleccionado.telefono}
                  {seleccionado.documento ? ` · ${seleccionado.documento}` : ''}
                </Text>
                {seleccionado.direccion && <Text style={styles.modalDetalle}>{seleccionado.direccion}</Text>}
                {seleccionado.persona_id != null && (
                  <Text style={styles.convertido}>Convertido a cliente (persona #{seleccionado.persona_id})</Text>
                )}

                <View style={styles.filaAcciones}>
                  <TouchableOpacity style={styles.accion} onPress={() => llamar(seleccionado.telefono)}>
                    <Text style={styles.accionTexto}>Llamar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.accion, { backgroundColor: '#047857' }]} onPress={() => whatsapp(seleccionado.telefono)}>
                    <Text style={styles.accionTexto}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.botonConvertir, { backgroundColor: colorPrimario(perfil.branding) }]}
                  onPress={() => {
                    setAgendarLead(seleccionado)
                    setSeleccionado(null)
                  }}
                >
                  <Text style={styles.botonConvertirTexto}>Agendar visita</Text>
                </TouchableOpacity>

                <Text style={styles.seccion}>Mover a</Text>
                <View style={styles.filaWrap}>
                  {estados
                    .filter((e) => e.codigo !== (seleccionado.estado?.codigo ?? ''))
                    .map((e) => (
                      <TouchableOpacity
                        key={e.codigo}
                        style={[styles.chip, ocupado && { opacity: 0.5 }]}
                        disabled={ocupado}
                        onPress={() => transicion(seleccionado, e.codigo)}
                      >
                        <Text style={styles.chipTexto}>{e.nombre}</Text>
                      </TouchableOpacity>
                    ))}
                </View>

                {seleccionado.persona_id == null && (
                  <TouchableOpacity
                    style={styles.botonConvertir}
                    disabled={ocupado}
                    onPress={() => convertir(seleccionado)}
                  >
                    <Text style={styles.botonConvertirTexto}>Convertir a cliente</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cerrar} onPress={() => setSeleccionado(null)}>
                  <Text style={styles.cerrarTexto}>Cerrar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Nuevo lead */}
      <Modal visible={mostrarNuevo} transparent animationType="slide" onRequestClose={() => setMostrarNuevo(false)}>
        <View style={styles.modalFondo}>
          <View style={styles.modal}>
            <Text style={styles.modalTitulo}>Nuevo lead</Text>
            <TextInput style={styles.input} placeholder="Nombre *" placeholderTextColor="#9CA3AF" value={nNombre} onChangeText={setNNombre} />
            <TextInput style={styles.input} placeholder="Teléfono *" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" value={nTelefono} onChangeText={setNTelefono} />
            <TextInput style={styles.input} placeholder="Monto estimado (Q)" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={nMonto} onChangeText={setNMonto} />
            <TouchableOpacity style={styles.botonConvertir} disabled={ocupado} onPress={guardarLead}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonConvertirTexto}>Guardar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cerrar} onPress={() => setMostrarNuevo(false)}>
              <Text style={styles.cerrarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <NuevaVisitaModal
        visible={!!agendarLead}
        colorPrimario={colorPrimario(perfil.branding)}
        personaNombre={agendarLead?.nombre}
        direccion={agendarLead?.direccion ?? undefined}
        onCerrar={() => setAgendarLead(null)}
        onGuardada={() => setAgendarLead(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F3F4F6' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tarjeta: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  nombre: { fontSize: 15, fontWeight: '600', color: '#111827' },
  detalle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  monto: { fontSize: 12, color: '#111827', fontWeight: '600', marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeTexto: { fontSize: 11, fontWeight: '600' },
  vacio: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  fab: {
    position: 'absolute', right: 18, bottom: 24, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  fabTexto: { color: '#fff', fontSize: 26, marginTop: -2 },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalDetalle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  convertido: { marginTop: 8, fontSize: 12, color: '#047857', backgroundColor: '#D1FAE5', padding: 8, borderRadius: 8 },
  filaAcciones: { flexDirection: 'row', gap: 10, marginTop: 14 },
  accion: { flex: 1, backgroundColor: '#1D4ED8', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  accionTexto: { color: '#fff', fontWeight: '600' },
  seccion: { marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' },
  filaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipTexto: { fontSize: 13, color: '#374151' },
  botonConvertir: { marginTop: 16, backgroundColor: '#047857', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  botonConvertirTexto: { color: '#fff', fontWeight: '700' },
  cerrar: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  cerrarTexto: { color: '#6B7280', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', marginBottom: 8, marginTop: 4 },
})
