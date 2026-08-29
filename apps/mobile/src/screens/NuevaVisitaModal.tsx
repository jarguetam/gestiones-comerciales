/**
 * Alta de visita (M-02 / M-12). Validación GC-VIS-* en cliente; el RPC
 * visita_crear rellena tenant_id para no chocar con RLS del JWT raíz.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { cargarCatalogosCampo, type CatalogoActividad, type CatalogosCampo } from '../lib/catalogosCampo'
import { persistirVisitaCampo } from '../lib/supabase'
import { fechaLocalHoy, type BorradorVisita } from '../lib/visita'

interface Props {
  visible: boolean
  colorPrimario: string
  personaNombre?: string
  personaId?: number
  direccion?: string
  onCerrar: () => void
  onGuardada: () => void
}

export default function NuevaVisitaModal({
  visible,
  colorPrimario,
  personaNombre,
  personaId,
  direccion,
  onCerrar,
  onGuardada,
}: Props) {
  const [cats, setCats] = useState<CatalogosCampo | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(personaNombre ?? '')
  const [dir, setDir] = useState(direccion ?? '')
  const [fecha, setFecha] = useState(fechaLocalHoy())
  const [hora, setHora] = useState('09:00')
  const [actividadId, setActividadId] = useState<number | null>(null)
  const [subId, setSubId] = useState<number | null>(null)
  const [horaId, setHoraId] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')

  useEffect(() => {
    if (!visible) return
    setNombre(personaNombre ?? '')
    setDir(direccion ?? '')
    setFecha(fechaLocalHoy())
    setHora('09:00')
    setActividadId(null)
    setSubId(null)
    setComentario('')
    setError(null)
    setCargando(true)
    void cargarCatalogosCampo()
      .then((c) => {
        setCats(c)
        setHoraId(c.geo.horaDefaultId)
        if (c.aviso) setError(c.aviso)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar catálogos'))
      .finally(() => setCargando(false))
  }, [visible, personaNombre, direccion, personaId])

  const actividad: CatalogoActividad | undefined = useMemo(
    () => cats?.actividades.find((a) => a.id === actividadId),
    [cats, actividadId],
  )

  async function guardar() {
    setError(null)
    const borrador: BorradorVisita = {
      personaNombre: nombre,
      personaId: personaId ?? null,
      actividadId,
      subActividadId: subId,
      actividadHoraId: horaId,
      zonaId: cats?.geo.zonaId,
      departamentoId: cats?.geo.departamentoId,
      municipioId: cats?.geo.municipioId,
      fecha,
      horaInicio: hora,
      direccion: dir,
      comentario,
    }
    setGuardando(true)
    try {
      await persistirVisitaCampo(borrador)
      onGuardada()
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agendar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={styles.fondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { backgroundColor: colorPrimario }]}>
          <Text style={styles.headerTitulo}>Agendar visita</Text>
          <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Text style={styles.cerrar}>Cerrar</Text>
          </Pressable>
        </View>
        {cargando ? (
          <View style={styles.centro}>
            <ActivityIndicator color={colorPrimario} size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>Cliente / visitado *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#94A3B8"
              value={nombre}
              onChangeText={setNombre}
              accessibilityLabel="Nombre del visitado"
            />

            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={styles.input}
              placeholder="Opcional"
              placeholderTextColor="#94A3B8"
              value={dir}
              onChangeText={setDir}
            />

            <Text style={styles.label}>Fecha * (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} value={fecha} onChangeText={setFecha} autoCapitalize="none" />

            <Text style={styles.label}>Hora * (HH:MM)</Text>
            <TextInput style={styles.input} value={hora} onChangeText={setHora} autoCapitalize="none" />

            <Text style={styles.label}>Actividad *</Text>
            <View style={styles.chips}>
              {(cats?.actividades ?? []).map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setActividadId(a.id)
                    setSubId(null)
                  }}
                  style={[styles.chip, actividadId === a.id && { backgroundColor: colorPrimario, borderColor: colorPrimario }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actividadId === a.id }}
                >
                  <Text style={[styles.chipTexto, actividadId === a.id && styles.chipTextoOn]}>{a.nombre}</Text>
                </Pressable>
              ))}
            </View>

            {actividad ? (
              <>
                <Text style={styles.label}>Subactividad *</Text>
                <View style={styles.chips}>
                  {actividad.sub_actividades.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSubId(s.id)}
                      style={[styles.chip, subId === s.id && { backgroundColor: colorPrimario, borderColor: colorPrimario }]}
                    >
                      <Text style={[styles.chipTexto, subId === s.id && styles.chipTextoOn]}>{s.nombre}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.label}>Duración</Text>
            <View style={styles.chips}>
              {(cats?.horas ?? []).map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => setHoraId(h.id)}
                  style={[styles.chip, horaId === h.id && { backgroundColor: colorPrimario, borderColor: colorPrimario }]}
                >
                  <Text style={[styles.chipTexto, horaId === h.id && styles.chipTextoOn]}>{h.nombre}</Text>
                </Pressable>
              ))}
            </View>

            {cats?.zonas[0] ? (
              <Text style={styles.hint}>
                Zona {cats.zonas[0].nombre}
                {cats.geo.zonaId ? ' · se usa la zona y geografía del tenant' : ''}
              </Text>
            ) : null}

            <Text style={styles.label}>Comentario</Text>
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
              placeholder="Motivo o notas"
              placeholderTextColor="#94A3B8"
              value={comentario}
              onChangeText={setComentario}
              multiline
            />

            <Pressable
              style={[styles.boton, { backgroundColor: colorPrimario }, guardando && { opacity: 0.6 }]}
              onPress={() => void guardar()}
              disabled={guardando}
              accessibilityRole="button"
              accessibilityLabel="Guardar visita"
            >
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Guardar visita</Text>}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: Platform.OS === 'android' ? 36 : 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitulo: { color: '#fff', fontSize: 22, fontWeight: '700' },
  cerrar: { color: '#fff', fontWeight: '600', fontSize: 16 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 14 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    minHeight: 48,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipTexto: { fontSize: 14, color: '#334155', fontWeight: '600' },
  chipTextoOn: { color: '#fff' },
  hint: { marginTop: 12, fontSize: 13, color: '#64748B' },
  error: {
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  boton: {
    marginTop: 24,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
})
