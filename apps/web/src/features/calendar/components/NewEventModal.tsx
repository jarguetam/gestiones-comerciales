import { useMemo, useState } from 'react'
import type { CalendarEvent, EventCategory } from '../types'
import { CATALOGO_ACTIVIDADES, CATALOGO_HORAS, INITIAL_ATTENDEES } from '../eventsData'

interface NewEventModalProps {
  onClose: () => void
  onSave: (event: CalendarEvent) => void
  initialDate?: string
  initialPersonaName?: string
}

/**
 * Mapping visual entre actividad del catálogo y la paleta de acentos del template.
 * Verificación=amber · Seguimiento=lavender · Prospección=mint · Recuperación=rose · Cultivo=sky
 */
const ACTIVIDAD_CATEGORIA: Record<number, EventCategory> = {
  1: 'amber',
  2: 'lavender',
  3: 'mint',
  4: 'rose',
  5: 'sky',
}

export function NewEventModal({
  onClose,
  onSave,
  initialDate = '2026-09-17',
  initialPersonaName = '',
}: NewEventModalProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [actividadId, setActividadId] = useState<number | ''>('')
  const [subActividadId, setSubActividadId] = useState<number | ''>('')
  const [horaId, setHoraId] = useState<number>(2) // 1 hora
  const [location, setLocation] = useState('')
  const [videoCall, setVideoCall] = useState('')
  const [notes, setNotes] = useState('')
  const [reminder, setReminder] = useState('20 mins before')
  const [personaName, setPersonaName] = useState(initialPersonaName)
  const [error, setError] = useState('')

  const actividadSeleccionada = useMemo(
    () => CATALOGO_ACTIVIDADES.find((a) => a.id === actividadId),
    [actividadId]
  )
  const subActividadSeleccionada = useMemo(
    () => actividadSeleccionada?.sub_actividades.find((sa) => sa.id === subActividadId),
    [actividadSeleccionada, subActividadId]
  )

  function handleActividadChange(value: string) {
    const id = value === '' ? '' : Number(value)
    setActividadId(id)
    setSubActividadId('') // reset dependiente: la subactividad debe pertenecer a la actividad
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (actividadId === '') {
      setError('Selecciona el tipo de actividad')
      return
    }
    if (subActividadId === '') {
      setError('Selecciona la sub actividad')
      return
    }
    if (!title.trim()) {
      setError('Escribe el título de la visita')
      return
    }

    const newEv: CalendarEvent = {
      id: `vis-${Date.now()}`,
      title: title.trim(),
      date,
      startTime,
      endTime,
      category: ACTIVIDAD_CATEGORIA[Number(actividadId)] ?? 'lavender',
      location: location.trim() || undefined,
      videoCall: videoCall.trim() || undefined,
      notes: notes.trim() || undefined,
      reminder,
      personaId: undefined,
      personaName: personaName.trim() || undefined,
      actividadId: Number(actividadId),
      subActividadId: Number(subActividadId),
      estado: 'programada',
      attendees: INITIAL_ATTENDEES.slice(0, 2),
    }
    onSave(newEv)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-brand-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-serif italic text-white tracking-wide">
            Nueva Visita / Gestión
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
          {/* Tipo de Actividad (dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Tipo de Actividad *
            </label>
            <select
              value={actividadId}
              onChange={(e) => handleActividadChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              <option value="">— Selecciona el tipo de actividad —</option>
              {CATALOGO_ACTIVIDADES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Sub Actividad (dropdown dependiente) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Sub Actividad *
            </label>
            <select
              value={subActividadId}
              onChange={(e) => setSubActividadId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!actividadSeleccionada}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white ${
                !actividadSeleccionada ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="">
                {actividadSeleccionada ? '— Selecciona la sub actividad —' : 'Primero elige el tipo de actividad'}
              </option>
              {actividadSeleccionada?.sub_actividades.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  {sa.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Duración estimada (catálogo actividad_hora) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Duración estimada
            </label>
            <select
              value={horaId}
              onChange={(e) => setHoraId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              {CATALOGO_HORAS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Título autogenerado de la visita */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Título de la visita *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder={
                  actividadSeleccionada && subActividadSeleccionada
                    ? `${actividadSeleccionada.nombre} — ${subActividadSeleccionada.nombre}`
                    : 'Ej. Verificación de garantías — Finca Las Palmas'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pr-24 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
              <button
                type="button"
                onClick={() =>
                  actividadSeleccionada &&
                  subActividadSeleccionada &&
                  setTitle(
                    `${actividadSeleccionada.nombre} — ${subActividadSeleccionada.nombre}`
                  )
                }
                disabled={!actividadSeleccionada || !subActividadSeleccionada}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-purple-50 text-brand-700 text-[11px] font-semibold hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Autocompletar
              </button>
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

          {/* Persona / Cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Persona / Cliente asociado</label>
            <input
              type="text"
              placeholder="Ej. Agropecuaria El Triunfo"
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ubicación / Dirección</label>
            <input
              type="text"
              placeholder="Ej. Km 42 Carretera al Pacífico, Escuintla"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Video Call */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Enlace / Videollamada (Meet / Zoom)</label>
            <input
              type="text"
              placeholder="Ej. meet.google.com/gc-visita-123"
              value={videoCall}
              onChange={(e) => setVideoCall(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notas / Instrucciones</label>
            <textarea
              rows={2}
              placeholder="Ej. Llevar cámara para el registro fotográfico de las garantías"
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

          {/* Error de validación (integridad actividad → sub_actividad) */}
          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

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
              Guardar visita
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
