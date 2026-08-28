import { useMemo, useState } from 'react'
import {
  RUBROS_PLANTILLA,
  TIPOS_PLANTILLA,
  subactividadesDeTexto,
  validarPayloadPlantilla,
  type PlantillaBase,
  type TipoPlantilla,
} from './catalogos'

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
    if (err) { onError(err); return }
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
      onError(e instanceof Error ? e.message : 'No se pudo guardar la plantilla')
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
      onError(e instanceof Error ? e.message : 'No se pudo cambiar el estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {RUBROS_PLANTILLA.map((r) => (
          <button
            key={r.codigo}
            type="button"
            onClick={() => { setRubro(r.codigo); setEditId(null) }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${rubro === r.codigo ? 'bg-teal-700 text-white' : 'bg-white border border-slate-200'}`}
          >
            {r.nombre}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void guardar() }}
        className="rounded-lg bg-white p-4 shadow grid gap-3 md:grid-cols-2"
      >
        <h3 className="md:col-span-2 font-medium">{editId ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPlantilla)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {TIPOS_PLANTILLA.map((t) => (
            <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
          ))}
        </select>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {tipo === 'actividad' && (
          <textarea
            value={subs}
            onChange={(e) => setSubs(e.target.value)}
            placeholder="Subactividades (una por línea)"
            rows={4}
            className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        )}
        {tipo === 'hora' && (
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        )}
        {tipo === 'formulario' && (
          <>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <textarea
              value={esquema}
              onChange={(e) => setEsquema(e.target.value)}
              rows={6}
              className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />
          </>
        )}
        <div className="md:col-span-2 flex gap-2">
          <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            {editId ? 'Actualizar' : 'Crear'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setNombre(''); setSubs('') }} className="rounded-md border border-slate-300 px-4 py-2 text-sm">
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Sin plantillas para este rubro.</td></tr>
            ) : (
              filtradas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 capitalize">{p.tipo}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => cargar(p)} className="text-teal-800 hover:underline">
                      {p.nombre}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => void toggleActivo(p)} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {p.activo ? 'activa' : 'inactiva'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
