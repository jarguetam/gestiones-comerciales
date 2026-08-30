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
import { supabase, type Perfil } from '../lib/supabase'
import { encolarYSync } from '../lib/colaStore'
import { ejecutarMutacion } from '../lib/sync'
import { Boton, Card } from '../components/ui'
import { useTheme } from '../theme'

interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  esquema: { campos: CampoEsquema[] }
  calculo: string | null
}

interface Props {
  perfil: Perfil
}

export default function FormulariosScreen({ perfil }: Props) {
  const t = useTheme()
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [plantillaId, setPlantillaId] = useState('')
  const [valores, setValores] = useState<Record<string, unknown>>({})
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
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
      await encolarYSync(
        {
          tipo: 'formulario_enviar',
          payload: {
            plantillaId: Number.isFinite(Number(plantilla.id)) ? Number(plantilla.id) : plantilla.id,
            respuestas: valores,
            visitaId: null,
          },
          clienteKey: `formulario:${plantilla.id}:${Date.now()}`,
        },
        ejecutarMutacion(supabase),
      )
      Alert.alert('Encolado', `Score ${score ?? '—'}%. Revisá la cola de sincronización.`)
      setValores({})
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.box}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {plantillas.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, p.id === plantilla?.id && { backgroundColor: t.primary, borderColor: t.primary }]}
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
        <Card>
          <View style={styles.cabecera}>
            <Text style={styles.titulo}>{plantilla.nombre}</Text>
            {score !== null && <Text style={[styles.score, { color: t.primary }]}>Score {score}%</Text>}
          </View>
          <Text style={styles.meta}>{plantilla.descripcion}</Text>
          {campos.map((campo) => (
            <CampoForm key={campo.clave} campo={campo} valor={valores[campo.clave]} onChange={setCampo} primario={t.primary} />
          ))}
          <Boton etiqueta={enviando ? 'Enviando…' : 'Enviar formulario'} onPress={() => void enviar()} disabled={enviando} cargando={enviando} />
        </Card>
      )}
    </ScrollView>
  )
}

function CampoForm({
  campo,
  valor,
  onChange,
  primario,
}: {
  campo: CampoEsquema
  valor: unknown
  onChange: (clave: string, valor: unknown) => void
  primario: string
}) {
  const etiqueta = `${campo.etiqueta}${campo.requerido ? ' *' : ''}`
  if (campo.tipo === 'booleano') {
    const checked = valor === true
    return (
      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => onChange(campo.clave, !checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={etiqueta}
      >
        <View style={[styles.checkBox, { borderColor: primario, backgroundColor: checked ? primario : 'transparent' }]} />
        <Text style={styles.label}>{etiqueta}</Text>
      </TouchableOpacity>
    )
  }
  if (campo.tipo === 'seleccion') {
    return (
      <View style={styles.campo}>
        <Text style={styles.label}>{etiqueta}</Text>
        {(campo.opciones ?? []).map((op) => (
          <TouchableOpacity
            key={op}
            style={styles.opcion}
            onPress={() => onChange(campo.clave, op)}
            accessibilityRole="radio"
            accessibilityState={{ selected: valor === op }}
            accessibilityLabel={op}
          >
            <Text style={valor === op ? [styles.opcionActiva, { color: primario }] : styles.opcionTexto}>{op}</Text>
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
  chipActivo: {},
  chipTexto: { fontSize: 12, fontWeight: '600', color: '#374151' },
  chipTextoActivo: { color: '#fff' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 18, fontWeight: '700', flex: 1 },
  score: { fontSize: 13, fontWeight: '700' },
  meta: { color: '#6B7280', fontSize: 12, marginTop: 4, marginBottom: 12 },
  campo: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#111827' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, backgroundColor: '#F9FAFB' },
  opcion: { paddingVertical: 6 },
  opcionTexto: { color: '#4B5563' },
  opcionActiva: { fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  checkBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2 },
})
