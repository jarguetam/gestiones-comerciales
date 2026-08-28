import { useState } from 'react'
import { mensajeError, type ModuloCatalogo } from './catalogos'

interface Props {
  modulos: ModuloCatalogo[]
  onChange: (v: ModuloCatalogo[]) => void
  onGuardar: (codigo: string, nombre: string, nucleo: boolean) => Promise<number>
  onError: (v: string | null) => void
  onAviso: (v: string | null) => void
}

export function ModulosPanel({ modulos, onChange, onGuardar, onError, onAviso }: Props) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [nucleo, setNucleo] = useState(false)

  async function alta() {
    const c = codigo.trim().toLowerCase()
    const n = nombre.trim()
    if (!c || !n) return
    onError(null)
    try {
      const id = await onGuardar(c, n, nucleo)
      const resto = modulos.filter((m) => m.codigo !== c)
      onChange([...resto, { id, codigo: c, nombre: n, nucleo: c === 'core' ? true : nucleo }].sort((a, b) => Number(b.nucleo) - Number(a.nucleo) || a.codigo.localeCompare(b.codigo)))
      setCodigo('')
      setNombre('')
      setNucleo(false)
      onAviso('Módulo guardado')
    } catch (e) {
      onError(mensajeError(e, 'No se pudo guardar el módulo'))
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); void alta() }}
        className="rounded-lg bg-white p-4 shadow grid gap-3 md:grid-cols-4"
      >
        <h3 className="md:col-span-4 font-medium">Nuevo módulo optativo</h3>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="código (crm)"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre visible"
          className="md:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={nucleo} onChange={(e) => setNucleo(e.target.checked)} />
          Núcleo
        </label>
        <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
          Guardar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {modulos.map((m) => (
              <tr key={m.codigo}>
                <td className="px-4 py-3 font-mono text-xs">{m.codigo}</td>
                <td className="px-4 py-3">{m.nombre}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {m.nucleo ? 'núcleo' : 'optativo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
