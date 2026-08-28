import { useRef, useState } from 'react'
import { PersonasView } from '../calendar/components/PersonasView'
import { useDominio } from '../../app/DominioContext'
import { parseCsv, PLANTILLA_PERSONAS_CSV } from '../../lib/csv'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { contextoOperacion, mensajeGc } from '../../lib/persistir'
import type { PersonaItem } from '../calendar/personasData'

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
  const { personas, setPersonas, abrirNuevaVisita, fuente } = useDominio()
  const inputRef = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reporte, setReporte] = useState<ReporteImport | null>(null)
  const [cargando, setCargando] = useState(false)

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
        setAviso(`Importación demo: ${insertados} altas, ${actualizados} actualizados, ${errores.length} errores`)
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
      setAviso(
        `Importación: ${payload?.insertados ?? 0} altas, ${payload?.actualizados ?? 0} actualizados, ${payload?.errores?.length ?? 0} errores`,
      )
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
      setError(mensajeGc(e))
    } finally {
      setCargando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-3xl h-[calc(100vh-8rem)] rounded-2xl border border-[#E4DCC8] overflow-hidden bg-white relative flex flex-col">
      <div className="shrink-0 px-5 py-3 border-b border-[#E4DCC8] bg-[#FBF8F1] flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-brand-700 mr-auto">W-04 · Importar cartera</p>
        <button
          type="button"
          onClick={descargarPlantilla}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
        >
          Plantilla CSV
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={cargando}
          className="rounded-lg bg-brand-700 hover:bg-brand-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {cargando ? 'Importando…' : 'Importar CSV'}
        </button>
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
      </div>
      {aviso && <p className="px-5 py-2 text-xs text-emerald-800 bg-emerald-50">{aviso}</p>}
      {error && <p className="px-5 py-2 text-xs text-red-700 bg-red-50">{error}</p>}
      {reporte && reporte.errores.length > 0 && (
        <ul className="px-5 py-2 text-xs text-amber-800 bg-amber-50 max-h-24 overflow-auto">
          {reporte.errores.slice(0, 8).map((err, i) => (
            <li key={i}>
              Fila {err.fila ?? '?'}: {err.codigo} {err.mensaje}
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1 min-h-0">
        <PersonasView
          embedded
          personas={personas}
          onOpenNewEvent={() => abrirNuevaVisita()}
          onNavigateTab={() => undefined}
          onScheduleWithPersona={(nombre) => abrirNuevaVisita(nombre)}
        />
      </div>
    </div>
  )
}
