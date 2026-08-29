import { useCallback, useEffect, useMemo, useState } from 'react'
import { mostrarMapa } from '../../lib/claims'
import {
  filtrarEquipo,
  recorridoDe,
  ultimaPorAsesor,
  coordenadasDe,
  type PuntoMapa,
} from '../../lib/mapa'
import { mensajeGc } from '../../lib/persistir'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { useAuth } from '../auth/useAuth'
import { MapaLeaflet } from './MapaLeaflet'
import { CLIENTES_DEMO, SUPERVISORES_DEMO, puntosDemo, type ClienteMapa, type SupervisorOpcion } from './puntosDemo'
import { Alert, PageHeader, PAGE, Table, THead, Th, TBody, Tr, Td, EmptyState } from '../../components/ui'

function hoyLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function horaCorta(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16)
  return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
}

export function MapaPage() {
  const { fuente } = useDominio()
  const { rol } = useAuth()
  const puede = mostrarMapa(rol, DEMO_MODE)
  const live = !DEMO_MODE && fuente === 'supabase'
  const [fecha, setFecha] = useState(hoyLocal)
  const [puntos, setPuntos] = useState<PuntoMapa[]>(() => puntosDemo())
  const [clientes] = useState<ClienteMapa[]>(CLIENTES_DEMO)
  const [supervisores, setSupervisores] = useState<SupervisorOpcion[]>(SUPERVISORES_DEMO)
  const [equipo, setEquipo] = useState('')
  const [seleccionado, setSeleccionado] = useState<string | null>('u-luisa')
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!live) {
      const hoy = hoyLocal()
      setPuntos(fecha === hoy ? puntosDemo() : [])
      setSupervisores(SUPERVISORES_DEMO)
      if (fecha !== hoy) setSeleccionado(null)
      return
    }
    setError(null)
    const rpc = await supabase.rpc('mapa_recorrido', { p_fecha: fecha })
    let filas: PuntoMapa[] = []
    if (!rpc.error && Array.isArray(rpc.data)) {
      filas = (rpc.data as Array<{
        usuario_id: string
        nombre: string
        rol: string
        jefe_id: string | null
        lat: number
        lng: number
        precision_m: number | null
        registrado_en: string
      }>).map((r) => ({
        usuarioId: r.usuario_id,
        nombre: r.nombre,
        rol: r.rol,
        jefeId: r.jefe_id,
        lat: Number(r.lat),
        lng: Number(r.lng),
        precisionM: r.precision_m,
        registradoEn: r.registrado_en,
      }))
    } else {
      const inicio = `${fecha}T00:00:00-06:00`
      const fin = `${fecha}T23:59:59.999-06:00`
      const tabla = await supabase
        .from('rastreo_ubicacion')
        .select('usuario_id, precision_m, registrado_en, posicion, usuario(nombre, rol, jefe_id)')
        .gte('registrado_en', inicio)
        .lte('registrado_en', fin)
        .order('registrado_en')
        .limit(2000)
      if (tabla.error) {
        setError(mensajeGc(rpc.error ?? tabla.error))
        return
      }
      const filasTabla: PuntoMapa[] = []
      for (const r of (tabla.data ?? []) as Array<{
        usuario_id: string
        precision_m: number | null
        registrado_en: string
        posicion: unknown
        usuario:
          | { nombre?: string; rol?: string; jefe_id?: string | null }
          | { nombre?: string; rol?: string; jefe_id?: string | null }[]
          | null
      }>) {
        const u = Array.isArray(r.usuario) ? r.usuario[0] : r.usuario
        const xy = coordenadasDe(r.posicion)
        if (!xy) continue
        filasTabla.push({
          usuarioId: r.usuario_id,
          nombre: u?.nombre ?? 'Asesor',
          rol: u?.rol ?? 'asesor',
          jefeId: u?.jefe_id ?? null,
          lat: xy.lat,
          lng: xy.lng,
          precisionM: r.precision_m ?? undefined,
          registradoEn: r.registrado_en,
        })
      }
      filas = filasTabla
    }
    setPuntos(filas)
    const { data: usuarios } = await supabase.rpc('usuarios_empresa')
    const supers = ((usuarios ?? []) as Array<{ id: string; nombre: string; rol: string }>)
      .filter((u) => u.rol === 'supervisor')
      .map((u) => ({ id: u.id, nombre: u.nombre }))
    if (supers.length) setSupervisores(supers)
    const ids = new Set(filas.map((p) => p.usuarioId))
    setSeleccionado((prev) => (prev && ids.has(prev) ? prev : (filas[0]?.usuarioId ?? null)))
  }, [live, fecha])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => filtrarEquipo(puntos, equipo || null), [puntos, equipo])
  const ultimas = useMemo(() => ultimaPorAsesor(visibles), [visibles])
  const recorrido = useMemo(
    () => (seleccionado ? recorridoDe(visibles, seleccionado) : []),
    [visibles, seleccionado],
  )
  const mostrarFiltro = DEMO_MODE || rol === 'gerente' || rol === 'admin'

  if (!puede) {
    return (
      <div className="max-w-lg rounded-2xl border border-line bg-surface p-6" data-spec="W-14">
        <h2 className="font-display text-2xl tracking-tight">Sin acceso al mapa</h2>
        <p className="text-sm text-muted mt-2">El mapa de asesores es para supervisor, gerente y admin.</p>
      </div>
    )
  }

  return (
    <div className={PAGE}>
      <PageHeader spec="W-14" title="Mapa de asesores" description="Última posición y recorrido del día. Teselas OpenStreetMap." />
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {!live && (
        <Alert tone="warning">
          Modo demo: recorridos de campo en Escuintla, Guatemala y Quetzaltenango. Sin GPS real.
        </Alert>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <div className="text-sm">
          <label htmlFor="mapa-fecha" className="block text-[11px] uppercase tracking-wide text-muted mb-1">
            Fecha
          </label>
          <input
            id="mapa-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        {mostrarFiltro && (
          <div className="text-sm">
            <label htmlFor="filtro-equipo" className="block text-[11px] uppercase tracking-wide text-muted mb-1">
              Equipo
            </label>
            <select
              id="filtro-equipo"
              value={equipo}
              onChange={(e) => setEquipo(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm min-w-[12rem]"
            >
              <option value="">Todos los equipos</option>
              {supervisores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <MapaLeaflet
        ultimas={ultimas}
        recorrido={recorrido}
        clientes={live ? [] : clientes}
        seleccionado={seleccionado}
        onSelect={setSeleccionado}
      />

      {ultimas.length === 0 ? (
        <EmptyState titulo="No hay rastreo para esta fecha" descripcion="Elegí otro día o quitá el filtro de equipo." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Asesor</Th>
              <Th>Rol</Th>
              <Th>Última</Th>
              <Th className="hidden md:table-cell">Puntos</Th>
            </tr>
          </THead>
          <TBody>
            {ultimas.map((p) => (
              <Tr
                key={p.usuarioId}
                className={`cursor-pointer ${p.usuarioId === seleccionado ? 'bg-canvas' : ''}`}
                onClick={() => setSeleccionado(p.usuarioId)}
              >
                <Td className="font-medium">{p.nombre}</Td>
                <Td className="capitalize text-muted">{p.rol}</Td>
                <Td className="whitespace-nowrap">{horaCorta(p.registradoEn)}</Td>
                <Td className="hidden md:table-cell text-muted">{recorridoDe(visibles, p.usuarioId).length}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
