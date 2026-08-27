import { useCallback, useEffect, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { contextoOperacion, mensajeGc } from '../../lib/persistir'
import type { CatalogoActividad, CatalogoHora, ZonaCatalogo } from '../../lib/catalogos'
import { CATALOGO_ACTIVIDADES, CATALOGO_HORAS } from '../calendar/eventsData'
import { useDominio } from '../../app/DominioContext'

const ZONAS_DEMO: ZonaCatalogo[] = [
  { id: 1, codigo: 'Z1', nombre: 'Zona Centro', activo: true },
  { id: 2, codigo: 'Z2', nombre: 'Zona Sur', activo: true },
]

type Tab = 'actividades' | 'zonas' | 'horarios'

export function CatalogosPage() {
  const { fuente } = useDominio()
  const live = !DEMO_MODE && fuente === 'supabase'
  const [tab, setTab] = useState<Tab>('actividades')
  const [actividades, setActividades] = useState<CatalogoActividad[]>(CATALOGO_ACTIVIDADES)
  const [zonas, setZonas] = useState<ZonaCatalogo[]>(ZONAS_DEMO)
  const [horas, setHoras] = useState<CatalogoHora[]>(CATALOGO_HORAS)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!live) return
    setError(null)
    const [actRes, subRes, zonaRes, horaRes] = await Promise.all([
      supabase.from('actividad').select('id, nombre, activo').order('nombre'),
      supabase.from('sub_actividad').select('id, actividad_id, nombre, activo').order('nombre'),
      supabase.from('zona').select('id, codigo, nombre, activo').order('nombre'),
      supabase.from('actividad_hora').select('id, nombre, cantidad, activo').order('cantidad'),
    ])
    const err = actRes.error || subRes.error || zonaRes.error || horaRes.error
    if (err) {
      setError(err.message)
      return
    }
    const subs = (subRes.data ?? []) as Array<{ id: number; actividad_id: number; nombre: string; activo: boolean }>
    setActividades(
      ((actRes.data ?? []) as Array<{ id: number; nombre: string; activo: boolean }>).map((a) => ({
        ...a,
        sub_actividades: subs.filter((s) => s.actividad_id === a.id),
      })),
    )
    setZonas((zonaRes.data ?? []) as ZonaCatalogo[])
    setHoras((horaRes.data ?? []) as CatalogoHora[])
  }, [live])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-10</p>
        <h2 className="font-serif text-3xl">Configuración</h2>
        <p className="text-sm text-slate-600">Catálogos de tu empresa: actividades, zonas y duraciones.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['actividades', 'zonas', 'horarios'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              tab === t ? 'bg-brand-700 text-white' : 'bg-white border border-[#E4DCC8] text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}
      {!live && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Modo demo: los cambios no se persisten.
        </p>
      )}

      {tab === 'actividades' && (
        <ActividadesPanel
          live={live}
          actividades={actividades}
          onChange={setActividades}
          onAviso={setAviso}
          onError={setError}
        />
      )}
      {tab === 'zonas' && (
        <ZonasPanel live={live} zonas={zonas} onChange={setZonas} onAviso={setAviso} onError={setError} />
      )}
      {tab === 'horarios' && (
        <HorasPanel live={live} horas={horas} onChange={setHoras} onAviso={setAviso} onError={setError} />
      )}
    </div>
  )
}

