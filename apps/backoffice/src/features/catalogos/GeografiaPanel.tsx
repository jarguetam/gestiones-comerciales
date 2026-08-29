import { useState } from 'react'
import {
  mensajeError,
  parseCsvGeografia,
  type Departamento,
  type Municipio,
} from './catalogos'
import { Button, EmptyStateInline, fieldClass, Textarea } from '../../components/ui'
import { cn } from '../../lib/cn'

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
  const [muniId, setMuniId] = useState<number | null>(null)
  const [nombreDepto, setNombreDepto] = useState(departamentos[0]?.nombre ?? '')
  const [nombreMuni, setNombreMuni] = useState('')

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
      setNombreDepto(nombre)
      setNuevoDepto('')
      onAviso('Departamento creado')
    } catch (e) {
      onError(mensajeError(e, 'No se pudo crear el departamento'))
    }
  }

  async function renombrarDepto() {
    const nombre = nombreDepto.trim()
    if (!nombre || deptoId == null) return
    onError(null)
    try {
      await onGuardarDepto(deptoId, nombre)
      onDepartamentos(departamentos.map((d) => (d.id === deptoId ? { ...d, nombre } : d)))
      onAviso('Departamento actualizado')
    } catch (e) {
      onError(mensajeError(e, 'No se pudo renombrar el departamento'))
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
      onError(mensajeError(e, 'No se pudo crear el municipio'))
    }
  }

  async function renombrarMuni() {
    const nombre = nombreMuni.trim()
    if (!nombre || deptoId == null || muniId == null) return
    onError(null)
    try {
      await onGuardarMuni(muniId, deptoId, nombre)
      onMunicipios(municipios.map((m) => (m.id === muniId ? { ...m, nombre } : m)))
      onAviso('Municipio actualizado')
    } catch (e) {
      onError(mensajeError(e, 'No se pudo renombrar el municipio'))
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
      onError(mensajeError(e, 'No se pudo importar el CSV'))
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <h3 className="font-medium">Departamentos</h3>
        <div className="flex gap-2">
          <input
            id="nuevo-depto"
            aria-label="Nuevo departamento"
            value={nuevoDepto}
            onChange={(e) => setNuevoDepto(e.target.value)}
            placeholder="Nuevo departamento"
            className={`flex-1 ${fieldClass}`}
          />
          <Button type="button" onClick={() => void altaDepto()}>
            Agregar
          </Button>
        </div>
        <ul className="max-h-80 overflow-auto divide-y divide-line border border-line rounded-lg">
          {departamentos.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  setDeptoId(d.id)
                  setNombreDepto(d.nombre)
                  setMuniId(null)
                  setNombreMuni('')
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm',
                  d.id === deptoId ? 'bg-canvas font-medium text-ink' : 'hover:bg-canvas/80',
                )}
              >
                {d.nombre}
              </button>
            </li>
          ))}
        </ul>
        {deptoSel && (
          <div className="flex gap-2">
            <input
              id="renombrar-depto"
              aria-label="Renombrar departamento"
              value={nombreDepto}
              onChange={(e) => setNombreDepto(e.target.value)}
              placeholder="Renombrar departamento"
              className={`flex-1 ${fieldClass}`}
            />
            <Button type="button" variant="secondary" onClick={() => void renombrarDepto()}>
              Renombrar
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3">
        <h3 className="font-medium">Municipios {deptoSel ? `de ${deptoSel.nombre}` : ''}</h3>
        <div className="flex gap-2">
          <input
            id="nuevo-muni"
            aria-label="Nuevo municipio"
            value={nuevoMuni}
            onChange={(e) => setNuevoMuni(e.target.value)}
            placeholder="Nuevo municipio"
            disabled={deptoId == null}
            className={`flex-1 ${fieldClass}`}
          />
          <Button type="button" onClick={() => void altaMuni()} disabled={deptoId == null}>
            Agregar
          </Button>
        </div>
        <ul className="max-h-80 overflow-auto divide-y divide-line border border-line rounded-lg">
          {munis.length === 0 ? (
            <li>
              <EmptyStateInline>Sin municipios en este departamento.</EmptyStateInline>
            </li>
          ) : (
            munis.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setMuniId(m.id)
                    setNombreMuni(m.nombre)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm',
                    m.id === muniId ? 'bg-canvas font-medium text-ink' : 'hover:bg-canvas/80',
                  )}
                >
                  {m.nombre}
                </button>
              </li>
            ))
          )}
        </ul>
        {muniId != null && (
          <div className="flex gap-2">
            <input
              id="renombrar-muni"
              aria-label="Renombrar municipio"
              value={nombreMuni}
              onChange={(e) => setNombreMuni(e.target.value)}
              placeholder="Renombrar municipio"
              className={`flex-1 ${fieldClass}`}
            />
            <Button type="button" variant="secondary" onClick={() => void renombrarMuni()}>
              Renombrar
            </Button>
          </div>
        )}
      </section>

      <section className="lg:col-span-2 rounded-2xl border border-line bg-surface p-4 space-y-3">
        <Textarea
          id="geo-csv"
          label="Importar CSV"
          hint="Columnas departamento,municipio. Se crean departamentos faltantes."
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          className="font-mono text-xs"
        />
        <Button type="button" onClick={() => void importar()} disabled={importando}>
          {importando ? 'Importando…' : 'Importar'}
        </Button>
      </section>
    </div>
  )
}
