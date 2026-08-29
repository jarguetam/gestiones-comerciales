/**
 * W-15/16/17 — Pipeline CRM desktop: kanban de ancho completo + ficha lateral.
 * Sin PhoneMockup ni BottomNav.
 */
import { useMemo, useState } from 'react'
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

  const embudo = useMemo(
    () =>
      LEAD_ESTADOS.map((e) => {
        const del = leads.filter((l) => l.estadoCodigo === e.codigo)
        return {
          ...e,
          leads: del.length,
          monto: del.reduce((a, l) => a + (l.montoEstimado ?? 0), 0),
        }
      }),
    [leads],
  )
  const maxEmbudo = Math.max(1, ...embudo.map((e) => e.leads))

  function moverLead(lead: LeadItem, destinoCodigo: string, motivoPerdida?: string) {
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
    setLeads(leads.map((l) => (l.id === lead.id ? actualizado : l)))
    if (destino.esGanado && !lead.convertido && onConvertLead) onConvertLead(actualizado)
    setSeleccionado(actualizado)
    setMotivo('')
    push({ tone: 'success', titulo: `Lead movido a ${destino.nombre}` })
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
                <div key={estado.codigo} className="flex w-64 flex-col rounded-2xl border border-line bg-surface">
                  <div
                    className={cn(
                      'flex justify-between rounded-t-2xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide',
                      estado.esGanado && 'bg-emerald-100 text-emerald-800',
                      estado.esPerdido && 'bg-rose-100 text-rose-700',
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
                        onClick={() => setSeleccionado(lead)}
                        className={cn(
                          'w-full rounded-xl border border-line bg-canvas p-3 text-left hover:border-primary',
                          seleccionado?.id === lead.id && 'ring-2 ring-primary',
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
                          <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-700">→ cliente</span>
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
                motivo={motivo}
                onMotivo={setMotivo}
                onMover={moverLead}
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
                  className={cn(
                    'h-full rounded-lg',
                    e.esGanado ? 'bg-emerald-500' : e.esPerdido ? 'bg-rose-400' : 'bg-primary',
                  )}
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
            {error && <p className="text-sm text-rose-700">{error}</p>}
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
  motivo,
  onMotivo,
  onMover,
  onAgendar,
}: {
  lead: LeadItem
  motivo: string
  onMotivo: (v: string) => void
  onMover: (lead: LeadItem, codigo: string, motivo?: string) => void
  onAgendar: () => void
}) {
  return (
    <div>
      <h2 className="font-serif text-xl">{lead.nombre}</h2>
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
        <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">Perdido: {lead.perdidoMotivo}</p>
      )}
      {lead.convertido && (
        <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">Convertido a cliente</p>
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
              e.esGanado && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              e.esPerdido && 'border-rose-200 bg-rose-50 text-rose-700',
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
