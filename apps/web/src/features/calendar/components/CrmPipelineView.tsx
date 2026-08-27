/**
 * W-15 — Pipeline CRM kanban (F2.3) + W-16 detalle + W-17 embudo.
 * Columnas = lead_estado (embudo configurable por tenant). Cada tarjeta
 * permite transicionar vía RPC lead_transicion (reglas GC-CRM-*) o, en
 * modo demo, moviendo el estado local. Al entrar a "ganado" se convierte
 * a persona (lead_convertir) y se refleja en la cartera.
 */
import { useMemo, useState } from 'react'
import { StatusBar } from './StatusBar'
import { BottomNav } from './BottomNav'
import {
  INITIAL_LEADS,
  LEAD_ESTADOS,
  LEAD_ORIGENES,
  nextLeadId,
  type LeadItem,
} from '../leadsData'

interface CrmPipelineViewProps {
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications' | 'crm') => void
  /** Convierte un lead ganado en persona de la cartera (núcleo F1). */
  onConvertLead?: (lead: LeadItem) => void
  leads?: LeadItem[]
  onChangeLeads?: (leads: LeadItem[]) => void
  embedded?: boolean
}

type Vista = 'kanban' | 'embudo'

export function CrmPipelineView({
  onOpenNewEvent,
  onNavigateTab,
  onConvertLead,
  leads: leadsProp,
  onChangeLeads,
  embedded = false,
}: CrmPipelineViewProps) {
  const [leadsInternos, setLeadsInternos] = useState<LeadItem[]>(INITIAL_LEADS)
  const leads = leadsProp ?? leadsInternos
  const setLeads = (next: LeadItem[]) => {
    if (onChangeLeads) onChangeLeads(next)
    else setLeadsInternos(next)
  }

  const [vista, setVista] = useState<Vista>('kanban')
  const [seleccionado, setSeleccionado] = useState<LeadItem | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)

  // form nuevo lead
  const [nNombre, setNNombre] = useState('')
  const [nTelefono, setNTelefono] = useState('')
  const [nOrigen, setNOrigen] = useState<string>(LEAD_ORIGENES[0])
  const [nMonto, setNMonto] = useState('')
  const [error, setError] = useState<string | null>(null)

  const porEstado = useMemo(() => {
    const mapa: Record<string, LeadItem[]> = {}
    for (const e of LEAD_ESTADOS) mapa[e.codigo] = []
    for (const l of leads) mapa[l.estadoCodigo]?.push(l)
    return mapa
  }, [leads])

  // ---- embudo agregado (crm_funnel en producción) ----
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
    [leads]
  )
  const maxEmbudo = Math.max(1, ...embudo.map((e) => e.leads))

  // ---- transición (lead_transicion) ----
  function moverLead(lead: LeadItem, destinoCodigo: string, motivo?: string) {
    const destino = LEAD_ESTADOS.find((e) => e.codigo === destinoCodigo)
    if (!destino) return
    const origen = LEAD_ESTADOS.find((e) => e.codigo === lead.estadoCodigo)
    const orden = (c: string) => LEAD_ESTADOS.findIndex((e) => e.codigo === c)

    // CRM-2: perdido exige motivo
    if (destino.esPerdido && !motivo) {
      const m = window.prompt('Motivo de pérdida (requerido, GC-CRM-002):')
      if (!m || !m.trim()) return
      motivo = m.trim()
    }
    // CRM-1: retroceso a etapa previa (no ganado/perdido) requiere supervisor+
    if (
      origen &&
      orden(destinoCodigo) < orden(lead.estadoCodigo) &&
      !destino.esGanado &&
      !destino.esPerdido
    ) {
      window.alert('GC-CRM-001: retroceder en el embudo requiere rol supervisor o superior.')
      return
    }
    // CRM-4: lead convertido no retrocede
    if (lead.convertido && orden(destinoCodigo) < orden(lead.estadoCodigo)) {
      window.alert('GC-CRM-004: un lead convertido no puede volver a estados previos.')
      return
    }

    const convertido = destino.esGanado ? true : lead.convertido
    const actualizado: LeadItem = {
      ...lead,
      estadoCodigo: destinoCodigo,
      perdidoMotivo: destino.esPerdido ? motivo : lead.perdidoMotivo,
      convertido,
    }
    setLeads(leads.map((l) => (l.id === lead.id ? actualizado : l)))
    if (destino.esGanado && !lead.convertido && onConvertLead) onConvertLead(actualizado)
    setSeleccionado(actualizado)
  }

  // ---- alta de lead ----
  function guardarLead() {
    setError(null)
    if (!nNombre.trim()) return setError('El nombre es requerido')
    if (!nTelefono.trim()) return setError('El teléfono es requerido (dedupe GC)')
    const dup = leads.find(
      (l) => !l.convertido && l.telefono.replace(/\s/g, '') === nTelefono.replace(/\s/g, '')
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
    setNNombre(''); setNTelefono(''); setNMonto(''); setNOrigen(LEAD_ORIGENES[0])
    setMostrarNuevo(false)
  }

  const fmt = (n?: number) =>
    n == null ? '' : 'Q ' + n.toLocaleString('es-GT', { minimumFractionDigits: 0 })

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden font-sans relative">
      {!embedded && <StatusBar theme="dark" />}

      {/* Header */}
      <div className="px-5 pt-5 pb-2 bg-gradient-to-b from-purple-50/50 to-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-serif font-semibold text-slate-900">Pipeline CRM</h1>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-semibold">
            <button
              onClick={() => setVista('kanban')}
              className={`px-2.5 py-1 ${vista === 'kanban' ? 'bg-brand-700 text-white' : 'text-slate-500'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setVista('embudo')}
              className={`px-2.5 py-1 ${vista === 'embudo' ? 'bg-brand-700 text-white' : 'text-slate-500'}`}
            >
              Embudo
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{leads.length} leads · Ciclo de venta F2</p>
      </div>

      {/* KANBAN */}
      {vista === 'kanban' && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-2">
          <div className="flex gap-3 h-full min-w-max py-2">
            {LEAD_ESTADOS.map((estado) => (
              <div key={estado.codigo} className="w-56 flex flex-col">
                <div
                  className={`px-3 py-1.5 rounded-t-xl text-[11px] font-bold tracking-wide uppercase flex justify-between ${
                    estado.esGanado
                      ? 'bg-emerald-100 text-emerald-800'
                      : estado.esPerdido
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span>{estado.nombre}</span>
                  <span>{porEstado[estado.codigo]?.length ?? 0}</span>
                </div>
                <div className="flex-1 bg-slate-50/70 rounded-b-xl p-2 space-y-2 overflow-y-auto">
                  {(porEstado[estado.codigo] ?? []).map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => setSeleccionado(lead)}
                      className="w-full text-left rounded-xl border border-slate-100 bg-white p-3 shadow-xs hover:shadow-md transition-all"
                    >
                      <p className="text-[13px] font-semibold text-slate-900 leading-tight">
                        {lead.nombre}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{lead.telefono}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-brand-700 bg-purple-50 px-1.5 py-0.5 rounded">
                          {lead.origen}
                        </span>
                        {lead.montoEstimado != null && (
                          <span className="text-[11px] font-semibold text-slate-700">
                            {fmt(lead.montoEstimado)}
                          </span>
                        )}
                      </div>
                      {lead.convertido && (
                        <span className="inline-block mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          → cliente
                        </span>
                      )}
                    </button>
                  ))}
                  {(porEstado[estado.codigo] ?? []).length === 0 && (
                    <p className="text-[11px] text-slate-300 text-center py-4">Sin leads</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMBUDO (W-17) */}
      {vista === 'embudo' && (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {embudo.map((e) => (
            <div key={e.codigo}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-slate-700">{e.nombre}</span>
                <span className="text-slate-500">
                  {e.leads} · {fmt(e.monto)}
                </span>
              </div>
              <div className="h-6 rounded-lg bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-lg transition-all ${
                    e.esGanado ? 'bg-emerald-500' : e.esPerdido ? 'bg-rose-400' : 'bg-brand-600'
                  }`}
                  style={{ width: `${(e.leads / maxEmbudo) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 pt-2">
            Embudo agregado por estado · crm_funnel (rango) en producción
          </p>
        </div>
      )}

      {/* DETALLE (W-16) */}
      {seleccionado && (
        <div className="absolute inset-0 z-30 bg-black/40 flex items-end" onClick={() => setSeleccionado(null)}>
          <div
            className="bg-white w-full rounded-t-3xl p-5 max-h-[80%] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-serif font-semibold text-slate-900">{seleccionado.nombre}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {seleccionado.telefono}
              {seleccionado.documento ? ` · ${seleccionado.documento}` : ''}
            </p>
            {seleccionado.direccion && (
              <p className="text-xs text-slate-500">{seleccionado.direccion}</p>
            )}
            <div className="flex gap-2 mt-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-purple-50 text-brand-700">{seleccionado.origen}</span>
              {seleccionado.montoEstimado != null && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                  {fmt(seleccionado.montoEstimado)}
                </span>
              )}
            </div>
            {seleccionado.perdidoMotivo && (
              <p className="mt-2 text-[12px] text-rose-600 bg-rose-50 rounded-lg p-2">
                Perdido: {seleccionado.perdidoMotivo}
              </p>
            )}
            {seleccionado.convertido && (
              <p className="mt-2 text-[12px] text-emerald-700 bg-emerald-50 rounded-lg p-2">
                Convertido a cliente (persona del núcleo) — GC-CRM-003
              </p>
            )}

            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-1.5">
              Mover a
            </p>
            <div className="flex flex-wrap gap-2">
              {LEAD_ESTADOS.filter((e) => e.codigo !== seleccionado.estadoCodigo).map((e) => (
                <button
                  key={e.codigo}
                  onClick={() => moverLead(seleccionado, e.codigo)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${
                    e.esGanado
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : e.esPerdido
                      ? 'border-rose-200 text-rose-700 bg-rose-50'
                      : 'border-slate-200 text-slate-600 bg-slate-50'
                  }`}
                >
                  {e.nombre}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                onOpenNewEvent()
                setSeleccionado(null)
              }}
              className="mt-4 w-full py-2.5 rounded-xl bg-brand-700 text-white text-sm font-semibold"
            >
              Agendar visita
            </button>
          </div>
        </div>
      )}

      {/* NUEVO LEAD */}
      {mostrarNuevo && (
        <div className="absolute inset-0 z-30 bg-black/40 flex items-end" onClick={() => setMostrarNuevo(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-serif font-semibold text-slate-900 mb-3">Nuevo lead</h2>
            <input
              className="w-full mb-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Nombre *"
              value={nNombre}
              onChange={(e) => setNNombre(e.target.value)}
            />
            <input
              className="w-full mb-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Teléfono *"
              value={nTelefono}
              onChange={(e) => setNTelefono(e.target.value)}
            />
            <input
              className="w-full mb-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Monto estimado (Q)"
              inputMode="numeric"
              value={nMonto}
              onChange={(e) => setNMonto(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <div className="flex flex-wrap gap-1.5 mb-2">
              {LEAD_ORIGENES.map((o) => (
                <button
                  key={o}
                  onClick={() => setNOrigen(o)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border ${
                    nOrigen === o
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'text-slate-600 border-slate-200'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            {error && <p className="text-[12px] text-rose-600 mb-2">{error}</p>}
            <button
              onClick={guardarLead}
              className="w-full py-2.5 rounded-xl bg-brand-700 text-white text-sm font-semibold"
            >
              Guardar lead
            </button>
          </div>
        </div>
      )}

      {/* FAB nuevo lead */}
      {!mostrarNuevo && !seleccionado && (
        <button
          onClick={() => setMostrarNuevo(true)}
          className={`absolute right-5 z-20 w-11 h-11 rounded-full bg-brand-700 text-white shadow-fab flex items-center justify-center text-xl ${
            embedded ? 'bottom-6' : 'bottom-20'
          }`}
          aria-label="Nuevo lead"
        >
          +
        </button>
      )}

      {!embedded && (
        <BottomNav activeTab={'crm'} onTabChange={onNavigateTab} onOpenNewEvent={onOpenNewEvent} />
      )}
    </div>
  )
}
