import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDominio } from '../../app/DominioContext'
import {
  Button,
  EmptyState,
  FilterChips,
  Input,
  PageHeader,
  PAGE,
  Select,
  Table,
  THead,
  Th,
  Td,
  TBody,
  Tr,
  Badge,
  toneDeEstado,
  TableSkeleton,
} from '../../components/ui'
import { lineaTiempoVisita } from '../../lib/visitaTimeline'
import {
  ESTADOS_VISITA,
  filtrarVisitas,
  paginar,
  parseFiltrosVisita,
  serializarFiltrosVisita,
  PAGE_SIZE_VISITAS,
  type FiltrosVisita,
} from '../../lib/visitasFiltro'
import { fetchVisitasPaginadas } from '../../lib/visitasApi'
import { QK } from '../../lib/queryClient'
import { DEMO_MODE } from '../../lib/supabase'
import { etiquetaVocab } from '../../lib/vocabulario'
import type { CalendarEvent } from '../calendar/types'
import { cn } from '../../lib/cn'

export function VisitasPage() {
  const { eventos, abrirNuevaVisita, fuente, asesores, zonas, branding } = useDominio()
  const live = !DEMO_MODE && fuente === 'supabase'
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => parseFiltrosVisita(params), [params])
  const titulo = etiquetaVocab(branding, 'visita', 'Visitas')

  const demoFiltradas = useMemo(() => filtrarVisitas(eventos, filtros), [eventos, filtros])
  const demoPagina = useMemo(() => paginar(demoFiltradas, filtros.pagina), [demoFiltradas, filtros.pagina])

  const q = useQuery({
    queryKey: QK.visitas(filtros),
    queryFn: () => fetchVisitasPaginadas(filtros),
    enabled: live,
  })

  const items: CalendarEvent[] = live ? (q.data?.items ?? []) : demoPagina.slice
  const total = live ? (q.data?.total ?? 0) : demoPagina.total
  const paginas = live
    ? Math.max(1, Math.ceil(total / PAGE_SIZE_VISITAS))
    : demoPagina.paginas
  const detalleId = params.get('id')
  const detalle = items.find((v) => v.id === detalleId) ?? items[0] ?? null

  function setFiltros(next: Partial<FiltrosVisita>) {
    const merged = { ...filtros, ...next, pagina: next.pagina ?? 1 }
    if (next.pagina != null) merged.pagina = next.pagina
    const qn = serializarFiltrosVisita(merged)
    if (detalleId) qn.set('id', detalleId)
    setParams(qn, { replace: true })
  }

  return (
    <div className={PAGE}>
      <PageHeader
        spec="W-03"
        title={titulo}
        description={`${total} registros`}
        actions={<Button onClick={() => abrirNuevaVisita()}>Nueva visita</Button>}
      />

      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2 lg:grid-cols-4">
        <Select
          id="filtro-estado"
          label="Estado"
          value={filtros.estado}
          onChange={(e) => setFiltros({ estado: e.target.value as FiltrosVisita['estado'] })}
        >
          {ESTADOS_VISITA.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Select
          id="filtro-asesor"
          label="Asesor"
          value={filtros.asesor}
          onChange={(e) => setFiltros({ asesor: e.target.value })}
        >
          <option value="">Todos</option>
          {asesores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Select>
        <Select
          id="filtro-zona"
          label="Zona"
          value={filtros.zona}
          onChange={(e) => setFiltros({ zona: e.target.value })}
        >
          <option value="">Todas</option>
          {zonas.map((z) => (
            <option key={z.id} value={String(z.id)}>
              {z.nombre}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="filtro-desde"
            label="Desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros({ desde: e.target.value })}
          />
          <Input
            id="filtro-hasta"
            label="Hasta"
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros({ hasta: e.target.value })}
          />
        </div>
      </div>

      <FilterChips
        opciones={ESTADOS_VISITA}
        valor={filtros.estado}
        onChange={(estado) => setFiltros({ estado })}
      />

      {live && q.isLoading ? (
        <TableSkeleton cols={5} />
      ) : items.length === 0 ? (
        <EmptyState
          titulo="No hay visitas con este filtro"
          descripcion="Programá la jornada o importá tu cartera para agendar."
          cta={{ etiqueta: 'Nueva visita', onClick: () => abrirNuevaVisita() }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div>
            <Table>
              <THead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Visita</Th>
                  <Th className="hidden md:table-cell">Cliente</Th>
                  <Th className="hidden lg:table-cell">Asesor</Th>
                  <Th>Estado</Th>
                </tr>
              </THead>
              <TBody>
                {items.map((v) => (
                  <Tr
                    key={v.id}
                    className={cn('cursor-pointer', detalle?.id === v.id && 'bg-canvas')}
                    onClick={() => {
                      const qn = serializarFiltrosVisita(filtros)
                      qn.set('id', v.id)
                      setParams(qn, { replace: true })
                    }}
                  >
                    <Td className="whitespace-nowrap text-muted">
                      {v.date}
                      <span className="block text-[11px]">{v.startTime}</span>
                    </Td>
                    <Td className="font-medium">{v.title}</Td>
                    <Td className="hidden md:table-cell text-muted">{v.personaName ?? '—'}</Td>
                    <Td className="hidden lg:table-cell text-muted">{v.asesorNombre ?? '—'}</Td>
                    <Td>
                      <Badge tone={toneDeEstado(v.estado)}>{v.estado ?? 'programada'}</Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>
                Página {filtros.pagina} de {paginas}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filtros.pagina <= 1}
                  onClick={() => setFiltros({ pagina: filtros.pagina - 1 })}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filtros.pagina >= paginas}
                  onClick={() => setFiltros({ pagina: filtros.pagina + 1 })}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-line bg-surface p-5 h-fit">
            {detalle ? (
              <>
                <h3 className="font-serif text-xl">{detalle.title}</h3>
                <p className="mt-1 text-sm text-muted">
                  {detalle.personaName ?? 'Sin cliente'} · {detalle.date} {detalle.startTime}
                </p>
                {detalle.asesorNombre ? <p className="mt-1 text-sm text-muted">Asesor {detalle.asesorNombre}</p> : null}
                {detalle.zonaNombre ? <p className="mt-1 text-sm text-muted">{detalle.zonaNombre}</p> : null}
                {detalle.location ? <p className="mt-1 text-sm text-muted">{detalle.location}</p> : null}
                {detalle.notes ? <p className="mt-3 text-sm">{detalle.notes}</p> : null}
                <ol className="mt-4 space-y-2">
                  {lineaTiempoVisita(detalle.estado, {
                    creadoEn: detalle.creadoEn,
                    completadaEn: detalle.completadaEn,
                    revisadaEn: detalle.revisadaEn,
                    latitud: detalle.latitud ?? detalle.checkinGps?.lat,
                    longitud: detalle.longitud ?? detalle.checkinGps?.lng,
                  }).map((paso) => (
                    <li key={paso.clave} className="flex items-start gap-2 text-sm">
                      <span
                        className={cn(
                          'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                          paso.fase === 'hecho' && 'bg-primary',
                          paso.fase === 'actual' && 'bg-primary',
                          paso.fase === 'pendiente' && 'bg-line',
                        )}
                      />
                      <span>
                        <span className={paso.fase === 'pendiente' ? 'text-muted' : 'font-medium'}>{paso.etiqueta}</span>
                        {paso.cuando ? (
                          <span className="block text-[11px] text-muted">{new Date(paso.cuando).toLocaleString()}</span>
                        ) : null}
                        {paso.detalle ? (
                          <span className="block text-[11px] text-muted">GPS {paso.detalle}</span>
                        ) : null}
                      </span>
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
