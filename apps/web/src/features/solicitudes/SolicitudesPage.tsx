import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { quetzales } from '../../lib/formato'
import { contextoOperacion, mensajeGc } from '../../lib/persistir'
import { etiquetaVocab } from '../../lib/vocabulario'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  FilterChips,
  PageHeader,
  PAGE,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  toneDeEstado,
} from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { FirmaCanvas } from './FirmaCanvas'

const ESTADOS = ['todas', 'borrador', 'enviada', 'firmada', 'aprobada', 'rechazada'] as const

interface SolicitudDemo {
  id: string
  persona: string
  estado: string
  monto: number
  descripcion: string
  fecha: string
  pdf?: string
  firmaPng?: string
  adjuntos: string[]
}

export function SolicitudesPage() {
  const { fuente, personas, branding } = useDominio()
  const { push } = useToast()
  const live = fuente === 'supabase'
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]>('todas')
  const [items, setItems] = useState<SolicitudDemo[]>([])
  const [detalle, setDetalle] = useState<SolicitudDemo | null>(null)
  const [firma, setFirma] = useState<string | null>(null)
  const [avisoPdf, setAvisoPdf] = useState<string | null>(null)
  const [enviandoPdf, setEnviandoPdf] = useState(false)

  useEffect(() => {
    if (!live) return
    void supabase
      .from('solicitud')
      .select('id, descripcion, monto, creado_en, persona(nombre), solicitud_estado(codigo), solicitud_firma(pdf_ruta, firma_ruta), solicitud_archivo(ruta)')
      .order('creado_en', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) return
        setItems(
          data.map((s) => {
            const persona = s.persona as { nombre?: string } | { nombre?: string }[] | null
            const estado = s.solicitud_estado as { codigo?: string } | { codigo?: string }[] | null
            const firmaRow = s.solicitud_firma as { pdf_ruta?: string; firma_ruta?: string } | { pdf_ruta?: string; firma_ruta?: string }[] | null
            const archivos = s.solicitud_archivo as { ruta?: string }[] | null
            const p = Array.isArray(persona) ? persona[0] : persona
            const e = Array.isArray(estado) ? estado[0] : estado
            const f = Array.isArray(firmaRow) ? firmaRow[0] : firmaRow
            return {
              id: String(s.id),
              persona: p?.nombre ?? '—',
              estado: e?.codigo ?? 'borrador',
              monto: Number(s.monto ?? 0),
              descripcion: String(s.descripcion),
              fecha: String(s.creado_en).slice(0, 10),
              pdf: f?.pdf_ruta,
              adjuntos: (archivos ?? []).map((a) => String(a.ruta ?? '')).filter(Boolean),
            }
          }),
        )
      })
  }, [live])

  const visibles = useMemo(
    () => (filtro === 'todas' ? items : items.filter((s) => s.estado === filtro)),
    [filtro, items],
  )

  async function firmarYPdf() {
    if (!detalle || !firma) return
    setAvisoPdf(null)
    setEnviandoPdf(true)
    try {
      setItems((prev) => prev.map((s) => (s.id === detalle.id ? { ...s, firmaPng: firma } : s)))
      setDetalle((d) => (d ? { ...d, firmaPng: firma } : d))
      const { data, error } = await supabase.functions.invoke('pdf-solicitud', {
        body: { solicitud_id: Number(detalle.id), firma_base64: firma },
      })
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status
        const msg =
          status === 404
            ? 'La función pdf-solicitud no está desplegada (404). La firma quedó persistida.'
            : mensajeGc(error)
        setAvisoPdf(msg)
        push({ tone: 'error', titulo: msg })
        return
      }
      const pdf = (data as { pdf_ruta?: string } | null)?.pdf_ruta
      setAvisoPdf(pdf ? `PDF generado: ${pdf}` : 'Firma enviada.')
      push({ tone: 'success', titulo: 'PDF de solicitud listo' })
    } catch (e) {
      const msg = mensajeGc(e)
      setAvisoPdf(msg)
      push({ tone: 'error', titulo: msg })
    } finally {
      setEnviandoPdf(false)
    }
  }

  async function adjuntar(file: File) {
    if (!detalle) return
    try {
      const { tenantId } = await contextoOperacion()
      const path = `${tenantId}/solicitudes/${detalle.id}/${file.name}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { error } = await supabase.from('solicitud_archivo').insert({ solicitud_id: Number(detalle.id), ruta: path })
      if (error) throw error
      setDetalle((d) => (d ? { ...d, adjuntos: [...d.adjuntos, path] } : d))
      push({ tone: 'success', titulo: 'Adjunto subido' })
    } catch (e) {
      push({ tone: 'error', titulo: mensajeGc(e) })
    }
  }

  return (
    <div className={PAGE}>
      <PageHeader
        spec="W-06"
        title={etiquetaVocab(branding, 'solicitud', 'Solicitudes')}
        description={`Bandeja por estado del flujo. ${visibles.length} registros${personas.length ? ` · cartera ${personas.length}` : ''}`}
      />
      <FilterChips opciones={ESTADOS} valor={filtro} onChange={setFiltro} />
      {visibles.length === 0 ? (
        <EmptyState titulo="No hay solicitudes" descripcion="Cuando el módulo esté activo, las solicitudes del flujo aparecen aquí." />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Fecha</Th>
              <Th>Persona</Th>
              <Th className="hidden md:table-cell">Descripción</Th>
              <Th>Monto</Th>
              <Th>Estado</Th>
            </tr>
          </THead>
          <TBody>
            {visibles.map((s) => (
              <Tr key={s.id} className="cursor-pointer" onClick={() => { setDetalle(s); setFirma(s.firmaPng ?? null); setAvisoPdf(null) }}>
                <Td className="text-muted whitespace-nowrap">{s.fecha}</Td>
                <Td className="font-medium">{s.persona}</Td>
                <Td className="hidden md:table-cell text-muted">{s.descripcion}</Td>
                <Td>{quetzales(s.monto)}</Td>
                <Td>
                  <Badge tone={toneDeEstado(s.estado)}>{s.estado}</Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      {detalle && (
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
          <div className="flex justify-between gap-3">
            <h3 className="font-display text-xl tracking-tight">{detalle.persona}</h3>
            <Button variant="ghost" size="sm" onClick={() => setDetalle(null)}>
              Cerrar
            </Button>
          </div>
          <p className="text-sm text-muted">{detalle.descripcion}</p>
          <p className="text-sm">
            Monto {quetzales(detalle.monto)} · estado <strong className="capitalize">{detalle.estado}</strong>
          </p>
          {detalle.adjuntos.length > 0 && (
            <ul className="text-xs text-muted list-disc pl-4">
              {detalle.adjuntos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <div>
            <label htmlFor="adjunto-solicitud" className="block text-sm font-medium text-ink">
              Adjunto
            </label>
            <input
              id="adjunto-solicitud"
              type="file"
              className="mt-1 text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void adjuntar(f)
              }}
            />
          </div>
          <FirmaCanvas onChange={setFirma} disabled={enviandoPdf} />
          <Button onClick={() => void firmarYPdf()} disabled={!firma || enviandoPdf}>
            {enviandoPdf ? 'Generando PDF…' : 'Guardar firma y generar PDF'}
          </Button>
          {avisoPdf && <Alert tone={avisoPdf.includes('404') || avisoPdf.startsWith('GC-') ? 'warning' : 'success'}>{avisoPdf}</Alert>}
          {detalle.pdf ? <p className="text-xs text-muted">PDF {detalle.pdf}</p> : null}
        </div>
      )}
    </div>
  )
}
