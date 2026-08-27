/**
 * M-03 Persona (spec F1.11).
 * Cartera del asesor con búsqueda y alta de nuevos registros (texto libre
 * + documento único por tenant; el teléfono va en detalles, §8).
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { DEMO_MODE, supabase } from '../lib/supabase'
import type { Persona } from '../lib/tipos'

const CATEGORIAS = [
  'agricultor',
  'comerciante',
  'consumidor',
  'cooperativa',
  'distribuidor',
  'farmacia',
] as const

export default function PersonaScreen() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // alta inline
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) {
      setPersonas([])
      setCargando(false)
      return
    }
    const { data, error } = await supabase
      .from('persona')
      .select('id, nombre, documento, documento_tipo, direccion, categoria')
      .eq('activo', true)
      .order('nombre')
      .limit(200)
    if (!error && data) setPersonas(data as Persona[])
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const filtradas = personas.filter((p) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      p.nombre.toLowerCase().includes(q) ||
      (p.documento ?? '').toLowerCase().includes(q) ||
      (p.categoria ?? '').toLowerCase().includes(q)
    )
  })

  async function handleGuardar() {
    setError(null)
    if (!nombre.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (documento.trim()) {
      const duplicado = personas.find(
        (p) => (p.documento ?? '').toLowerCase() === documento.trim().toLowerCase(),
      )
      if (duplicado) {
        setError(`GC-PER-030: ya existe "${duplicado.nombre}" con ese documento`)
        return
      }
    }
    setGuardando(true)
    try {
      const { error } = await supabase.from('persona').insert({
        nombre: nombre.trim(),
        documento: documento.trim() || null,
        documento_tipo: 'DPI',
        direccion: direccion.trim() || null,
        categoria,
        detalles: telefono.trim() ? { telefono: telefono.trim() } : {},
      })
      if (error) throw error
      setNombre('')
      setDocumento('')
      setTelefono('')
      setDireccion('')
      setCategoria(null)
      setMostrarAlta(false)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.barraBusqueda}>
        <TextInput
          style={styles.inputBusqueda}
          placeholder="Buscar por nombre, documento o categoría"
          placeholderTextColor="#9CA3AF"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <TouchableOpacity
          style={styles.botonNuevo}
          onPress={() => setMostrarAlta((v) => !v)}
        >
          <Text style={styles.botonNuevoTexto}>{mostrarAlta ? 'Cancelar' : '+ Nuevo'}</Text>
        </TouchableOpacity>
      </View>

      {mostrarAlta && (
        <View style={styles.formulario}>
          <TextInput
            style={styles.input}
            placeholder="Nombre completo *"
            placeholderTextColor="#9CA3AF"
            value={nombre}
            onChangeText={setNombre}
          />
          <TextInput
            style={styles.input}
            placeholder="DPI / NIT"
            placeholderTextColor="#9CA3AF"
            value={documento}
            onChangeText={setDocumento}
          />
          <TextInput
            style={styles.input}
            placeholder="Teléfono"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
          />
          <TextInput
            style={styles.input}
            placeholder="Dirección"
            placeholderTextColor="#9CA3AF"
            value={direccion}
            onChangeText={setDireccion}
          />
          <View style={styles.categorias}>
            {CATEGORIAS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, categoria === c && styles.chipActivo]}
                onPress={() => setCategoria(categoria === c ? null : c)}
              >
                <Text style={[styles.chipTexto, categoria === c && styles.chipTextoActivo]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.botonGuardar, guardando && { opacity: 0.6 }]}
            onPress={handleGuardar}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonGuardarTexto}>Guardar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#1D4ED8" />
        </View>
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <View style={styles.tarjeta}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.detalle}>
                {[item.documento, item.categoria].filter(Boolean).join(' · ')}
              </Text>
              {item.direccion && <Text style={styles.direccion}>{item.direccion}</Text>}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.vacio}>
              {DEMO_MODE ? 'Modo demo: sin backend conectado.' : 'No hay registros.'}
            </Text>
          }
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F3F4F6' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barraBusqueda: { flexDirection: 'row', padding: 12, gap: 8 },
  inputBusqueda: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
  },
  botonNuevo: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  botonNuevoTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },
  formulario: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActivo: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipTexto: { fontSize: 12, color: '#4B5563' },
  chipTextoActivo: { color: '#fff' },
  error: { color: '#DC2626', fontSize: 12, marginBottom: 8 },
  botonGuardar: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonGuardarTexto: { color: '#fff', fontWeight: '600' },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  nombre: { fontSize: 15, fontWeight: '600', color: '#111827' },
  detalle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  direccion: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  vacio: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
})
