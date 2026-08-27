import { useState } from 'react'
import type { CalendarEvent } from './types'
import { INITIAL_EVENTS } from './eventsData'
import { INITIAL_PERSONAS, type PersonaItem } from './personasData'
import { Showcase3Phones } from './components/Showcase3Phones'
import { AgendaView } from './components/AgendaView'
import { TimelineView } from './components/TimelineView'
import { EventDetailView } from './components/EventDetailView'
import { PersonasView } from './components/PersonasView'
import { NotificationsView } from './components/NotificationsView'
import { SearchView } from './components/SearchView'
import { NewEventModal } from './components/NewEventModal'

interface InteractiveAppProps {
  onOpenAuth?: () => void
}

export function InteractiveApp({ onOpenAuth }: InteractiveAppProps) {
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS)
  const [activeTab, setActiveTab] = useState<'agenda' | 'timeline' | 'personas' | 'search' | 'notifications'>('timeline')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('2026-09-17')
  const [modalPersonaInicial, setModalPersonaInicial] = useState('')
  const [personas, setPersonas] = useState<PersonaItem[]>(INITIAL_PERSONAS)

  function handleSaveEvent(newEvent: CalendarEvent) {
    setEvents((prev) => [...prev, newEvent])
    setIsNewEventModalOpen(false)
    setModalPersonaInicial('')
  }

  function handleScheduleWithPersona(personaName: string) {
    setModalPersonaInicial(personaName)
    setIsNewEventModalOpen(true)
  }

  /** Alta de cliente desde el modal de nueva visita: enriquece la cartera visible. */
  function handleSavePersona(persona: PersonaItem) {
    setPersonas((prev) =>
      prev.some((p) => p.id === persona.id) ? prev : [...prev, persona]
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <circle cx="9" cy="12" r="1" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-serif font-bold text-slate-900 leading-tight">Gestiones Comerciales</h1>
              <p className="text-[10px] text-slate-500 leading-tight">Plataforma de fuerza comercial</p>
            </div>
          </div>
          <button
            onClick={() => setIsNewEventModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold px-3.5 py-2 rounded-full shadow-sm shadow-purple-500/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva Visita
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-md mx-auto pb-24">
      {activeTab === 'timeline' && !selectedEvent && (
          <div className="px-4 pt-4">
            <Showcase3Phones />
          </div>
        )}

        {selectedEvent ? (
          <div className="px-4 pt-4">
            <EventDetailView
              event={selectedEvent}
              onBack={() => setSelectedEvent(null)}
            />
          </div>
        ) : activeTab === 'timeline' ? (
          <div className="px-4 pt-2">
            <TimelineView
              events={events}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onSelectEvent={setSelectedEvent}
              onOpenNewEvent={() => setIsNewEventModalOpen(true)}
            />
          </div>
        ) : activeTab === 'agenda' ? (
          <div className="px-4 pt-4">
            <AgendaView
              events={events}
              onSelectEvent={setSelectedEvent}
              onOpenNewEvent={() => setIsNewEventModalOpen(true)}
            />
          </div>
        ) : activeTab === 'personas' ? (
          <div className="px-4 pt-4">
            <PersonasView
              personas={personas}
              onOpenNewEvent={() => setIsNewEventModalOpen(true)}
              onNavigateTab={setActiveTab}
              onScheduleWithPersona={handleScheduleWithPersona}
              embedded
            />
          </div>
        ) : activeTab === 'notifications' ? (
          <NotificationsView
            onNavigateTab={setActiveTab}
            onOpenNewEvent={() => setIsNewEventModalOpen(true)}
          />
        ) : (
          <div className="px-4 pt-4">
            <SearchView
              events={events}
              onSelectEvent={setSelectedEvent}
              onNavigateTab={setActiveTab}
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onNavigateTab={(tab) => {
        setSelectedEvent(null)
        setActiveTab(tab)
      }} />

      {/* Create New Event Modal */}
      {isNewEventModalOpen && (
        <NewEventModal
          initialDate={selectedDate}
          initialPersonaName={modalPersonaInicial}
          onSavePersona={handleSavePersona}
          onClose={() => {
            setIsNewEventModalOpen(false)
            setModalPersonaInicial('')
          }}
          onSave={handleSaveEvent}
        />
      )}
    </div>
  )
}

function BottomNav({ activeTab, onNavigateTab }: {
  activeTab: string
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications') => void
}) {
  const tabs = [
    { id: 'agenda', label: 'Agenda', icon: 'M3 5h18v16H3zM3 5l4-3m14 3l-4-3M8 3v2m8-2v2M3 10h18' },
    { id: 'timeline', label: 'Timeline', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'personas', label: 'Personas', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0z' },
    { id: 'search', label: 'Buscar', icon: 'M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.35-4.35' },
    { id: 'notifications', label: 'Alertas', icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' },
  ] as const

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/70 safe-area-pb">
      <div className="max-w-md mx-auto px-4 py-1.5 flex items-center justify-between">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigateTab(tab.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
              activeTab === tab.id ? 'text-brand-700' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d={tab.icon} />
            </svg>
            <span className={`text-[10px] font-semibold ${activeTab === tab.id ? 'text-brand-700' : ''}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
