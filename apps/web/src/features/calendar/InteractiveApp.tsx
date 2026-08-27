import { useState } from 'react'
import type { CalendarEvent } from './types'
import { INITIAL_EVENTS } from './eventsData'
import { Showcase3Phones } from './components/Showcase3Phones'
import { AgendaView } from './components/AgendaView'
import { TimelineView } from './components/TimelineView'
import { EventDetailView } from './components/EventDetailView'
import { PersonasView } from './components/PersonasView'
import { NotificationsView } from './components/NotificationsView'
import { SearchView } from './components/SearchView'
import { NewEventModal } from './components/NewEventModal'
import { PhoneMockup } from './components/PhoneMockup'

export function InteractiveApp() {
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS)
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-17')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent>(INITIAL_EVENTS[0])
  const [activeTab, setActiveTab] = useState<'agenda' | 'timeline' | 'personas' | 'search' | 'notifications'>('timeline')
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'showcase' | 'single' | 'fullwidth'>('showcase')
  const [tenantNombre, setTenantNombre] = useState('AgroMoney S.A.')

  function handleSelectEvent(event: CalendarEvent) {
    setSelectedEvent(event)
    setIsDetailOpen(true)
  }

  function handleSaveEvent(newEvent: CalendarEvent) {
    setEvents((prev) => [newEvent, ...prev])
    setSelectedEvent(newEvent)
    setSelectedDate(newEvent.date)
  }

  function handleDeleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    if (selectedEvent.id === id && events.length > 1) {
      setSelectedEvent(events[1])
    }
  }

  function handleScheduleWithPersona(personaName: string) {
    setIsNewEventModalOpen(true)
    // Pre-seleccionar persona si se provee
    if (personaName) {
      setTenantNombre((prev) => prev)
    }
  }

  return (
    <div className="min-h-screen bg-[#C8B6FF] flex flex-col selection:bg-purple-300">
      {/* Top Floating Control Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shadow-xs">
              GC
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight block">
                Gestiones Comerciales
              </span>
              <span className="text-[11px] text-purple-300 block">
                Empresa: <strong className="text-white">{tenantNombre}</strong>
              </span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => setViewMode('showcase')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'showcase'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📱 Showcase (3 Pantallas)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'single'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📲 Modo Móvil
            </button>
            <button
              type="button"
              onClick={() => setViewMode('fullwidth')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'fullwidth'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              💻 Vista Web
            </button>
          </div>

          {/* Tenant Selector & Actions */}
          <div className="flex items-center gap-2">
            <select
              value={tenantNombre}
              onChange={(e) => setTenantNombre(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-400"
            >
              <option value="AgroMoney S.A.">AgroMoney S.A. (Microfinanzas)</option>
              <option value="Distribuidora GT">Distribuidora GT (Consumo)</option>
              <option value="Farmacéutica Central">Farmacéutica Central</option>
            </select>

            <button
              type="button"
              onClick={() => setIsNewEventModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white font-semibold flex items-center gap-1 shadow-xs transition-colors"
            >
              <span>+</span> Nueva Gestión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas based on View Mode */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4">
        {viewMode === 'showcase' && (
          <Showcase3Phones
            events={events}
            selectedEvent={selectedEvent}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onSelectEvent={handleSelectEvent}
            onOpenNewEvent={() => setIsNewEventModalOpen(true)}
            onNavigateTab={setActiveTab}
            onCloseDetail={() => setIsDetailOpen(false)}
          />
        )}

        {viewMode === 'single' && (
          <div className="py-6 flex justify-center w-full">
            <PhoneMockup>
              {isDetailOpen ? (
                <EventDetailView
                  event={selectedEvent}
                  onClose={() => setIsDetailOpen(false)}
                  onEdit={handleSelectEvent}
                  onDelete={handleDeleteEvent}
                />
              ) : activeTab === 'agenda' ? (
                <AgendaView
                  events={events}
                  onSelectEvent={handleSelectEvent}
                  onOpenNewEvent={() => setIsNewEventModalOpen(true)}
                  onNavigateTab={setActiveTab}
                />
              ) : activeTab === 'timeline' ? (
                <TimelineView
                  events={events}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onSelectEvent={handleSelectEvent}
                  onOpenNewEvent={() => setIsNewEventModalOpen(true)}
                  onNavigateTab={setActiveTab}
                />
              ) : activeTab === 'personas' ? (
                <PersonasView
                  onOpenNewEvent={() => setIsNewEventModalOpen(true)}
                  onNavigateTab={setActiveTab}
                  onScheduleWithPersona={handleScheduleWithPersona}
                />
              ) : activeTab === 'notifications' ? (
                <NotificationsView
                  onOpenNewEvent={() => setIsNewEventModalOpen(true)}
                  onNavigateTab={setActiveTab}
                />
              ) : (
                <SearchView
                  events={events}
                  onSelectEvent={handleSelectEvent}
                  onOpenNewEvent={() => setIsNewEventModalOpen(true)}
                  onNavigateTab={setActiveTab}
                />
              )}
            </PhoneMockup>
          </div>
        )}

        {viewMode === 'fullwidth' && (
          <div className="w-full max-w-6xl mx-auto my-6 bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 flex flex-col md:flex-row min-h-[750px]">
            {/* Sidebar with Agenda & Personas */}
            <div className="w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
              <div className="p-4 border-b border-slate-100 bg-white">
                <h2 className="text-xl font-serif font-bold text-slate-900">Agenda & Rutas</h2>
                <p className="text-xs text-slate-500 mt-0.5">Gestiones Comerciales</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                <AgendaView
                  events={events}
                  onSelectEvent={handleSelectEvent}
                  onOpenNewEvent={() => setIsNewEventModalOpen(true)}
                  onNavigateTab={setActiveTab}
                  embedded
                />
              </div>
            </div>

            {/* Center Timeline */}
            <div className="flex-1 flex flex-col bg-white">
              <TimelineView
                events={events}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onSelectEvent={handleSelectEvent}
                onOpenNewEvent={() => setIsNewEventModalOpen(true)}
                onNavigateTab={setActiveTab}
                embedded
              />
            </div>

            {/* Right Details Panel */}
            <div className="w-full md:w-96 border-l border-slate-100 flex flex-col bg-white">
              <EventDetailView
                event={selectedEvent}
                onClose={() => setIsDetailOpen(false)}
                onEdit={handleSelectEvent}
                onDelete={handleDeleteEvent}
                embedded
              />
            </div>
          </div>
        )}
      </main>

      {/* Create New Event Modal */}
      {isNewEventModalOpen && (
        <NewEventModal
          initialDate={selectedDate}
          onClose={() => setIsNewEventModalOpen(false)}
          onSave={handleSaveEvent}
        />
      )}
    </div>
  )
}