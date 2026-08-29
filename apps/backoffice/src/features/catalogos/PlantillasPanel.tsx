import { useMemo, useState } from 'react'
import {
  RUBROS_PLANTILLA,
  TIPOS_PLANTILLA,
  mensajeError,
  subactividadesDeTexto,
  validarPayloadPlantilla,
  type PlantillaBase,
  type TipoPlantilla,
} from './catalogos'
import {
  Badge,
  Button,
  EmptyStateInline,
  FilterChips,
  Input,
  Select,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
} from '../../components/ui'

const RUBRO_CODIGOS = RUBROS_PLANTILLA.map((r) => r.codigo)
const RUBRO_ETIQUETAS = Object.fromEntries(RUBROS_PLANTILLA.map((r) => [r.codigo, r.nombre])) as Record<
  string,
  string
>

interface Props {
  plantillas: PlantillaBase[]
  onChange: (v: PlantillaBase[]) => void
  onGuardar: (p: {
    id: number | null
    rubro: string
    tipo: TipoPlantilla
    nombre: string
    payload: Record<string, unknown>
    activo: boolean
  }) => Promise<number>
  onError: (v: string | null) => void
  onAviso: (v: string | null) => void
}

export function PlantillasPanel({ plantillas, onChange, onGuardar, onError, onAviso }: Props) {
  const [rubro, setRubro] = useState<string>('agro')
  const [tipo, setTipo] = useState<TipoPlantilla>('actividad')
  const [nombre, setNombre] = useState('')
  const [subs, setSubs] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [descripcion, setDescripcion] = useState('')
  const [esquema, setEsquema] = useState('{"campos":[]}')
  const [editId, setEditId] = useState<number | null>(null)

  const filtradas = useMemo(
    () => plantillas.filter((p) => p.rubro === rubro),
    [plantillas, rubro],
  )

  function payloadActual(): Record<string, unknown> | null {
    if (tipo === 'actividad') return { sub_actividades: subactividadesDeTexto(subs) }
    if (tipo === 'hora') return { cantidad: Number(cantidad) }
    try {
      const parsed = JSON.parse(esquema) as { campos?: unknown }
      return { descripcion: descripcion.trim() || undefined, esquema: parsed, calculo: 'porcentaje_completado' }
    } catch {
      onError('GC-CAT-001: esquema JSON inválido')
      return null
    }
  }

  function cargar(p: PlantillaBase) {
    setEditId(p.id)
    setTipo(p.tipo)
    setNombre(p.nombre)
    setSubs(((p.payload.sub_actividades as string[]) ?? []).join('\n'))
    setCantidad(String(p.payload.cantidad ?? 1))
    setDescripcion(String(p.payload.descripcion ?? ''))
    setEsquema(JSON.stringify(p.payload.esquema ?? { campos: [] }, null, 2))
  }

  async function guardar() {
    const n = nombre.trim()
    if (!n) return
    const payload = payloadActual()
    if (!payload) return
    const err = validarPayloadPlantilla(tipo, payload)
    if (err) {
      onError(err)
      return
    }
    onError(null)
    try {
      const id = await onGuardar({ id: editId, rubro, tipo, nombre: n, payload, activo: true })
      const row: PlantillaBase = { id, rubro, tipo, nombre: n, payload, activo: true }
      onChange(editId ? plantillas.map((p) => (p.id === editId ? row : p)) : [...plantillas, row])
      setNombre('')
      setSubs('')
      setEditId(null)
      onAviso(editId ? 'Plantilla actualizada' : 'Plantilla creada')
    } catch (e) {
      onError(mensajeError(e, 'No se pudo guardar la plantilla'))
    }
  }

  async function toggleActivo(p: PlantillaBase) {
    onError(null)
    try {
      await onGuardar({
        id: p.id,
        rubro: p.rubro,
        tipo: p.tipo,
        nombre: p.nombre,
        payload: p.payload,
        activo: !p.activo,
      })
      onChange(plantillas.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)))
    } catch (e) {
      onError(mensajeError(e, 'No se pudo cambiar el estado'))
    }
  }

  return (
    <div className="space-y-4">
      <FilterChips
        opciones={RUBRO_CODIGOS}
        valor={rubro}
        onChange={(v) => {
          setRubro(v)
          setEditId(null)
        }}
        etiquetas={RUBRO_ETIQUETAS}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
        className="rounded-2xl border border-line bg-surface p-4 grid gap-3 md:grid-cols-2"
      >
        <h3 className="md:col-span-2 font-medium">{editId ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
        <Select id="plantilla-tipo" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPlantilla)}>
          {TIPOS_PLANTILLA.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.nombre}
            </option>
          ))}
        </Select>
        <Input id="plantilla-nombre" label="Nombre" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        {tipo === 'actividad' && (
          <div className="md:col-span-2">
            <Textarea
              id="plantilla-subs"
              label="Subactividades"
              value={subs}
              onChange={(e) => setSubs(e.target.value)}
              placeholder="Subactividades (una por línea)"
              rows={4}
            />
          </div>
        )}
        {tipo === 'hora' && (
          <Input
            id="plantilla-cantidad"
            label="Cantidad (horas)"
            type="number"
            min="0.5"
            step="0.5"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        )}
        {tipo === 'formulario' && (
          <>
            <div className="md:col-span-2">
              <Input
                id="plantilla-descripcion"
                label="Descripción"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                id="plantilla-esquema"
                label="Esquema JSON"
                value={esquema}
                onChange={(e) => setEsquema(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </>
        )}
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit">{editId ? 'Actualizar' : 'Crear'}</Button>
          {editId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditId(null)
                setNombre('')
                setSubs('')
              }}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>

      <Table>
        <THead>
          <tr>
            <Th>Tipo</Th>
            <Th>Nombre</Th>
            <Th>Estado</Th>
          </tr>
        </THead>
        <TBody>
          {filtradas.length === 0 ? (
            <Tr>
              <Td colSpan={3}>
                <EmptyStateInline>Sin plantillas para este rubro.</EmptyStateInline>
              </Td>
            </Tr>
          ) : (
            filtradas.map((p) => (
              <Tr key={p.id}>
                <Td className="capitalize">{p.tipo}</Td>
                <Td>
                  <button type="button" onClick={() => cargar(p)} className="text-primary hover:underline">
                    {p.nombre}
                  </button>
                </Td>
                <Td>
                  <button type="button" onClick={() => void toggleActivo(p)}>
                    <Badge tone={p.activo ? 'success' : 'neutral'}>{p.activo ? 'activa' : 'inactiva'}</Badge>
                  </button>
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>
    </div>
  )
}
