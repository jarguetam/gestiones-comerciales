import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDominio } from '../../app/DominioContext'
import { camposDe, scorePorcentajeCompletado, validarRespuestas } from '../../lib/formulario'
import { mensajeGc, persistirFormulario } from '../../lib/persistir'
import { supabase } from '../../lib/supabase'
import { Alert, Button, PageHeader, PAGE, Table, TBody, Td, Th, THead, Tr } from '../../components/ui'
import { FormularioRenderer } from './FormularioRenderer'
import { type PlantillaFormulario, type RespuestaFormulario } from './plantillasDemo'

function formatearFecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

export function FormulariosPage() {
  const { fuente, personas } = useDominio()
  const live = fuente === 'supabase'
  const [plantillas, setPlantillas] = useState<PlantillaFormulario[]>([])
  const [historial, setHistorial] = useState<RespuestaFormulario[]>([])
  const [plantillaId, setPlantillaId] = useState<string>('')
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
    <div className={PAGE}>
      <PageHeader
        spec="W-05"
        title="Formularios"
        description={`Renderer único desde el esquema de cada plantilla. ${plantillas.length} plantillas${personas.length ? ` · cartera ${personas.length}` : ''}`}
      />

      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}
      {aviso && <Alert tone="success">{aviso}</Alert>}
      {!live && (
        <Alert tone="warning">
          Modo demo AgroMoney: plantillas de ficha de cultivo y verificación de garantías. El envío no llega a Supabase.
        </Alert>
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
                  ? 'border-primary bg-primary text-white'
                  : 'border-line bg-surface hover:bg-canvas'
              }`}
            >
              <p className="text-sm font-semibold">{p.nombre}</p>
              <p className={`mt-1 text-xs ${p.id === plantilla?.id ? 'text-white/80' : 'text-muted'}`}>
                {p.descripcion}
              </p>
            </button>
          ))}
        </aside>

        {plantilla && (
          <section className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{plantilla.nombre}</h3>
                <p className="text-sm text-muted">{plantilla.descripcion}</p>
              </div>
              {score !== null && (
                <p aria-live="polite" className="rounded-full bg-[var(--gc-thead)] px-3 py-1 text-sm font-semibold text-primary">
                  Score {score}%
                </p>
              )}
            </div>

            <FormularioRenderer campos={campos} valores={valores} onChange={cambiarCampo} disabled={enviando} />

            <Button onClick={() => void enviar()} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar formulario'}
            </Button>
          </section>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line bg-[var(--gc-thead)] px-4 py-3">
          <h3 className="text-sm font-semibold">Historial de respuestas</h3>
          <p className="text-xs text-muted">{historialPlantilla.length} envíos de esta plantilla</p>
        </div>
        <Table>
          <THead>
            <tr>
              <Th>Fecha</Th>
              <Th>Plantilla</Th>
              <Th>Score</Th>
              <Th className="hidden md:table-cell">Resumen</Th>
            </tr>
          </THead>
          <TBody>
            {historialPlantilla.length === 0 ? (
              <Tr>
                <Td colSpan={4} className="text-muted">
                  Todavía no hay respuestas para esta plantilla.
                </Td>
              </Tr>
            ) : (
              historialPlantilla.map((h) => (
                <Tr key={h.id}>
                  <Td className="whitespace-nowrap text-muted">{formatearFecha(h.enviadoEn)}</Td>
                  <Td className="font-medium">{h.plantillaNombre}</Td>
                  <Td>{h.resultado != null ? `${h.resultado}%` : '—'}</Td>
                  <Td className="hidden md:table-cell text-muted truncate max-w-sm">
                    {Object.entries(h.respuestas)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(' · ')}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </section>
    </div>
  )
}
