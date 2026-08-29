import { useState } from 'react'
import { useDominio } from '../../app/DominioContext'
import { Button, FilterChips, PageHeader, PAGE, Table, THead, Th, Td, TBody, Tr, Badge, toneDeEstado, EmptyState } from '../../components/ui'
import { lineaTiempoVisita } from '../../lib/visitaTimeline'
import type { CalendarEvent } from '../calendar/types'
import { cn } from '../../lib/cn'

const ESTADOS = ['todas', 'programada', 'completada', 'aprobada', 'rechazada', 'anulada'] as const

export function VisitasPage() {
  const { eventos, abrirNuevaVisita } = useDominio()
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]>('todas')
  const [detalle, setDetalle] = useState<CalendarEvent | null>(null)
  const visibles =
    filtro === 'todas' ? eventos : eventos.filter((e) => (e.estado ?? 'programada') === filtro)

  return (
    <div className={PAGE}>
      <PageHeader
        spec="W-03"
        title="Visitas"
        description={`${visibles.length} registros`}
        actions={<Button onClick={() => abrirNuevaVisita()}>Nueva visita</Button>}
      />

      <FilterChips opciones={ESTADOS} valor={filtro} onChange={setFiltro} />

      {visibles.length === 0 ? (
        <EmptyState
          titulo="No hay visitas con este filtro"
          descripcion="Programá la jornada o importá tu cartera para agendar."
          cta={{ etiqueta: 'Nueva visita', onClick: () => abrirNuevaVisita() }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Table>
            <THead>
              <tr>
                <Th>Fecha</Th>
                <Th>Visita</Th>
                <Th className="hidden md:table-cell">Cliente</Th>
                <Th className="hidden lg:table-cell">Lugar</Th>
                <Th>Estado</Th>
              </tr>
            </THead>
            <TBody>
              {visibles.map((v) => (
                <Tr
                  key={v.id}
                  className={cn('cursor-pointer', detalle?.id === v.id && 'bg-canvas')}
                  onClick={() => setDetalle(v)}
                >
                  <Td className="whitespace-nowrap text-muted">
                    {v.date}
                    <span className="block text-[11px]">{v.startTime}</span>
                  </Td>
                  <Td className="font-medium">{v.title}</Td>
                  <Td className="hidden md:table-cell text-muted">{v.personaName ?? '—'}</Td>
                  <Td className="hidden lg:table-cell text-muted truncate max-w-xs">{v.location ?? '—'}</Td>
                  <Td>
                    <Badge tone={toneDeEstado(v.estado)}>{v.estado ?? 'programada'}</Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <aside className="rounded-2xl border border-line bg-surface p-5 h-fit">
            {detalle ? (
              <>
                <h3 className="font-serif text-xl">{detalle.title}</h3>
                <p className="mt-1 text-sm text-muted">
                  {detalle.personaName ?? 'Sin cliente'} · {detalle.date} {detalle.startTime}
                </p>
                {detalle.location ? <p className="mt-1 text-sm text-muted">{detalle.location}</p> : null}
                {detalle.notes ? <p className="mt-3 text-sm">{detalle.notes}</p> : null}
                {detalle.checkinGps ? (
                  <p className="mt-2 text-xs text-muted">
                    Check-in GPS {detalle.checkinGps.lat.toFixed(4)}, {detalle.checkinGps.lng.toFixed(4)}
                  </p>
                ) : null}
                <ol className="mt-4 space-y-2">
                  {lineaTiempoVisita(detalle.estado).map((paso) => (
                    <li key={paso.clave} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          paso.fase === 'hecho' && 'bg-emerald-600',
                          paso.fase === 'actual' && 'bg-primary',
                          paso.fase === 'pendiente' && 'bg-line',
                        )}
                      />
                      <span className={paso.fase === 'pendiente' ? 'text-muted' : 'font-medium'}>{paso.etiqueta}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-sm text-muted">Elegí una visita para ver el detalle y la línea de tiempo.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
