import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { contextoOperacion, mensajeGc } from '../../lib/persistir'
import type { CatalogoActividad, CatalogoHora, ZonaCatalogo } from '../../lib/catalogos'
import { useDominio } from '../../app/DominioContext'
import { useAuth } from '../auth/useAuth'
import { mostrarConfiguracion } from '../../lib/claims'
import {
  Alert,
  Badge,
  BrandMark,
  Button,
  Input,
  PageHeader,
  PAGE,
  Table,
  Tabs,
  TabPanel,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { colorCssValido, logoUrlValido, type BrandingTenant } from '../../lib/branding'
import { fieldClass } from '../../components/ui'

type Tab = 'branding' | 'actividades' | 'zonas' | 'horarios' | 'estados' | 'rastreo' | 'plantillas' | 'cors'

export function CatalogosPage() {
  const { fuente } = useDominio()
  const { rol } = useAuth()
  const live = fuente === 'supabase'
  const puedeEditarRastreo = mostrarConfiguracion(rol)
  const [tab, setTab] = useState<Tab>('branding')
  const [actividades, setActividades] = useState<CatalogoActividad[]>([])
  const [zonas, setZonas] = useState<ZonaCatalogo[]>([])
  const [horas, setHoras] = useState<CatalogoHora[]>([])
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
    <div className={PAGE}>
      <PageHeader spec="W-10" title="Configuración" description="Branding, catálogos, rastreo, plantillas y CORS de tu empresa." />
      <Tabs
        tabs={[
          { id: 'branding', label: 'Branding' },
          { id: 'actividades', label: 'Actividades' },
          { id: 'zonas', label: 'Zonas' },
          { id: 'horarios', label: 'Horarios' },
          { id: 'estados', label: 'Estados de visita' },
          { id: 'rastreo', label: 'Rastreo' },
          { id: 'plantillas', label: 'Plantillas' },
          { id: 'cors', label: 'CORS' },
        ]}
        valor={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {aviso && <Alert tone="success">{aviso}</Alert>}
      {!live && <Alert tone="warning">Modo demo: los cambios no se persisten.</Alert>}
      <TabPanel id="branding" valor={tab}>
        <BrandingPanel live={live} onAviso={setAviso} onError={setError} />
      </TabPanel>
      <TabPanel id="actividades" valor={tab}>
        <ActividadesPanel live={live} actividades={actividades} onChange={setActividades} onAviso={setAviso} onError={setError} />
      </TabPanel>
      <TabPanel id="zonas" valor={tab}>
        <ZonasPanel live={live} zonas={zonas} onChange={setZonas} onAviso={setAviso} onError={setError} />
      </TabPanel>
      <TabPanel id="horarios" valor={tab}>
        <HorasPanel live={live} horas={horas} onChange={setHoras} onAviso={setAviso} onError={setError} />
      </TabPanel>
      <TabPanel id="estados" valor={tab}>
        <EstadosVisitaPanel />
      </TabPanel>
      <TabPanel id="rastreo" valor={tab}>
        <RastreoPanel live={live} editable={puedeEditarRastreo} onAviso={setAviso} onError={setError} />
      </TabPanel>
      <TabPanel id="plantillas" valor={tab}>
        <PlantillasPanel live={live} onAviso={setAviso} onError={setError} />
      </TabPanel>
      <TabPanel id="cors" valor={tab}>
        <CorsPanel live={live} onAviso={setAviso} onError={setError} />
      </TabPanel>
    </div>
  )
}

function BrandingPanel({
  live,
  onAviso,
  onError,
}: {
  live: boolean
  onAviso: (v: string | null) => void
  onError: (v: string | null) => void
}) {
  const { branding, tenantNombre, setBranding, setTenantNombre } = useDominio()
  const { push } = useToast()
  const [nombre, setNombre] = useState(branding.nombre_comercial ?? tenantNombre)
  const [color, setColor] = useState(branding.color_primario ?? '#6D28D9')
  const [secundario, setSecundario] = useState(branding.color_secundario ?? '#64748B')
  const [logo, setLogo] = useState(branding.logo_url ?? '')
  const [vocabPersona, setVocabPersona] = useState(branding.vocabulario?.persona ?? '')
  const preview: BrandingTenant = {
    nombre_comercial: nombre,
    color_primario: color,
    color_secundario: secundario,
    logo_url: logo,
    vocabulario: vocabPersona.trim() ? { persona: vocabPersona.trim() } : undefined,
  }

  async function guardar() {
    onError(null)
    if (!colorCssValido(color)) {
      onError('El color debe ser un hex válido (#RGB o #RRGGBB)')
      return
    }
    if (secundario.trim() && !colorCssValido(secundario)) {
      onError('El color secundario debe ser un hex válido')
      return
    }
    if (logo.trim() && !logoUrlValido(logo)) {
      onError('El logo debe ser una URL http(s)')
      return
    }
    const next: BrandingTenant = {
      nombre_comercial: nombre.trim() || tenantNombre,
      color_primario: color,
      color_secundario: secundario.trim() || undefined,
      logo_url: logo.trim() || undefined,
      vocabulario: vocabPersona.trim() ? { ...branding.vocabulario, persona: vocabPersona.trim() } : branding.vocabulario,
    }
    setBranding(next)
    setTenantNombre(next.nombre_comercial ?? tenantNombre)
    if (!live) {
      onAviso('Vista previa actualizada (demo, no se persiste)')
      push({ tone: 'success', titulo: 'Branding actualizado (demo)' })
      return
    }
    try {
      const { tenantId } = await contextoOperacion()
      const { error } = await supabase.from('tenant').update({ branding: next, nombre: next.nombre_comercial }).eq('id', tenantId)
      if (error) throw error
      onAviso('Branding guardado')
      push({ tone: 'success', titulo: 'Branding guardado' })
    } catch (e) {
      const msg = mensajeGc(e)
      onError(msg)
      push({ tone: 'error', titulo: msg })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <Input id="brand-nombre" label="Nombre comercial" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div>
          <label htmlFor="brand-color" className="block text-sm font-medium text-ink">Color primario</label>
          <div className="mt-1 flex items-center gap-3">
            <input id="brand-color" type="color" value={colorCssValido(color) ?? '#6D28D9'} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded border border-line" />
            <input id="brand-color-hex" aria-label="Hex primario" value={color} onChange={(e) => setColor(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <div>
          <label htmlFor="brand-secundario" className="block text-sm font-medium text-ink">Color secundario</label>
          <div className="mt-1 flex items-center gap-3">
            <input id="brand-secundario" type="color" value={colorCssValido(secundario) ?? '#64748B'} onChange={(e) => setSecundario(e.target.value)} className="h-10 w-16 rounded border border-line" />
            <input id="brand-secundario-hex" aria-label="Hex secundario" value={secundario} onChange={(e) => setSecundario(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <Input id="brand-logo" label="URL del logo" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />
        <Input id="brand-vocab-persona" label="Vocabulario: personas" hint="Renombra Personas en nav y encabezados si el JSON del tenant lo define." value={vocabPersona} onChange={(e) => setVocabPersona(e.target.value)} />
        <Button onClick={() => void guardar()}>Guardar branding</Button>
      </div>
      <div className="rounded-2xl border border-line bg-ink p-5 text-canvas">
        <p className="text-xs text-white/50">Vista previa</p>
        <div className="mt-4 flex items-center gap-3">
          <BrandMark nombre={nombre || 'GC'} logoUrl={preview.logo_url} variant="dark" />
          <div>
            <p className="text-lg font-semibold">{nombre || 'Gestiones Comerciales'}</p>
            <p className="text-xs text-white/60">Sidebar y login usan este logo, el primario y el secundario.</p>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <div className="h-10 flex-1 rounded-lg" style={{ background: colorCssValido(color) ?? 'var(--gc-primary)' }} />
          <div className="h-10 flex-1 rounded-lg" style={{ background: colorCssValido(secundario) ?? 'var(--gc-secondary)' }} />
        </div>
      </div>
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
      <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-4">
        <input
          id="nueva-actividad"
          aria-label="Nueva actividad"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nueva actividad"
          className={`flex-1 min-w-[12rem] ${fieldClass}`}
        />
        <Button type="button" onClick={() => void altaActividad()}>
          Agregar
        </Button>
      </div>
      {actividades.map((a) => (
        <div key={a.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{a.nombre}</h3>
            <button
              type="button"
              onClick={() => void toggleActivo('actividad', a.id, !(a.activo ?? true))}
              className="text-xs"
            >
              <Badge tone={(a.activo ?? true) ? 'success' : 'neutral'}>
                {(a.activo ?? true) ? 'Activa' : 'Inactiva'}
              </Badge>
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {a.sub_actividades.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>{s.nombre}</span>
                <button
                  type="button"
                  onClick={() => void toggleActivo('sub_actividad', s.id, !(s.activo ?? true))}
                  className="text-[11px] text-muted"
                >
                  {(s.activo ?? true) ? 'activa' : 'inactiva'}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              id={`sub-${a.id}`}
              aria-label={`Nueva subactividad de ${a.nombre}`}
              value={subNombre[a.id] ?? ''}
              onChange={(e) => setSubNombre((s) => ({ ...s, [a.id]: e.target.value }))}
              placeholder="Nueva subactividad"
              className={`flex-1 ${fieldClass}`}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => void altaSub(a.id)}>
              Añadir
            </Button>
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
      <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-4">
        <input
          id="zona-codigo"
          aria-label="Código de zona"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código"
          className={`w-28 ${fieldClass}`}
        />
        <input
          id="zona-nombre"
          aria-label="Nombre de zona"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de zona"
          className={`flex-1 min-w-[10rem] ${fieldClass}`}
        />
        <Button type="button" onClick={() => void alta()}>
          Agregar
        </Button>
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th>Estado</Th>
          </tr>
        </THead>
        <TBody>
          {zonas.map((z) => (
            <Tr key={z.id}>
              <Td className="font-mono text-xs">{z.codigo}</Td>
              <Td>{z.nombre}</Td>
              <Td>{(z.activo ?? true) ? 'activa' : 'inactiva'}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
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
      <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-4">
        <input
          id="hora-nombre"
          aria-label="Nombre de duración"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (ej. 2 horas)"
          className={`flex-1 min-w-[10rem] ${fieldClass}`}
        />
        <input
          id="hora-cantidad"
          aria-label="Cantidad de horas"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          type="number"
          step="0.5"
          min="0.5"
          className={`w-24 ${fieldClass}`}
        />
        <Button type="button" onClick={() => void alta()}>
          Agregar
        </Button>
      </div>
      <ul className="rounded-2xl border border-line bg-surface divide-y divide-line">
        {horas.map((h) => (
          <li key={h.id} className="px-4 py-3 text-sm flex justify-between">
            <span>{h.nombre}</span>
            <span className="text-muted">{h.cantidad} h</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const ESTADOS_MAQUINA = [
  { codigo: 'programada', nombre: 'Programada', detalle: 'Estado inicial al crear la visita.' },
  { codigo: 'completada', nombre: 'Completada', detalle: 'Check-out / visita_completar.' },
  { codigo: 'aprobada', nombre: 'Aprobada', detalle: 'Cierre positivo (visita_revisar).' },
  { codigo: 'rechazada', nombre: 'Rechazada', detalle: 'Cierre con comentario_rechazo.' },
  { codigo: 'anulada', nombre: 'Anulada', detalle: 'Corta el flujo.' },
]

function EstadosVisitaPanel() {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">
        No hay tabla <code>visita_estado</code>: la máquina vive en un CHECK de <code>visita.estado</code>.
        Esta vista es de solo lectura.
      </p>
      <ul className="space-y-2">
        {ESTADOS_MAQUINA.map((e) => (
          <li key={e.codigo} className="flex justify-between gap-3 rounded-lg border border-line px-3 py-2">
            <span className="font-medium capitalize">{e.nombre}</span>
            <span className="text-sm text-muted">{e.detalle}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface VentanaRastreo {
  id: number
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  intervalo_min: number
  precision_max_m: number
}

function RastreoPanel({
  live,
  editable,
  onAviso,
  onError,
}: {
  live: boolean
  editable: boolean
  onAviso: (v: string | null) => void
  onError: (v: string | null) => void
}) {
  const [filas, setFilas] = useState<VentanaRastreo[]>(
    DIAS.map((_, i) => ({
      id: i,
      dia_semana: i,
      hora_inicio: '07:00',
      hora_fin: '18:00',
      intervalo_min: 15,
      precision_max_m: 100,
    })),
  )

  useEffect(() => {
    if (!live) return
    void supabase
      .from('config_rastreo')
      .select('id, dia_semana, hora_inicio, hora_fin, intervalo_min, precision_max_m')
      .order('dia_semana')
      .then(({ data, error }) => {
        if (error) {
          onError(error.message)
          return
        }
        if (data?.length) setFilas(data as VentanaRastreo[])
      })
  }, [live, onError])

  async function guardarFila(f: VentanaRastreo) {
    if (!editable) {
      onError('GC-AUTH-001: solo el administrador del tenant puede editar rastreo')
      return
    }
    onError(null)
    setFilas((prev) => prev.map((x) => (x.dia_semana === f.dia_semana ? f : x)))
    if (!live) {
      onAviso('Ventana actualizada (demo)')
      return
    }
    const { error } = await supabase
      .from('config_rastreo')
      .update({
        hora_inicio: f.hora_inicio,
        hora_fin: f.hora_fin,
        intervalo_min: f.intervalo_min,
        precision_max_m: f.precision_max_m,
      })
      .eq('id', f.id)
    if (error) onError(mensajeGc(error))
    else onAviso('Rastreo guardado')
  }

  return (
    <div className="space-y-3">
      {filas.map((f) => (
        <div key={f.dia_semana} className="grid gap-2 rounded-2xl border border-line bg-surface p-4 md:grid-cols-5">
          <p className="text-sm font-medium self-center">{DIAS[f.dia_semana]}</p>
          <Input
            id={`ras-ini-${f.dia_semana}`}
            label="Inicio"
            type="time"
            value={String(f.hora_inicio).slice(0, 5)}
            onChange={(e) => setFilas((p) => p.map((x) => (x.dia_semana === f.dia_semana ? { ...x, hora_inicio: e.target.value } : x)))}
          />
          <Input
            id={`ras-fin-${f.dia_semana}`}
            label="Fin"
            type="time"
            value={String(f.hora_fin).slice(0, 5)}
            onChange={(e) => setFilas((p) => p.map((x) => (x.dia_semana === f.dia_semana ? { ...x, hora_fin: e.target.value } : x)))}
          />
          <Input
            id={`ras-int-${f.dia_semana}`}
            label="Intervalo (min)"
            type="number"
            value={String(f.intervalo_min)}
            onChange={(e) => setFilas((p) => p.map((x) => (x.dia_semana === f.dia_semana ? { ...x, intervalo_min: Number(e.target.value) } : x)))}
          />
          <Button size="sm" onClick={() => void guardarFila(filas.find((x) => x.dia_semana === f.dia_semana)!)}>
            Guardar
          </Button>
        </div>
      ))}
    </div>
  )
}

interface PlantillaNotif {
  codigo: string
  asunto: string
  cuerpo: string
}

function PlantillasPanel({
  live,
  onAviso,
  onError,
}: {
  live: boolean
  onAviso: (v: string | null) => void
  onError: (v: string | null) => void
}) {
  const { configuracion, setConfiguracion } = useDominio()
  const iniciales = Array.isArray(configuracion.plantillas_notificacion)
    ? (configuracion.plantillas_notificacion as PlantillaNotif[])
    : [{ codigo: 'agenda', asunto: 'Recordatorio de visita', cuerpo: 'Tenés una visita programada mañana.' }]
  const [plantillas, setPlantillas] = useState<PlantillaNotif[]>(iniciales)

  async function guardar() {
    onError(null)
    const next = { ...configuracion, plantillas_notificacion: plantillas }
    setConfiguracion(next)
    if (!live) {
      onAviso('Plantillas actualizadas (demo). No hay tabla plantilla_notificacion; se guarda en tenant.configuracion.')
      return
    }
    try {
      const { tenantId } = await contextoOperacion()
      const { error } = await supabase.from('tenant').update({ configuracion: next }).eq('id', tenantId)
      if (error) throw error
      onAviso('Plantillas guardadas en tenant.configuracion')
    } catch (e) {
      onError(mensajeGc(e))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        No existe tabla de plantillas. Se persisten en <code>tenant.configuracion.plantillas_notificacion</code>.
      </p>
      {plantillas.map((p, i) => (
        <div key={p.codigo + i} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          <Input
            id={`plt-cod-${i}`}
            label="Código"
            value={p.codigo}
            onChange={(e) => setPlantillas((arr) => arr.map((x, j) => (j === i ? { ...x, codigo: e.target.value } : x)))}
          />
          <Input
            id={`plt-as-${i}`}
            label="Asunto"
            value={p.asunto}
            onChange={(e) => setPlantillas((arr) => arr.map((x, j) => (j === i ? { ...x, asunto: e.target.value } : x)))}
          />
          <Input
            id={`plt-cu-${i}`}
            label="Cuerpo"
            value={p.cuerpo}
            onChange={(e) => setPlantillas((arr) => arr.map((x, j) => (j === i ? { ...x, cuerpo: e.target.value } : x)))}
          />
        </div>
      ))}
      <Button onClick={() => void guardar()}>Guardar plantillas</Button>
    </div>
  )
}

function CorsPanel({
  live,
  onAviso,
  onError,
}: {
  live: boolean
  onAviso: (v: string | null) => void
  onError: (v: string | null) => void
}) {
  const { configuracion, setConfiguracion } = useDominio()
  const inicial = Array.isArray(configuracion.dominios_cors)
    ? (configuracion.dominios_cors as string[]).join(', ')
    : ''
  const [texto, setTexto] = useState(inicial)

  async function guardar() {
    onError(null)
    const dominios = texto.split(',').map((s) => s.trim()).filter(Boolean)
    const next = { ...configuracion, dominios_cors: dominios }
    setConfiguracion(next)
    if (!live) {
      onAviso('CORS actualizado (demo)')
      return
    }
    try {
      const { tenantId } = await contextoOperacion()
      const { error } = await supabase.from('tenant').update({ configuracion: next }).eq('id', tenantId)
      if (error) throw error
      onAviso('dominios_cors guardados')
    } catch (e) {
      onError(mensajeGc(e))
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <Input
        id="cors-dominios"
        label="Dominios CORS (separados por coma)"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        hint="Se guardan en tenant.configuracion.dominios_cors"
      />
      <Button onClick={() => void guardar()}>Guardar CORS</Button>
    </div>
  )
}
