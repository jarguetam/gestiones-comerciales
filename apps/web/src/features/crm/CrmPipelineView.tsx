/**
 * W-15/16/17 — Pipeline CRM desktop: kanban de ancho completo + ficha lateral.
 * Transiciones live vía lead_transicion; DnD HTML5 con revert GC-CRM-*.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  INITIAL_LEADS,
  LEAD_ESTADOS,
  LEAD_ORIGENES,
  nextLeadId,
  type LeadItem,
} from '../calendar/leadsData'
import { Badge, Button, Dialog, EmptyState, FilterChips, Input, PageHeader } from '../../components/ui'
import { quetzales } from '../../lib/formato'
import { cn } from '../../lib/cn'
import { useToast } from '../../components/ui/Toast'
import { mensajeToast } from '../../lib/erroresUi'
import { DEMO_MODE } from '../../lib/supabase'
import { useDominio } from '../../app/DominioContext'
import { QK } from '../../lib/queryClient'
import { fetchCrmFunnel, fetchLeadActividad, transicionarLead } from './crmApi'

interface CrmPipelineViewProps {
  onOpenNewEvent: () => void
  onConvertLead?: (lead: LeadItem) => void
  leads?: LeadItem[]
  onChangeLeads?: (leads: LeadItem[]) => void
}

type Vista = 'kanban' | 'embudo'

export function CrmPipelineView({
  onOpenNewEvent,
  onConvertLead,
  leads: leadsProp,
  onChangeLeads,
}: CrmPipelineViewProps) {
  const { push } = useToast()
  const { fuente } = useDominio()
  const live = !DEMO_MODE && fuente === 'supabase'
  const [leadsInternos, setLeadsInternos] = useState<LeadItem[]>(INITIAL_LEADS)
  const leads = leadsProp ?? leadsInternos
  const setLeads = (next: LeadItem[]) => {
    if (onChangeLeads) onChangeLeads(next)
    else setLeadsInternos(next)
  }

  const [vista, setVista] = useState<Vista>('kanban')
  const [seleccionado, setSeleccionado] = useState<LeadItem | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [nNombre, setNNombre] = useState('')
  const [nTelefono, setNTelefono] = useState('')
  const [nOrigen, setNOrigen] = useState<(typeof LEAD_ORIGENES)[number]>(LEAD_ORIGENES[0])
  const [nMonto, setNMonto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const porEstado = useMemo(() => {
    const mapa: Record<string, LeadItem[]> = {}
    for (const e of LEAD_ESTADOS) mapa[e.codigo] = []
    for (const l of leads) mapa[l.estadoCodigo]?.push(l)
    return mapa
  }, [leads])

  const funnelQ = useQuery({
    queryKey: QK.crmFunnel,
    queryFn: fetchCrmFunnel,
    enabled: live && vista === 'embudo',
  })

  const embudo = useMemo(() => {
    if (funnelQ.data && funnelQ.data.length > 0) {
      return funnelQ.data.map((e) => ({
        codigo: e.estado_codigo,
        nombre: e.estado_nombre,
        esGanado: e.es_ganado,
        esPerdido: e.es_perdido,
        leads: e.leads,
        monto: e.monto_estimado,
      }))
    }
    return LEAD_ESTADOS.map((e) => {
      const del = leads.filter((l) => l.estadoCodigo === e.codigo)
      return {
        ...e,
        leads: del.length,
        monto: del.reduce((a, l) => a + (l.montoEstimado ?? 0), 0),
      }
    })
  }, [funnelQ.data, leads])
  const maxEmbudo = Math.max(1, ...embudo.map((e) => e.leads))

  async function moverLead(lead: LeadItem, destinoCodigo: string, motivoPerdida?: string) {
    const destino = LEAD_ESTADOS.find((e) => e.codigo === destinoCodigo)
    if (!destino) return
    const origen = LEAD_ESTADOS.find((e) => e.codigo === lead.estadoCodigo)
    const orden = (c: string) => LEAD_ESTADOS.findIndex((e) => e.codigo === c)

    if (destino.esPerdido && !motivoPerdida?.trim()) {
      setSeleccionado(lead)
      setMotivo('')
      push({ tone: 'error', titulo: 'Motivo de pérdida requerido', descripcion: 'GC-CRM-002' })
      return
    }
    if (
      origen &&
      orden(destinoCodigo) < orden(lead.estadoCodigo) &&
      !destino.esGanado &&
      !destino.esPerdido
    ) {
      push({ tone: 'error', titulo: 'Retroceder en el embudo requiere rol supervisor o superior', descripcion: 'GC-CRM-001' })
      return
    }
    if (lead.convertido && orden(destinoCodigo) < orden(lead.estadoCodigo)) {
      push({ tone: 'error', titulo: 'Un lead convertido no puede volver a estados previos', descripcion: 'GC-CRM-004' })
      return
    }

    const convertido = destino.esGanado ? true : lead.convertido
    const actualizado: LeadItem = {
      ...lead,
      estadoCodigo: destinoCodigo,
      perdidoMotivo: destino.esPerdido ? motivoPerdida : lead.perdidoMotivo,
      convertido,
    }
    const prev = leads
    setLeads(leads.map((l) => (l.id === lead.id ? actualizado : l)))
    setSeleccionado(actualizado)
    setMotivo('')

    if (live) {
      try {
        await transicionarLead(lead.id, destinoCodigo, motivoPerdida)
      } catch (e) {
        setLeads(prev)
        setSeleccionado(lead)
        const t = mensajeToast(e)
        push({ tone: 'error', titulo: t.titulo, descripcion: t.descripcion })
        return
      }
    }
    if (destino.esGanado && !lead.convertido && onConvertLead) onConvertLead(actualizado)
    push({ tone: 'success', titulo: `Lead movido a ${destino.nombre}` })
  }

  function onDropColumna(codigo: string, ev: React.DragEvent) {
    ev.preventDefault()
    const id = ev.dataTransfer.getData('text/lead-id')
    const lead = leads.find((l) => l.id === id)
    if (lead && lead.estadoCodigo !== codigo) void moverLead(lead, codigo, codigo === 'perdido' ? motivo : undefined)
  }

  function guardarLead() {
    setError(null)
    if (!nNombre.trim()) return setError('El nombre es requerido')
    if (!nTelefono.trim()) return setError('El teléfono es requerido (dedupe GC)')
    const dup = leads.find(
      (l) => !l.convertido && l.telefono.replace(/\s/g, '') === nTelefono.replace(/\s/g, ''),
    )
    if (dup) return setError(`GC-CRM: ya existe el lead "${dup.nombre}" con ese teléfono`)
    const nuevo: LeadItem = {
      id: nextLeadId(leads),
      nombre: nNombre.trim(),
      telefono: nTelefono.trim(),
      origen: nOrigen,
      montoEstimado: nMonto ? Number(nMonto) : undefined,
      estadoCodigo: 'nuevo',
    }
    setLeads([nuevo, ...leads])
    setNNombre('')
    setNTelefono('')
    setNMonto('')
    setNOrigen(LEAD_ORIGENES[0])
    setMostrarNuevo(false)
    push({ tone: 'success', titulo: 'Lead creado' })
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4" data-spec="W-15">
      <PageHeader
        spec="W-15"
        title="Pipeline CRM"
        description={`${leads.length} leads`}
        actions={
          <>
            <FilterChips
              opciones={['kanban', 'embudo'] as const}
              valor={vista}
              onChange={setVista}
              etiquetas={{ kanban: 'Kanban', embudo: 'Embudo' }}
            />
            <Button onClick={() => setMostrarNuevo(true)}>Nuevo lead</Button>
          </>
        }
      />

      {vista === 'kanban' && (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex-1 overflow-x-auto">
            <div className="flex h-full min-w-max gap-3 pb-2">
              {LEAD_ESTADOS.map((estado) => (
                <div
                  key={estado.codigo}
                  className="flex w-64 flex-col rounded-2xl border border-line bg-surface"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropColumna(estado.codigo, e)}
                >
                  <div
                    className={cn(
                      'flex justify-between rounded-t-2xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide',
                      estado.esGanado && 'bg-primary/10 text-primary',
                      estado.esPerdido && 'bg-canvas text-muted',
                      !estado.esGanado && !estado.esPerdido && 'bg-[var(--gc-thead)] text-muted',
                    )}
                  >
                    <span>{estado.nombre}</span>
                    <span>{porEstado[estado.codigo]?.length ?? 0}</span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    {(porEstado[estado.codigo] ?? []).map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/lead-id', lead.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onClick={() => setSeleccionado(lead)}
                        className={cn(
                          'rail w-full rounded-xl border border-line bg-surface p-3 text-left transition-colors duration-campo hover:bg-canvas',
                          seleccionado?.id === lead.id && 'border-primary',
                        )}
                      >
                        <p className="text-sm font-semibold leading-tight">{lead.nombre}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{lead.telefono}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <Badge tone="primary">{lead.origen}</Badge>
                          {lead.montoEstimado != null && (
                            <span className="text-[11px] font-semibold">{quetzales(lead.montoEstimado)}</span>
                          )}
                        </div>
                        {lead.convertido && (
                          <span className="mt-1 inline-block text-[10px] font-semibold text-primary">→ cliente</span>
                        )}
                      </button>
                    ))}
                    {(porEstado[estado.codigo] ?? []).length === 0 && (
                      <p className="py-6 text-center text-[11px] text-muted">Sin leads</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="hidden w-80 shrink-0 overflow-y-auto rounded-2xl border border-line bg-surface p-5 lg:block" data-spec="W-16">
            {seleccionado ? (
              <FichaLead
                lead={seleccionado}
                live={live}
                motivo={motivo}
                onMotivo={setMotivo}
                onMover={(l, c, m) => void moverLead(l, c, m)}
                onAgendar={() => {
                  onOpenNewEvent()
                }}
              />
            ) : (
              <p className="text-sm text-muted">Elegí un lead para ver la ficha, mover etapa o agendar visita.</p>
            )}
          </aside>
        </div>
      )}

      {vista === 'embudo' && (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5" data-spec="W-17">
          {live && funnelQ.data === null && (
            <p className="text-xs text-muted">
              rpc crm_funnel() no respondió; el embudo se calcula en el cliente.
            </p>
          )}
          {embudo.map((e) => (
            <div key={e.codigo}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-semibold">{e.nombre}</span>
                <span className="text-muted">
                  {e.leads} · {e.monto ? quetzales(e.monto) : '—'}
                </span>
              </div>
              <div className="h-6 overflow-hidden rounded-lg bg-canvas">
                <div
                  className="h-full rounded-lg bg-primary"
                  style={{ width: `${(e.leads / maxEmbudo) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {leads.length === 0 && (
        <EmptyState
          titulo="Todavía no hay leads"
          descripcion="Cargá el primer prospecto para armar el embudo."
          cta={{ etiqueta: 'Nuevo lead', onClick: () => setMostrarNuevo(true) }}
        />
      )}

      {mostrarNuevo && (
        <Dialog title="Nuevo lead" onClose={() => setMostrarNuevo(false)}>
          <div className="space-y-3 p-5">
            <Input id="lead-nombre" label="Nombre *" value={nNombre} onChange={(e) => setNNombre(e.target.value)} />
            <Input id="lead-tel" label="Teléfono *" value={nTelefono} onChange={(e) => setNTelefono(e.target.value)} />
            <Input
              id="lead-monto"
              label="Monto estimado (Q)"
              inputMode="numeric"
              value={nMonto}
              onChange={(e) => setNMonto(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <FilterChips opciones={LEAD_ORIGENES} valor={nOrigen} onChange={setNOrigen} />
            {error && <p className="text-sm text-muted" role="alert">{error}</p>}
            <Button size="lg" onClick={guardarLead}>
              Guardar lead
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

function FichaLead({
  lead,
  live,
  motivo,
  onMotivo,
  onMover,
  onAgendar,
}: {
  lead: LeadItem
  live: boolean
  motivo: string
  onMotivo: (v: string) => void
  onMover: (lead: LeadItem, codigo: string, motivo?: string) => void
  onAgendar: () => void
}) {
  const actQ = useQuery({
    queryKey: QK.leadActividad(lead.id),
    queryFn: () => fetchLeadActividad(lead.id),
    enabled: live,
  })

  return (
    <div>
      <h2 className="font-display text-xl tracking-tight">{lead.nombre}</h2>
      <p className="mt-0.5 text-xs text-muted">
        {lead.telefono}
        {lead.documento ? ` · ${lead.documento}` : ''}
      </p>
      {lead.direccion && <p className="text-xs text-muted">{lead.direccion}</p>}
      <div className="mt-2 flex gap-2">
        <Badge tone="primary">{lead.origen}</Badge>
        {lead.montoEstimado != null && <Badge>{quetzales(lead.montoEstimado)}</Badge>}
      </div>
      {lead.perdidoMotivo && (
        <p className="mt-2 rounded-lg bg-canvas p-2 text-xs text-muted">Perdido: {lead.perdidoMotivo}</p>
      )}
      {lead.convertido && (
        <p className="mt-2 rounded-lg bg-primary/10 p-2 text-xs text-primary">Convertido a cliente</p>
      )}
      <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Timeline</p>
      {live && (actQ.data?.length ?? 0) > 0 ? (
        <ol className="mb-3 space-y-1.5 text-xs">
          {actQ.data!.map((a) => (
            <li key={a.id} className="border-l-2 border-line pl-2">
              <span className="font-medium capitalize">{a.tipo}</span>
              {a.descripcion ? <span className="text-muted"> · {a.descripcion}</span> : null}
              <span className="block text-muted">{new Date(a.creado_en).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-3 text-xs text-muted">
          Estado actual: {lead.estadoCodigo}. Sin filas en lead_actividad{live ? '' : ' (demo)'}.
        </p>
      )}
      <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Mover a</p>
      <div className="flex flex-wrap gap-2">
        {LEAD_ESTADOS.filter((e) => e.codigo !== lead.estadoCodigo).map((e) => (
          <button
            key={e.codigo}
            type="button"
            onClick={() => onMover(lead, e.codigo, e.esPerdido ? motivo : undefined)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-semibold',
              e.esGanado && 'border-primary bg-primary/10 text-primary',
              e.esPerdido && 'border-line bg-canvas text-muted',
              !e.esGanado && !e.esPerdido && 'border-line bg-canvas text-muted',
            )}
          >
            {e.nombre}
          </button>
        ))}
      </div>
      {LEAD_ESTADOS.some((e) => e.esPerdido && e.codigo !== lead.estadoCodigo) && (
        <Input
          id="motivo-perdida"
          label="Motivo de pérdida"
          value={motivo}
          onChange={(e) => onMotivo(e.target.value)}
          className="mt-3"
        />
      )}
      <Button className="mt-4 w-full" onClick={onAgendar}>
        Agendar visita
      </Button>
    </div>
  )
}
