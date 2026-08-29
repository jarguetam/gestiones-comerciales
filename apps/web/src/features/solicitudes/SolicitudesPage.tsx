import { useEffect, useMemo, useState } from 'react'
import { DEMO_MODE, supabase } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { quetzales } from '../../lib/formato'
import {
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

const ESTADOS = ['todas', 'borrador', 'enviada', 'firmada', 'aprobada', 'rechazada'] as const

interface SolicitudDemo {
  id: string
  persona: string
  estado: string
  monto: number
  descripcion: string
  fecha: string
  pdf?: string
}

const DEMO: SolicitudDemo[] = [
  { id: 's1', persona: 'Finca El Roble', estado: 'enviada', monto: 25000, descripcion: 'Crédito avío ciclo 2026', fecha: '2026-08-20' },
  { id: 's2', persona: 'Cooperativa La Esperanza', estado: 'firmada', monto: 48000, descripcion: 'Renovación de línea', fecha: '2026-08-18', pdf: 'documentos/demo/s2.pdf' },
  { id: 's3', persona: 'Agropecuaria Sur', estado: 'borrador', monto: 12000, descripcion: 'Capital de trabajo', fecha: '2026-08-25' },
  { id: 's4', persona: 'Distribuidora Norte', estado: 'aprobada', monto: 80000, descripcion: 'Ampliación de cupo', fecha: '2026-08-10', pdf: 'documentos/demo/s4.pdf' },
]

export function SolicitudesPage() {
  const { fuente, personas } = useDominio()
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]>('todas')
  const [items, setItems] = useState<SolicitudDemo[]>(DEMO)
  const [detalle, setDetalle] = useState<SolicitudDemo | null>(null)

  useEffect(() => {
    if (DEMO_MODE || fuente === 'demo') return
    void supabase
      .from('solicitud')
      .select('id, descripcion, monto, creado_en, persona(nombre), solicitud_estado(codigo), solicitud_firma(pdf_ruta)')
      .order('creado_en', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) return
        setItems(
          data.map((s) => {
            const persona = s.persona as { nombre?: string } | { nombre?: string }[] | null
            const estado = s.solicitud_estado as { codigo?: string } | { codigo?: string }[] | null
            const firma = s.solicitud_firma as { pdf_ruta?: string } | { pdf_ruta?: string }[] | null
            const p = Array.isArray(persona) ? persona[0] : persona
            const e = Array.isArray(estado) ? estado[0] : estado
            const f = Array.isArray(firma) ? firma[0] : firma
            return {
              id: String(s.id),
              persona: p?.nombre ?? '—',
              estado: e?.codigo ?? 'borrador',
              monto: Number(s.monto ?? 0),
              descripcion: String(s.descripcion),
              fecha: String(s.creado_en).slice(0, 10),
              pdf: f?.pdf_ruta,
            }
          }),
        )
      })
  }, [fuente])

  const visibles = useMemo(
    () => (filtro === 'todas' ? items : items.filter((s) => s.estado === filtro)),
    [filtro, items],
  )

  return (
    <div className={PAGE}>
      <PageHeader
        spec="W-06"
        title="Solicitudes"
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
              <Tr key={s.id} className="cursor-pointer" onClick={() => setDetalle(s)}>
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
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex justify-between gap-3">
            <h3 className="font-serif text-xl">{detalle.persona}</h3>
            <Button variant="ghost" size="sm" onClick={() => setDetalle(null)}>
              Cerrar
            </Button>
          </div>
          <p className="text-sm text-muted mt-1">{detalle.descripcion}</p>
          <p className="mt-2 text-sm">
            Monto {quetzales(detalle.monto)} · estado <strong className="capitalize">{detalle.estado}</strong>
          </p>
          <p className="mt-3 text-xs text-muted">
            Archivos y firma: {detalle.pdf ? `PDF ${detalle.pdf}` : 'sin PDF todavía. La firma (PNG) dispara pdf-solicitud.'}
          </p>
        </div>
      )}
    </div>
  )
}
