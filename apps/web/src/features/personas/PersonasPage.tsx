import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDominio } from '../../app/DominioContext'
import { parseCsv, PLANTILLA_PERSONAS_CSV } from '../../lib/csv'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { contextoOperacion, mensajeGc } from '../../lib/persistir'
import type { PersonaItem } from '../calendar/personasData'
import { fetchPersonas } from './personasApi'
import { QK } from '../../lib/queryClient'
import { etiquetaVocab } from '../../lib/vocabulario'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  PAGE,
  TableSkeleton,
} from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'

interface ReporteImport {
  insertados: number
  actualizados: number
  errores: Array<{ fila?: number; codigo?: string; mensaje?: string }>
}

function personaDesdeFila(row: Record<string, string>, id: string): PersonaItem | null {
  const nombre = row.nombre?.trim()
  const documento = row.documento?.trim()
  if (!nombre || !documento) return null
  return {
    id,
    nombre,
    documento,
    categoria: row.categoria?.trim() || 'Cliente',
    telefono: row.telefono?.trim() || '—',
    direccion: row.direccion?.trim() || '—',
    visitasPendientes: 0,
  }
}

export function PersonasPage() {
  const { personas: personasDominio, setPersonas, abrirNuevaVisita, fuente, branding } = useDominio()
  const live = !DEMO_MODE && fuente === 'supabase'
  const q = useQuery({
    queryKey: QK.personas,
    queryFn: fetchPersonas,
    enabled: live,
  })
  const personas = live ? (q.data ?? personasDominio) : personasDominio
  const { push } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reporte, setReporte] = useState<ReporteImport | null>(null)
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<PersonaItem | null>(personas[0] ?? null)

  const filtradas = personas.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.documento.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.direccion.toLowerCase().includes(busqueda.toLowerCase()),
  )

  function descargarPlantilla() {
    const blob = new Blob([PLANTILLA_PERSONAS_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-personas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onArchivo(file: File) {
    setError(null)
    setAviso(null)
    setReporte(null)
    setCargando(true)
    try {
      const text = await file.text()
      const filas = parseCsv(text)
      if (filas.length === 0) {
        setError('GC-IMP-016: el archivo no tiene filas')
        return
      }

      const live = !DEMO_MODE && fuente === 'supabase'
      if (!live) {
        let insertados = 0
        let actualizados = 0
        const errores: ReporteImport['errores'] = []
        const next = [...personas]
        filas.forEach((row, i) => {
          const item = personaDesdeFila(row, `imp-${Date.now()}-${i}`)
          if (!item) {
            errores.push({ fila: i + 1, codigo: 'GC-IMP-001', mensaje: 'nombre y documento son obligatorios' })
            return
          }
          const idx = next.findIndex((p) => p.documento === item.documento)
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...item, id: next[idx].id }
            actualizados++
          } else {
            next.push(item)
            insertados++
          }
        })
        setPersonas(next)
        setReporte({ insertados, actualizados, errores })
        const msg = `Importación demo: ${insertados} altas, ${actualizados} actualizados, ${errores.length} errores`
        setAviso(msg)
        push({ tone: 'success', titulo: msg })
        return
      }

      const { tenantId } = await contextoOperacion()
      const { data, error: fnError } = await supabase.functions.invoke('importer', {
        body: { tipo: 'personas', tenant_id: tenantId, filas },
      })
      if (fnError) throw fnError
      const payload = data as { error?: string; insertados?: number; actualizados?: number; errores?: ReporteImport['errores'] } | null
      if (payload?.error) throw new Error(payload.error)
      setReporte({
        insertados: payload?.insertados ?? 0,
        actualizados: payload?.actualizados ?? 0,
        errores: payload?.errores ?? [],
      })
      const msg = `Importación: ${payload?.insertados ?? 0} altas, ${payload?.actualizados ?? 0} actualizados, ${payload?.errores?.length ?? 0} errores`
      setAviso(msg)
      push({ tone: 'success', titulo: msg })
      const { data: personasDb } = await supabase
        .from('persona')
        .select('id, nombre, categoria, documento, direccion, detalles')
        .eq('activo', true)
        .order('nombre')
        .limit(300)
      if (personasDb) {
        setPersonas(
          (personasDb as Array<{
            id: number | string
            nombre: string
            categoria: string | null
            documento: string | null
            direccion: string | null
            detalles: { telefono?: string } | null
          }>).map((p) => ({
            id: String(p.id),
            nombre: p.nombre,
            categoria: p.categoria ?? 'Cliente',
            documento: p.documento ?? 'Sin documento',
            telefono: p.detalles?.telefono ?? '—',
            direccion: p.direccion ?? '—',
            visitasPendientes: 0,
          })),
        )
      }
    } catch (e) {
      const msg = mensajeGc(e)
      setError(msg)
      push({ tone: 'error', titulo: msg })
    } finally {
      setCargando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn(PAGE, 'max-w-none')}>
      <PageHeader
        spec="W-04"
        title={etiquetaVocab(branding, 'persona', 'Personas')}
        description={`${personas.length} registros`}
        actions={
          <>
            <Button variant="secondary" onClick={descargarPlantilla}>
              Plantilla CSV
            </Button>
            <Button onClick={() => inputRef.current?.click()} disabled={cargando}>
              {cargando ? 'Importando…' : 'Importar CSV'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="Archivo CSV de personas"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onArchivo(file)
              }}
            />
          </>
        }
      />

      {aviso && <Alert tone="success">{aviso}</Alert>}
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
      {reporte && reporte.errores.length > 0 && (
        <Alert tone="warning">
          <ul>
            {reporte.errores.slice(0, 8).map((err, i) => (
              <li key={i}>
                Fila {err.fila ?? '?'}: {err.codigo} {err.mensaje}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {live && q.isLoading ? (
        <TableSkeleton cols={3} />
      ) : (
      <div className="grid min-h-[28rem] gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="flex flex-col rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="border-b border-line p-3">
            <Input
              id="buscar-persona"
              label="Buscar"
              placeholder="Buscar por nombre, rubro o dirección..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-line/70">
            {filtradas.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSeleccion(p)}
                  className={cn(
                    'rail w-full min-h-11 px-4 py-3 text-left transition-colors duration-campo hover:bg-canvas',
                    seleccion?.id === p.id && 'bg-canvas',
                  )}
                >
                  <p className="font-medium truncate">{p.nombre}</p>
                  <p className="text-xs text-muted truncate">{p.categoria}</p>
                </button>
              </li>
            ))}
          </ul>
          {filtradas.length === 0 && (
            <EmptyState
              titulo="Sin coincidencias"
              descripcion="Probá otro término o importá un CSV."
              cta={{ etiqueta: 'Importar CSV', onClick: () => inputRef.current?.click() }}
            />
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          {seleccion ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl tracking-tight">{seleccion.nombre}</h3>
                  <Badge tone="primary" className="mt-2">
                    {seleccion.categoria}
                  </Badge>
                </div>
                <Button onClick={() => abrirNuevaVisita(seleccion.nombre)}>+ Agendar visita</Button>
              </div>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Documento</dt>
                  <dd className="mt-0.5 font-medium">{seleccion.documento}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Teléfono</dt>
                  <dd className="mt-0.5 font-medium">{seleccion.telefono}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted">Dirección</dt>
                  <dd className="mt-0.5">{seleccion.direccion}</dd>
                </div>
                {seleccion.saldo ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Saldo</dt>
                    <dd className="mt-0.5 font-semibold">{seleccion.saldo}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Visitas pendientes</dt>
                  <dd className="mt-0.5">{seleccion.visitasPendientes}</dd>
                </div>
              </dl>
            </>
          ) : (
            <EmptyState
              titulo="Elegí una persona"
              descripcion="La ficha muestra datos, documento y acciones de agenda."
            />
          )}
        </div>
      </div>
      )}
    </div>
  )
}
