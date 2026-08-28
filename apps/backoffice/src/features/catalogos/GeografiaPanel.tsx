import { useState } from 'react'
import {
  parseCsvGeografia,
  type Departamento,
  type Municipio,
} from './catalogos'

interface Props {
  departamentos: Departamento[]
  municipios: Municipio[]
  onDepartamentos: (v: Departamento[]) => void
  onMunicipios: (v: Municipio[]) => void
  onGuardarDepto: (id: number | null, nombre: string) => Promise<number>
  onGuardarMuni: (id: number | null, departamentoId: number, nombre: string) => Promise<number>
  onImportar: (filas: { departamento: string; municipio: string }[]) => Promise<void>
  onError: (v: string | null) => void
  onAviso: (v: string | null) => void
}

export function GeografiaPanel({
  departamentos,
  municipios,
  onDepartamentos,
  onMunicipios,
  onGuardarDepto,
  onGuardarMuni,
  onImportar,
  onError,
  onAviso,
}: Props) {
  const [deptoId, setDeptoId] = useState<number | null>(departamentos[0]?.id ?? null)
  const [nuevoDepto, setNuevoDepto] = useState('')
  const [nuevoMuni, setNuevoMuni] = useState('')
  const [csv, setCsv] = useState('departamento,municipio\n')
  const [importando, setImportando] = useState(false)

  const munis = municipios.filter((m) => m.departamento_id === deptoId)
  const deptoSel = departamentos.find((d) => d.id === deptoId)

  async function altaDepto() {
    const nombre = nuevoDepto.trim()
    if (!nombre) return
    onError(null)
    try {
      const id = await onGuardarDepto(null, nombre)
      onDepartamentos([...departamentos, { id, nombre }])
      setDeptoId(id)
      setNuevoDepto('')
      onAviso('Departamento creado')
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo crear el departamento')
    }
  }

  async function altaMuni() {
    const nombre = nuevoMuni.trim()
    if (!nombre || deptoId == null) return
    onError(null)
    try {
      const id = await onGuardarMuni(null, deptoId, nombre)
      onMunicipios([...municipios, { id, departamento_id: deptoId, nombre }])
      setNuevoMuni('')
      onAviso('Municipio creado')
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo crear el municipio')
    }
  }

  async function importar() {
    onError(null)
    try {
      const filas = parseCsvGeografia(csv)
      setImportando(true)
      await onImportar(filas)
      onAviso(`Importadas ${filas.length} filas`)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo importar el CSV')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg bg-white p-4 shadow space-y-3">
        <h3 className="font-medium">Departamentos</h3>
        <div className="flex gap-2">
          <input
            value={nuevoDepto}
            onChange={(e) => setNuevoDepto(e.target.value)}
            placeholder="Nuevo departamento"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => void altaDepto()} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white">
            Agregar
          </button>
        </div>
        <ul className="max-h-80 overflow-auto divide-y divide-slate-100 border border-slate-100 rounded-md">
          {departamentos.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setDeptoId(d.id)}
                className={`w-full text-left px-3 py-2 text-sm ${d.id === deptoId ? 'bg-teal-50 font-medium text-teal-900' : 'hover:bg-slate-50'}`}
              >
                {d.nombre}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-white p-4 shadow space-y-3">
        <h3 className="font-medium">Municipios {deptoSel ? `de ${deptoSel.nombre}` : ''}</h3>
        <div className="flex gap-2">
          <input
            value={nuevoMuni}
            onChange={(e) => setNuevoMuni(e.target.value)}
            placeholder="Nuevo municipio"
            disabled={deptoId == null}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
          <button type="button" onClick={() => void altaMuni()} disabled={deptoId == null} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            Agregar
          </button>
        </div>
        <ul className="max-h-80 overflow-auto divide-y divide-slate-100 border border-slate-100 rounded-md">
          {munis.length === 0 ? (
            <li className="px-3 py-4 text-sm text-slate-500">Sin municipios en este departamento.</li>
          ) : (
            munis.map((m) => (
              <li key={m.id} className="px-3 py-2 text-sm">{m.nombre}</li>
            ))
          )}
        </ul>
      </section>

      <section className="lg:col-span-2 rounded-lg bg-white p-4 shadow space-y-3">
        <h3 className="font-medium">Importar CSV</h3>
        <p className="text-xs text-slate-500">Columnas <code>departamento,municipio</code>. Se crean departamentos faltantes.</p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void importar()}
          disabled={importando}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {importando ? 'Importando…' : 'Importar'}
        </button>
      </section>
    </div>
  )
}