function ActividadesPanel({
  live,
  actividades,
  onChange,
  onAviso,
  onError,
}: {
  live: boolean
  actividades: CatalogoActividad[]
  onChange: (v: CatalogoActividad[]) => void
  onAviso: (v: string | null) => void
  onError: (v: string | null) => void
}) {
  const [nombre, setNombre] = useState('')
  const [subNombre, setSubNombre] = useState<Record<number, string>>({})

  async function altaActividad() {
    const n = nombre.trim()
    if (!n) return
    onError(null)
    try {
      if (!live) {
        onChange([...actividades, { id: Date.now(), nombre: n, activo: true, sub_actividades: [] }])
        setNombre('')
        return
      }
      const { tenantId } = await contextoOperacion()
      const { data, error } = await supabase
        .from('actividad')
        .insert({ tenant_id: tenantId, nombre: n })
        .select('id, nombre, activo')
        .single()
      if (error) throw error
      onChange([...actividades, { ...data, sub_actividades: [] }])
      setNombre('')
      onAviso('Actividad creada')
    } catch (e) {
      onError(mensajeGc(e))
    }
  }

  async function altaSub(actividadId: number) {
    const n = (subNombre[actividadId] ?? '').trim()
    if (!n) return
    onError(null)
    try {
      if (!live) {
        onChange(
          actividades.map((a) =>
            a.id === actividadId
              ? { ...a, sub_actividades: [...a.sub_actividades, { id: Date.now(), nombre: n, activo: true }] }
              : a,
          ),
        )
        setSubNombre((s) => ({ ...s, [actividadId]: '' }))
        return
      }
      const { tenantId } = await contextoOperacion()
      const { data, error } = await supabase
        .from('sub_actividad')
        .insert({ tenant_id: tenantId, actividad_id: actividadId, nombre: n })
        .select('id, nombre, activo')
        .single()
      if (error) throw error
      onChange(
        actividades.map((a) =>
          a.id === actividadId ? { ...a, sub_actividades: [...a.sub_actividades, data] } : a,
        ),
      )
      setSubNombre((s) => ({ ...s, [actividadId]: '' }))
      onAviso('Subactividad creada')
    } catch (e) {
      onError(mensajeGc(e))
    }
  }

  async function toggleActivo(tabla: 'actividad' | 'sub_actividad', id: number, activo: boolean) {
    onError(null)
    try {
      if (live) {
        const { error } = await supabase.from(tabla).update({ activo }).eq('id', id)
        if (error) throw error
      }
      onChange(
        actividades.map((a) => {
          if (tabla === 'actividad' && a.id === id) return { ...a, activo }
          if (tabla === 'sub_actividad') {
            return {
              ...a,
              sub_actividades: a.sub_actividades.map((s) => (s.id === id ? { ...s, activo } : s)),
            }
          }
          return a
        }),
      )
    } catch (e) {
      onError(mensajeGc(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E4DCC8] bg-white p-4">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nueva actividad"
          className="flex-1 min-w-[12rem] rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void altaActividad()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
          Agregar
        </button>
      </div>
      {actividades.map((a) => (
        <div key={a.id} className="rounded-2xl border border-[#E4DCC8] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{a.nombre}</h3>
            <button
              type="button"
              onClick={() => void toggleActivo('actividad', a.id, !(a.activo ?? true))}
              className="text-xs rounded-full px-2 py-1 bg-slate-100"
            >
              {(a.activo ?? true) ? 'Activa' : 'Inactiva'}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {a.sub_actividades.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>{s.nombre}</span>
                <button
                  type="button"
                  onClick={() => void toggleActivo('sub_actividad', s.id, !(s.activo ?? true))}
                  className="text-[11px] text-slate-500"
                >
                  {(s.activo ?? true) ? 'activa' : 'inactiva'}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              value={subNombre[a.id] ?? ''}
              onChange={(e) => setSubNombre((s) => ({ ...s, [a.id]: e.target.value }))}
              placeholder="Nueva subactividad"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button type="button" onClick={() => void altaSub(a.id)} className="rounded-lg border border-brand-700 px-3 py-1.5 text-xs font-semibold text-brand-800">
              Añadir
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ZonasPanel({
  live,
  zonas,
  onChange,
  onAviso,
  onError,
}: {
  live: boolean
  zonas: ZonaCatalogo[]
  onChange: (v: ZonaCatalogo[]) => void
  onAviso: (v: string | null) => void
  onError: (v: string | null) => void
}) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')

  async function alta() {
    if (!codigo.trim() || !nombre.trim()) return
    onError(null)
    try {
      if (!live) {
        onChange([...zonas, { id: Date.now(), codigo: codigo.trim(), nombre: nombre.trim(), activo: true }])
        setCodigo('')
        setNombre('')
        return
      }
      const { tenantId } = await contextoOperacion()
      const { data, error } = await supabase
        .from('zona')
        .insert({ tenant_id: tenantId, codigo: codigo.trim(), nombre: nombre.trim() })
        .select('id, codigo, nombre, activo')
        .single()
      if (error) throw error
      onChange([...zonas, data])
      setCodigo('')
      setNombre('')
      onAviso('Zona creada')
    } catch (e) {
      onError(mensajeGc(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E4DCC8] bg-white p-4">
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código" className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de zona" className="flex-1 min-w-[10rem] rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void alta()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
          Agregar
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#EFE8D8] text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {zonas.map((z) => (
              <tr key={z.id}>
                <td className="px-4 py-3 font-mono text-xs">{z.codigo}</td>
                <td className="px-4 py-3">{z.nombre}</td>
                <td className="px-4 py-3">{(z.activo ?? true) ? 'activa' : 'inactiva'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HorasPanel({
  live,
  horas,
  onChange,
  onAviso,
  onError,
}: {
  live: boolean
  horas: CatalogoHora[]
  onChange: (v: CatalogoHora[]) => void
  onAviso: (v: string | null) => void
  onError: (v: string | null) => void
}) {
  const [nombre, setNombre] = useState('')
  const [cantidad, setCantidad] = useState('1')

  async function alta() {
    const n = nombre.trim()
    const c = Number(cantidad)
    if (!n || Number.isNaN(c) || c <= 0) return
    onError(null)
    try {
      if (!live) {
        onChange([...horas, { id: Date.now(), nombre: n, cantidad: c, activo: true }])
        setNombre('')
        return
      }
      const { tenantId } = await contextoOperacion()
      const { data, error } = await supabase
        .from('actividad_hora')
        .insert({ tenant_id: tenantId, nombre: n, cantidad: c })
        .select('id, nombre, cantidad, activo')
        .single()
      if (error) throw error
      onChange([...horas, data])
      setNombre('')
      onAviso('Duración creada')
    } catch (e) {
      onError(mensajeGc(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E4DCC8] bg-white p-4">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. 2 horas)" className="flex-1 min-w-[10rem] rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} type="number" step="0.5" min="0.5" className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void alta()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
          Agregar
        </button>
      </div>
      <ul className="rounded-2xl border border-[#E4DCC8] bg-white divide-y divide-slate-100">
        {horas.map((h) => (
          <li key={h.id} className="px-4 py-3 text-sm flex justify-between">
            <span>{h.nombre}</span>
            <span className="text-slate-500">{h.cantidad} h</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
