/**
 * M-05 Formulario dinámico (spec frontend).
 * Renderer del esquema de formulario_plantilla; score en vivo si calculo = porcentaje_completado.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  camposDe,
  scorePorcentajeCompletado,
  validarRespuestas,
  type CampoEsquema,
} from '../lib/formulario'
import { DEMO_MODE, supabase, type Perfil } from '../lib/supabase'

interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  esquema: { campos: CampoEsquema[] }
  calculo: string | null
}

const DEMO: Plantilla[] = [
  {
    id: 'ficha-cultivo',
    nombre: 'Ficha de cultivo',
    descripcion: 'Levantamiento en campo del estado del cultivo financiado',
    calculo: 'porcentaje_completado',
    esquema: {
      campos: [
        { clave: 'cultivo', etiqueta: 'Cultivo', tipo: 'texto', requerido: true },
        { clave: 'hectareas', etiqueta: 'Hectáreas sembradas', tipo: 'numero', requerido: true, min: 0.1, max: 10000 },
        {
          clave: 'estado_fenologico',
          etiqueta: 'Estado fenológico',
          tipo: 'seleccion',
          requerido: true,
          opciones: ['Germinación', 'Crecimiento', 'Floración', 'Llenado de grano', 'Madurez', 'Cosecha'],
        },
        { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', requerido: false },
      ],
    },
  },
  {
    id: 'verificacion-garantias',
    nombre: 'Verificación de garantías',
    descripcion: 'Inspección prendaria de activos del crédito',
    calculo: 'porcentaje_completado',
    esquema: {
      campos: [
        {
          clave: 'tipo_garantia',
          etiqueta: 'Tipo de garantía',
          tipo: 'seleccion',
          requerido: true,
          opciones: ['Maquinaria agrícola', 'Vehículo', 'Inventario', 'Inmueble', 'Prenda ganadera'],
        },
        {
          clave: 'estado_conservacion',
          etiqueta: 'Estado de conservación',
          tipo: 'seleccion',
          requerido: true,
          opciones: ['Excelente', 'Bueno', 'Regular', 'Deteriorado'],
        },
        { clave: 'valor_estimado', etiqueta: 'Valor estimado (Q)', tipo: 'numero', requerido: true, min: 0, max: 10000000 },
        { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', requerido: false },
      ],
    },
  },
]

interface Props {
  perfil: Perfil
}

export default function FormulariosScreen({ perfil }: Props) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>(DEMO)
  const [plantillaId, setPlantillaId] = useState(DEMO[0].id)
  const [valores, setValores] = useState<Record<string, unknown>>({})
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    if (DEMO_MODE) return
    const { data, error } = await supabase
      .from('formulario_plantilla')
      .select('id, nombre, descripcion, esquema, calculo')
      .eq('activo', true)
      .order('nombre')
    if (error || !data?.length) return
    const plantas: Plantilla[] = data.map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre),
      descripcion: String(p.descripcion ?? ''),
      esquema: { campos: camposDe(p.esquema) },
      calculo: (p.calculo as string | null) ?? null,
    }))
    setPlantillas(plantas)
    setPlantillaId(plantas[0].id)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar, perfil.id])

  const plantilla = useMemo(
    () => plantillas.find((p) => p.id === plantillaId) ?? plantillas[0],
    [plantillaId, plantillas],
  )
  const campos = useMemo(() => camposDe(plantilla?.esquema), [plantilla])
  const score =
    plantilla?.calculo === 'porcentaje_completado'
      ? scorePorcentajeCompletado(plantilla.esquema, valores)
      : null

  function setCampo(clave: string, valor: unknown) {
    setValores((prev) => {
      const next = { ...prev }
      if (valor === undefined || valor === '') delete next[clave]
      else next[clave] = valor
      return next
    })
  }

  async function enviar() {
    if (!plantilla) return
    const validacion = validarRespuestas(plantilla.esquema, valores)
    if (!validacion.ok) {
      Alert.alert('Formulario incompleto', validacion.mensaje)
      return
    }
    setEnviando(true)
    try {
      if (DEMO_MODE) {
        Alert.alert('Envío demo', `Guardado localmente. Score ${score ?? '—'}%.`)
        setValores({})
        return
      }
      const { error } = await supabase.rpc('formulario_enviar', {
        p_plantilla_id: Number(plantilla.id),
        p_respuestas: valores,
        p_visita_id: null,
        p_cliente_key: undefined,
      })
      if (error) {
        Alert.alert('No se pudo enviar', error.message)
        return
      }
      Alert.alert('Enviado', `Score ${score ?? '—'}%.`)
      setValores({})
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.box}>
      <Text style={styles.hint}>M-05 · plantillas del tenant, no formularios compilados</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {plantillas.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, p.id === plantilla?.id && styles.chipActivo]}
            onPress={() => {
              setPlantillaId(p.id)
              setValores({})
            }}
          >
            <Text style={[styles.chipTexto, p.id === plantilla?.id && styles.chipTextoActivo]}>{p.nombre}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {plantilla && (
        <View style={styles.card}>
          <View style={styles.cabecera}>
            <Text style={styles.titulo}>{plantilla.nombre}</Text>
            {score !== null && <Text style={styles.score}>Score {score}%</Text>}
          </View>
          <Text style={styles.meta}>{plantilla.descripcion}</Text>
          {campos.map((campo) => (
            <Campo key={campo.clave} campo={campo} valor={valores[campo.clave]} onChange={setCampo} />
          ))}
          <TouchableOpacity style={styles.boton} disabled={enviando} onPress={() => void enviar()}>
            <Text style={styles.botonTexto}>{enviando ? 'Enviando…' : 'Enviar formulario'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

function Campo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoEsquema
  valor: unknown
  onChange: (clave: string, valor: unknown) => void
}) {
  const etiqueta = `${campo.etiqueta}${campo.requerido ? ' *' : ''}`
  if (campo.tipo === 'booleano') {
    const checked = valor === true
    return (
      <TouchableOpacity style={styles.checkRow} onPress={() => onChange(campo.clave, !checked)}>
        <Text style={styles.checkBox}>{checked ? '☑' : '☐'}</Text>
        <Text style={styles.label}>{etiqueta}</Text>
      </TouchableOpacity>
    )
  }
  if (campo.tipo === 'seleccion') {
    return (
      <View style={styles.campo}>
        <Text style={styles.label}>{etiqueta}</Text>
        {(campo.opciones ?? []).map((op) => (
          <TouchableOpacity key={op} style={styles.opcion} onPress={() => onChange(campo.clave, op)}>
            <Text style={valor === op ? styles.opcionActiva : styles.opcionTexto}>{op}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }
  return (
    <View style={styles.campo}>
      <Text style={styles.label}>{etiqueta}</Text>
      <TextInput
        style={styles.input}
        keyboardType={campo.tipo === 'numero' ? 'numeric' : campo.tipo === 'fecha' ? 'default' : 'default'}
        placeholder={campo.tipo === 'fecha' ? 'AAAA-MM-DD' : campo.etiqueta}
        value={valor == null ? '' : String(valor)}
        onChangeText={(t) => {
          if (t === '') onChange(campo.clave, undefined)
          else if (campo.tipo === 'numero') onChange(campo.clave, Number(t))
          else onChange(campo.clave, t)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { padding: 12, paddingBottom: 32 },
  hint: { fontSize: 11, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  chips: { marginBottom: 12 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActivo: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  chipTexto: { fontSize: 12, fontWeight: '600', color: '#374151' },
  chipTextoActivo: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 18, fontWeight: '700', flex: 1 },
  score: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  meta: { color: '#6B7280', fontSize: 12, marginTop: 4, marginBottom: 12 },
  campo: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#111827' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, backgroundColor: '#F9FAFB' },
  opcion: { paddingVertical: 6 },
  opcionTexto: { color: '#4B5563' },
  opcionActiva: { color: '#1D4ED8', fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkBox: { fontSize: 18, width: 24 },
  boton: { backgroundColor: '#1D4ED8', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  botonTexto: { color: '#fff', fontWeight: '700' },
})
