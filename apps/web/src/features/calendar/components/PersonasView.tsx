import { useState } from 'react'
import { StatusBar } from './StatusBar'
import { BottomNav } from './BottomNav'

interface PersonasViewProps {
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications') => void
  onScheduleWithPersona?: (personaName: string) => void
  embedded?: boolean
}

interface PersonaItem {
  id: string
  nombre: string
  categoria: string
  documento: string
  telefono: string
  direccion: string
  visitasPendientes: number
  saldo?: string
}

const INITIAL_PERSONAS: PersonaItem[] = [
  {
    id: 'p1',
    nombre: 'Agropecuaria El Triunfo',
    categoria: 'Cliente A (Crédito Activo)',
    documento: 'NIT 8492019-3',
    telefono: '+502 5521-9988',
    direccion: 'Km 56 Carretera a Puerto San José, Escuintla',
    visitasPendientes: 2,
    saldo: 'Q 45,000.00',
  },
  {
    id: 'p2',
    nombre: 'Distribuidora La Bendición',
    categoria: 'Punto de Venta Mayorista',
    documento: 'NIT 2948102-1',
    telefono: '+502 4432-1100',
    direccion: '4a Calle 12-45 Zona 3, Quetzaltenango',
    visitasPendientes: 1,
    saldo: 'Q 18,250.00',
  },
  {
    id: 'p3',
    nombre: 'Farmacia Santa María',
    categoria: 'Canal Farmacéutico',
    documento: 'NIT 9948201-8',
    telefono: '+502 3320-7711',
    direccion: 'Avenida Elena 8-30 Zona 1, Guatemala',
    visitasPendientes: 0,
  },
  {
    id: 'p4',
    nombre: 'Cooperativa Agrícola San Pedro',
    categoria: 'Prospecto Calificado (CRM)',
    documento: 'DPI 2489 19201 0101',
    telefono: '+502 5900-2233',
    direccion: 'San Pedro Carchá, Alta Verapaz',
    visitasPendientes: 1,
  },
]

export function PersonasView({
  onOpenNewEvent,
  onNavigateTab,
  onScheduleWithPersona,
  embedded = false,
}: PersonasViewProps) {
  const [busqueda, setBusqueda] = useState('')

  const filtradas = INITIAL_PERSONAS.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.direccion.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden font-sans">
      {!embedded && <StatusBar theme="dark" />}

      {/* Header */}
      <div className="px-6 pt-5 pb-3 bg-gradient-to-b from-purple-50/50 to-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-serif font-semibold text-slate-900">
            Personas & Clientes
          </h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-brand-800">
            {INITIAL_PERSONAS.length} registros
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Fuerza comercial multi-rubro · Núcleo F1
        </p>

        {/* Search input */}
        <div className="mt-3 relative">
          <input
            type="text"
            placeholder="Buscar por nombre, rubro o dirección..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-9 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Personas List */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {filtradas.map((persona) => (
          <div
            key={persona.id}
            className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-all space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                  {persona.nombre}
                </h3>
                <span className="inline-block mt-0.5 text-[10.5px] font-medium text-brand-700 bg-purple-50 px-2 py-0.5 rounded-md">
                  {persona.categoria}
                </span>
              </div>
              {persona.saldo && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Saldo</span>
                  <span className="text-xs font-bold text-slate-800">{persona.saldo}</span>
                </div>
              )}
            </div>

            <p className="text-[11.5px] text-slate-500 leading-normal">
              📍 {persona.direccion}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-xs">
              <span className="text-[11px] text-slate-400">
                📞 {persona.telefono}
              </span>
              <button
                type="button"
                onClick={() => onScheduleWithPersona?.(persona.nombre)}
                className="px-2.5 py-1 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-[11px] font-medium shadow-xs transition-colors"
              >
                + Agendar visita
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="personas"
        onTabChange={onNavigateTab}
        onOpenNewEvent={onOpenNewEvent}
      />
    </div>
  )
}