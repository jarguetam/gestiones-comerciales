import { useState } from 'react'
import { StatusBar } from './StatusBar'
import { BottomNav } from './BottomNav'
import { INITIAL_PERSONAS, type PersonaItem } from '../personasData'

interface PersonasViewProps {
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications') => void
  onScheduleWithPersona?: (personaName: string) => void
  /** Cartera viva: admite personas registradas desde el modal de nueva visita */
  personas?: PersonaItem[]
  embedded?: boolean
}

export function PersonasView({
  onOpenNewEvent,
  onNavigateTab,
  onScheduleWithPersona,
  personas = INITIAL_PERSONAS,
  embedded = false,
}: PersonasViewProps) {
  const [busqueda, setBusqueda] = useState('')

  const filtradas = personas.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.documento.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="min-h-full flex flex-col">
      {!embedded && <StatusBar />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-serif font-semibold text-slate-900">
              Personas & Clientes
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-brand-800">
              {personas.length} registros
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Fuerza comercial multi-rubro · Núcleo F1
          </p>

          {/* Search input */}
          <div className="mt-3 relative">
            <input
              type="text"
              placeholder="Buscar por nombre o documento"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-full py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Personas List */}
          <div className="mt-4 space-y-3">
            {filtradas.map((persona) => (
              <div key={persona.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{persona.nombre}</h3>
                    </div>
                    <p className="text-xs text-brand-700 mt-0.5">{persona.categoria}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] text-slate-600">{persona.documento} · {persona.telefono}</p>
                      <p className="text-[11px] text-slate-500">{persona.direccion}</p>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      {persona.visitasPendientes > 0 ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {persona.visitasPendientes} visitas pendientes
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-mint-100 text-green-700">
                          Al día
                        </span>
                      )}
                      {persona.saldo && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Saldo {persona.saldo}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onScheduleWithPersona?.(persona.nombre)}
                    className="ml-3 shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Agendar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!embedded && <BottomNav activeTab="personas" onNavigateTab={onNavigateTab} />}
    </div>
  )
}
