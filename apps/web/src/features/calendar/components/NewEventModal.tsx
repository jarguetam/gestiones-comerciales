import { useState } from 'react'
import type { CalendarEvent, EventCategory } from '../types'
import { CATEGORY_STYLES } from '../types'
import { INITIAL_ATTENDEES } from '../eventsData'

interface NewEventModalProps {
  onClose: () => void
  onSave: (event: CalendarEvent) => void
  initialDate?: string
}

const CATEGORIES: { key: EventCategory; label: string }[] = [
  { key: 'amber', label: 'Reunión / Legal' },
  { key: 'mint', label: 'Cita / Médico' },
  { key: 'sky', label: 'Visita / Ruta' },
  { key: 'lavender', label: 'Videollamada' },
  { key: 'rose', label: 'Cierre / Evento' },
]

export function NewEventModal({ onClose, onSave, initialDate = '2026-09-17' }: NewEventModalProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [category, setCategory] = useState<EventCategory>('amber')
  const [location, setLocation] = useState('')
  const [videoCall, setVideoCall] = useState('')
  const [notes, setNotes] = useState('')
  const [reminder, setReminder] = useState('20 mins before')
  const [personaName, setPersonaName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const newEv: CalendarEvent = {
      id: `ev-${Date.now()}`,
      title: title.trim(),
      date,
      startTime,
      endTime,
      category,
      location: location.trim() || undefined,
      videoCall: videoCall.trim() || undefined,
      notes: notes.trim() || undefined,
      reminder,
      personaName: personaName.trim() || undefined,
      attendees: INITIAL_ATTENDEES.slice(0, 2),
    }
    onSave(newEv)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-brand-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-serif italic text-white tracking-wide">
            Nueva Actividad / Gestión
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Título del evento o visita *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Meeting with legal team / Visita a cliente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Category / Color selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tipo / Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORIES.map((cat) => {
                const st = CATEGORY_STYLES[cat.key]
                const isSelected = category === cat.key
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={`h-10 rounded-xl flex items-center justify-center transition-all ${st.bg} border-2 ${
                      isSelected ? 'border-brand-700 ring-2 ring-brand-300 scale-105' : 'border-transparent hover:opacity-80'
                    }`}
                    title={cat.label}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full ${st.bar}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date & Times */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Inicio</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ubicación / Dirección</label>
            <input
              type="text"
              placeholder="Ej. Ginn's Coffee Club / Finca Las Palmas"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Video Call */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Enlace / Videollamada (Zoom / Meet)</label>
            <input
              type="text"
              placeholder="Ej. Zoom - 0366971 / meet.google.com/xyz"
              value={videoCall}
              onChange={(e) => setVideoCall(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Persona / Cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Persona / Cliente asociado</label>
            <input
              type="text"
              placeholder="Ej. Agropecuaria El Triunfo / Sofía Morales"
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notas / Instrucciones</label>
            <textarea
              rows={2}
              placeholder="Ej. Remember to bring camera for the annual group photo"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Recordatorio</label>
            <select
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              <option value="10 mins before">10 mins before</option>
              <option value="20 mins before">20 mins before</option>
              <option value="30 mins before">30 mins before</option>
              <option value="1 hour before">1 hour before</option>
              <option value="1 day before">1 day before</option>
            </select>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-xl shadow-md transition-all"
            >
              Guardar evento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}