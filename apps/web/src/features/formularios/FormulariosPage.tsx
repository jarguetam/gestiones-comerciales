import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDominio } from '../../app/DominioContext'
import { camposDe, scorePorcentajeCompletado, validarRespuestas } from '../../lib/formulario'
import { mensajeGc, persistirFormulario } from '../../lib/persistir'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { FormularioRenderer } from './FormularioRenderer'
import { PLANTILLAS_DEMO, RESPUESTAS_DEMO, type PlantillaFormulario, type RespuestaFormulario } from './plantillasDemo'

function formatearFecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

export function FormulariosPage() {
  const { fuente, personas } = useDominio()
  const live = !DEMO_MODE && fuente === 'supabase'
  const [plantillas, setPlantillas] = useState<PlantillaFormulario[]>(PLANTILLAS_DEMO)
  const [historial, setHistorial] = useState<RespuestaFormulario[]>(RESPUESTAS_DEMO)
  const [plantillaId, setPlantillaId] = useState<string>(PLANTILLAS_DEMO[0].id)
  const [valores, setValores] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    if (!live) return
    const [pRes, rRes] = await Promise.all([
      supabase
        .from('formulario_plantilla')
        .select('id, nombre, descripcion, esquema, calculo, activo')
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('formulario_respuesta')
        .select('id, plantilla_id, respuestas, resultado, enviado_en, formulario_plantilla(nombre)')
        .order('enviado_en', { ascending: false })
        .limit(50),
    ])
    if (pRes.error) {
      setError(pRes.error.message)
      return
    }
    const plantas: PlantillaFormulario[] = ((pRes.data ?? []) as Array<{
      id: number | string
      nombre: string
      descripcion: string | null
      esquema: unknown
      calculo: string | null
    }>).map((p) => ({
      id: String(p.id),
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      esquema: { campos: camposDe(p.esquema) },
      calculo: p.calculo,
    }))
    if (plantas.length) {
      setPlantillas(plantas)
      setPlantillaId((actual) => (plantas.some((p) => p.id === actual) ? actual : plantas[0].id))
    }
    if (!rRes.error && rRes.data) {
      setHistorial(
        (rRes.data as Array<{
          id: number | string
          plantilla_id: number | string
          respuestas: Record<string, unknown>
          resultado: number | null
          enviado_en: string
          formulario_plantilla: { nombre?: string } | { nombre?: string }[] | null
        }>).map((r) => {
          const plantilla = Array.isArray(r.formulario_plantilla) ? r.formulario_plantilla[0] : r.formulario_plantilla
          return {
            id: String(r.id),
            plantillaId: String(r.plantilla_id),
            plantillaNombre: plantilla?.nombre ?? 'Plantilla',
            respuestas: r.respuestas ?? {},
            resultado: r.resultado,
            enviadoEn: r.enviado_en,
          }
        }),
      )
    }
  }, [live])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const plantilla = useMemo(
    () => plantillas.find((p) => p.id === plantillaId) ?? plantillas[0],
    [plantillaId, plantillas],
  )
  const campos = useMemo(() => camposDe(plantilla?.esquema), [plantilla])
  const score = useMemo(
    () => (plantilla?.calculo === 'porcentaje_completado' ? scorePorcentajeCompletado(plantilla.esquema, valores) : null),
    [plantilla, valores],
  )
  const historialPlantilla = useMemo(
    () => (plantilla ? historial.filter((h) => h.plantillaId === plantilla.id) : historial),
    [historial, plantilla],
  )

  function cambiarCampo(clave: string, valor: unknown) {
    setError(null)
    setAviso(null)
    setValores((prev) => {
      const next = { ...prev }
      if (valor === undefined) delete next[clave]
      else next[clave] = valor
      return next
    })
  }

  function elegirPlantilla(id: string) {
    setPlantillaId(id)
    setValores({})
    setError(null)
    setAviso(null)
  }

  async function enviar() {
    if (!plantilla) return
    setError(null)
    setAviso(null)
    const validacion = validarRespuestas(plantilla.esquema, valores)
    if (!validacion.ok) {
      setError(validacion.mensaje)
      return
    }
    setEnviando(true)
    try {
      const guardado = await persistirFormulario({ plantillaId: plantilla.id, respuestas: valores })
      const resultado = guardado.resultado ?? score
      setHistorial((prev) => [
        {
          id: guardado.id,
          plantillaId: plantilla.id,
          plantillaNombre: plantilla.nombre,
          respuestas: { ...valores },
          resultado,
          enviadoEn: guardado.enviadoEn,
        },
        ...prev,
      ])
      setValores({})
      setAviso(
        live
          ? `Formulario enviado. Score ${resultado ?? '—'}.`
          : `Envío demo guardado localmente. Score ${resultado ?? '—'}.`,
      )
    } catch (err) {
      setError(mensajeGc(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand-700">W-05</p>
        <h2 className="font-serif text-3xl">Formularios</h2>
        <p className="text-sm text-slate-600">
          Renderer único desde el esquema de cada plantilla. {plantillas.length} plantillas
          {personas.length ? ` · cartera ${personas.length}` : ''}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {aviso}
        </p>
      )}
      {!live && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Modo demo AgroMoney: plantillas de ficha de cultivo y verificación de garantías. El envío no llega a Supabase.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-2">
          {plantillas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirPlantilla(p.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left ${
                p.id === plantilla?.id
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-[#E4DCC8] bg-white hover:bg-[#F8F4EA]'
              }`}
            >
              <p className="text-sm font-semibold">{p.nombre}</p>
              <p className={`mt-1 text-xs ${p.id === plantilla?.id ? 'text-white/80' : 'text-slate-500'}`}>
                {p.descripcion}
              </p>
            </button>
          ))}
        </aside>

        {plantilla && (
          <section className="rounded-2xl border border-[#E4DCC8] bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-2xl">{plantilla.nombre}</h3>
                <p className="text-sm text-slate-600">{plantilla.descripcion}</p>
              </div>
              {score !== null && (
                <p aria-live="polite" className="rounded-full bg-[#EFE8D8] px-3 py-1 text-sm font-semibold text-brand-800">
                  Score {score}%
                </p>
              )}
            </div>

            <FormularioRenderer campos={campos} valores={valores} onChange={cambiarCampo} disabled={enviando} />

            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {enviando ? 'Enviando…' : 'Enviar formulario'}
            </button>
          </section>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#E4DCC8] bg-white">
        <div className="border-b border-[#E4DCC8] bg-[#EFE8D8] px-4 py-3">
          <h3 className="text-sm font-semibold">Historial de respuestas</h3>
          <p className="text-xs text-slate-600">
            {historialPlantilla.length} envíos de esta plantilla
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Plantilla</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3 hidden md:table-cell">Resumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historialPlantilla.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  Todavía no hay respuestas para esta plantilla.
                </td>
              </tr>
            ) : (
              historialPlantilla.map((h) => (
                <tr key={h.id} className="hover:bg-[#F8F4EA]">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatearFecha(h.enviadoEn)}</td>
                  <td className="px-4 py-3 font-medium">{h.plantillaNombre}</td>
                  <td className="px-4 py-3">{h.resultado != null ? `${h.resultado}%` : '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 truncate max-w-sm">
                    {Object.entries(h.respuestas)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(' · ')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
