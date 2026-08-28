import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import {
  DEMO_DEPARTAMENTOS,
  DEMO_MUNICIPIOS,
  DEMO_MODULOS,
  DEMO_PLANTILLAS,
  type Departamento,
  type Municipio,
  type ModuloCatalogo,
  type PlantillaBase,
  type TipoPlantilla,
} from './catalogos'
import { GeografiaPanel } from './GeografiaPanel'
import { ModulosPanel } from './ModulosPanel'
import { PlantillasPanel } from './PlantillasPanel'

type Tab = 'geografia' | 'modulos' | 'plantillas'

export function CatalogosPage() {
  const live = !DEMO_MODE
  const [tab, setTab] = useState<Tab>('geografia')
  const [departamentos, setDepartamentos] = useState<Departamento[]>(DEMO_DEPARTAMENTOS)
  const [municipios, setMunicipios] = useState<Municipio[]>(DEMO_MUNICIPIOS)
  const [modulos, setModulos] = useState<ModuloCatalogo[]>(DEMO_MODULOS)
  const [plantillas, setPlantillas] = useState<PlantillaBase[]>(DEMO_PLANTILLAS)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const nextId = useCallback(() => Date.now() + Math.floor(Math.random() * 1000), [])

  const cargar = useCallback(async () => {
    if (!live) return
    setError(null)
    const [dRes, mRes, modRes, pRes] = await Promise.all([
      supabase.from('departamento').select('id, nombre').order('nombre'),
      supabase.from('municipio').select('id, departamento_id, nombre').order('nombre'),
      supabase.from('modulo').select('id, codigo, nombre, nucleo').order('nucleo', { ascending: false }),
      supabase.from('catalogo_plantilla').select('id, rubro, tipo, nombre, payload, activo').order('id'),
    ])
    const err = dRes.error || mRes.error || modRes.error || pRes.error
    if (err) {
      setError(err.message)
      return
    }
    setDepartamentos((dRes.data ?? []) as Departamento[])
    setMunicipios((mRes.data ?? []) as Municipio[])
    setModulos((modRes.data ?? []) as ModuloCatalogo[])
    setPlantillas((pRes.data ?? []) as PlantillaBase[])
  }, [live])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function guardarDepto(id: number | null, nombre: string): Promise<number> {
    if (!live) return nextId()
    const { data, error } = await supabase.rpc('admin_departamento_guardar', {
      p_id: id,
      p_nombre: nombre,
    })
    if (error) throw error
    return data as number
  }

  async function guardarMuni(id: number | null, departamentoId: number, nombre: string): Promise<number> {
    if (!live) return nextId()
    const { data, error } = await supabase.rpc('admin_municipio_guardar', {
      p_id: id,
      p_departamento_id: departamentoId,
      p_nombre: nombre,
    })
    if (error) throw error
    return data as number
  }

  async function importar(filas: { departamento: string; municipio: string }[]) {
    if (!live) {
      const depts = [...departamentos]
      const munis = [...municipios]
      for (const f of filas) {
        let d = depts.find((x) => x.nombre === f.departamento)
        if (!d) {
          d = { id: nextId(), nombre: f.departamento }
          depts.push(d)
        }
        if (!munis.some((m) => m.departamento_id === d.id && m.nombre === f.municipio)) {
          munis.push({ id: nextId(), departamento_id: d.id, nombre: f.municipio })
        }
      }
      setDepartamentos(depts)
      setMunicipios(munis)
      return
    }
    const { error } = await supabase.rpc('admin_geografia_importar', { p_filas: filas })
    if (error) throw error
    await cargar()
  }

  async function guardarModulo(codigo: string, nombre: string, nucleo: boolean): Promise<number> {
    if (!live) return nextId()
    const { data, error } = await supabase.rpc('admin_modulo_catalogo_guardar', {
      p_codigo: codigo,
      p_nombre: nombre,
      p_nucleo: nucleo,
    })
    if (error) throw error
    return data as number
  }

  async function guardarPlantilla(p: {
    id: number | null
    rubro: string
    tipo: TipoPlantilla
    nombre: string
    payload: Record<string, unknown>
    activo: boolean
  }): Promise<number> {
    if (!live) return p.id ?? nextId()
    const { data, error } = await supabase.rpc('admin_plantilla_guardar', {
      p_id: p.id,
      p_rubro: p.rubro,
      p_tipo: p.tipo,
      p_nombre: p.nombre,
      p_payload: p.payload,
      p_activo: p.activo,
    })
    if (error) throw error
    return data as number
  }

  return (
    <main className="mx-auto max-w-6xl p-4 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-teal-800">P-05</p>
        <h2 className="text-2xl font-bold text-slate-900">Catálogos globales</h2>
        <p className="text-sm text-slate-500">
          Departamentos y municipios compartidos, catálogo de módulos y plantillas base por rubro.
        </p>
      </div>

      {!live && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Preview estático — los cambios no se persisten.
        </p>
      )}
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}

      <div className="flex flex-wrap gap-2">
        {([
          ['geografia', 'Geografía'],
          ['modulos', 'Módulos'],
          ['plantillas', 'Plantillas'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tab === id ? 'bg-teal-700 text-white' : 'bg-white border border-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'geografia' && (
        <GeografiaPanel
          departamentos={departamentos}
          municipios={municipios}
          onDepartamentos={setDepartamentos}
          onMunicipios={setMunicipios}
          onGuardarDepto={guardarDepto}
          onGuardarMuni={guardarMuni}
          onImportar={importar}
          onError={setError}
          onAviso={setAviso}
        />
      )}
      {tab === 'modulos' && (
        <ModulosPanel
          modulos={modulos}
          onChange={setModulos}
          onGuardar={guardarModulo}
          onError={setError}
          onAviso={setAviso}
        />
      )}
      {tab === 'plantillas' && (
        <PlantillasPanel
          plantillas={plantillas}
          onChange={setPlantillas}
          onGuardar={guardarPlantilla}
          onError={setError}
          onAviso={setAviso}
        />
      )}
    </main>
  )
}
