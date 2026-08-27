import { useMemo, useState } from 'react'
import type { CalendarEvent, EventCategory } from '../types'
import { CATALOGO_ACTIVIDADES, CATALOGO_HORAS, INITIAL_ATTENDEES } from '../eventsData'
import { INITIAL_PERSONAS, type PersonaItem } from '../personasData'

interface NewEventModalProps {
  onClose: () => void
  onSave: (event: CalendarEvent) => void
  onSavePersona?: (persona: PersonaItem) => void
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
  onSavePersona,
  initialDate = '2026-09-17',
  initialPersonaName = '',
}: NewEventModalProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState('09:00')
  const [duration, setDuration] = useState('1 hora')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [actividadId, setActividadId] = useState<number | ''>('')
  const [subActividadId, setSubActividadId] = useState<number | ''>('')
  const [horaId, setHoraId] = useState<number | ''>('')
  const [personas, setPersonas] = useState<PersonaItem[]>(INITIAL_PERSONAS)
  const [personaId, setPersonaId] = useState<string>(
    INITIAL_PERSONAS.some((p) => p.nombre === initialPersonaName) ? initialPersonaName : ''
  )
  const [mostrarAlta, setMostrarAlta] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaCategoria, setNuevaCategoria] = useState('Prospecto — En evaluación')
  const [nuevoDocumento, setNuevoDocumento] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevaDireccion, setNuevaDireccion] = useState('')
  const [errorPersona, setErrorPersona] = useState('')
  const [error, setError] = useState('')

  const subActividadesDisponibles = useMemo(
    () => CATALOGO_ACTIVIDADES.find((a) => a.id === actividadId)?.subActividades ?? [],
    [actividadId]
  )

  function handleActividadChange(value: string) {
    const id = value === '' ? '' : Number(value)
    setActividadId(id)
    setSubActividadId('') // reset dependiente: la subactividad debe pertenecer a la actividad
  }

  const personaSeleccionada = personas.find((p) => p.nombre === personaId)

  /** Registra un nuevo cliente en la cartera y lo deja seleccionado para la visita. */
  function handleRegistrarPersona(e: React.FormEvent) {
    e.preventDefault()
    setErrorPersona('')

    const nombreLimpio = nuevoNombre.trim()
    if (!nombreLimpio) {
      setErrorPersona('Escribe el nombre del cliente')
      return
    }
    if (personas.some((p) => p.nombre.toLowerCase() === nombreLimpio.toLowerCase())) {
      setErrorPersona('Ese cliente ya existe en tu cartera — selecciona del listado')
      return
    }

    const nueva: PersonaItem = {
      id: `p${personas.length + 1}`,
      nombre: nombreLimpio,
      categoria: nuevaCategoria,
      documento: nuevoDocumento.trim() || 'Sin documento',
      telefono: nuevoTelefono.trim() || '—',
      direccion: nuevaDireccion.trim() || '—',
      visitasPendientes: 1,
    }
    setPersonas((prev) => [...prev, nueva])
    setPersonaId(nueva.nombre)
    onSavePersona?.(nueva)
    setMostrarAlta(false)
    setNuevoNombre('')
    setNuevoDocumento('')
    setNuevoTelefono('')
    setNuevaDireccion('')
    // Autocompleta la dirección de la visita con la del nuevo cliente
    if (nueva.direccion !== '—' && !location.trim()) {
      setLocation(nueva.direccion)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (actividadId === '') {
      setError('Selecciona el tipo de actividad')
      return
    }
    if (!personaSeleccionada) {
      setError('Selecciona el cliente de tu cartera o registra uno nuevo')
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
    if (!date.trim()) {
      setError('Selecciona la fecha de la visita')
      return
    }

    setError('')

    const [horas, minutos] = startTime.split(':').map(Number)
    const duracionHoras =
      CATALOGO_HORAS.find((h) => h.id === horaId)?.cantidad ??
      (duration === '30 minutos' ? 0.5 : duration === '2 horas' ? 2 : duration === '4 horas' ? 4 : duration === 'Jornada completa' ? 8 : 1)
    const finMinutos = horas * 60 + minutos + duracionHoras * 60
    const endTime = `${String(Math.floor(finMinutos / 60) % 24).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`

    const nuevaVisita: CalendarEvent = {
      id: `vis-${Date.now()}`,
      title: title.trim(),
      date,
      startTime,
      endTime,
      category: ACTIVIDAD_CATEGORIA[Number(actividadId)] ?? 'lavender',
      location: location.trim() || personaSeleccionada.direccion,
      notes: notes.trim(),
      attendees: INITIAL_ATTENDEES.filter((a) => attendeeIds.includes(a.id)),
      reminder: '30 mins before',
      personaId: personaSeleccionada.id,
      personaName: personaSeleccionada.nombre,
      actividadId: Number(actividadId),
      subActividadId: Number(subActividadId),
      estado: 'programada',
    }

    onSave(nuevaVisita)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-serif font-semibold text-slate-900">Nueva Visita</h2>
            <p className="text-[11px] text-slate-500">Agenda comercial multi-rubro</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-600">
              {error}
            </div>
          )}

          {/* Tipo de Actividad */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
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

          {/* Sub Actividad (dependiente) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sub Actividad *
            </label>
            <select
              value={subActividadId}
              onChange={(e) => setSubActividadId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={actividadId === ''}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {actividadId === '' ? 'Primero elige el tipo de actividad' : '— Selecciona la sub actividad —'}
              </option>
              {subActividadesDisponibles.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  {sa.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Duración del catálogo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Duración estimada
            </label>
            <select
              value={horaId}
              onChange={(e) => setHoraId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
            >
              <option value="">— Selecciona la duración —</option>
              {CATALOGO_HORAS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Persona / Cliente (dropdown de la cartera + alta inline) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Cliente *
              </label>
              <button
                type="button"
                onClick={() => setMostrarAlta((v) => !v)}
                className="text-[11px] font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {mostrarAlta ? 'Usar listado' : 'Nuevo cliente'}
              </button>
            </div>

            {!mostrarAlta ? (
              <>
                <select
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
                >
                  <option value="">— Selecciona el cliente de tu cartera —</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.nombre}>
                      {p.nombre} · {p.documento}
                    </option>
                  ))}
                </select>
                {personaSeleccionada && (
                  <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                    {personaSeleccionada.categoria}
                    {personaSeleccionada.saldo ? ` · Saldo ${personaSeleccionada.saldo}` : ''}
                    <br />
                    {personaSeleccionada.direccion}
                  </p>
                )}
              </>
            ) : (
              <form
                onSubmit={handleRegistrarPersona}
                className="space-y-2 rounded-xl border border-dashed border-brand-300 bg-purple-50/40 p-3"
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Nombre del cliente o negocio *"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="NIT / DPI / Cédula"
                    value={nuevoDocumento}
                    onChange={(e) => setNuevoDocumento(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Dirección del negocio"
                  value={nuevaDireccion}
                  onChange={(e) => setNuevaDireccion(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
                />
                <select
                  value={nuevaCategoria}
                  onChange={(e) => setNuevaCategoria(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
                >
                  <option>Prospecto — En evaluación</option>
                  <option>Cliente — Crédito activo</option>
                  <option>Cliente — Crédito agrícola activo</option>
                  <option>Cliente — Crédito de consumo activo</option>
                  <option>Punto de venta / Distribuidor</option>
                  <option>Referido</option>
                </select>
                {errorPersona && (
                  <p className="text-[11px] font-semibold text-rose-600">{errorPersona}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold transition-colors"
                >
                  Registrar y usar en esta visita
                </button>
              </form>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título de la visita *
            </label>
            <input
              type="text"
              placeholder="Ej. Verificación de garantías — Finca Santa Isabel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <button
              type="button"
              onClick={() => {
                const actividad = CATALOGO_ACTIVIDADES.find((a) => a.id === actividadId)
                const subactividad = actividad?.subActividades.find((sa) => sa.id === subActividadId)
                if (actividad && subactividad) {
                  setTitle(`${actividad.nombre} — ${subactividad.nombre}`)
                }
              }}
              className="mt-1.5 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
            >
              Autocompletar con actividad y subactividad
            </button>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora inicio *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ubicación</label>
            <input
              type="text"
              placeholder="Ej. Km 56 Carretera a Puerto San José, Escuintla"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notas</label>
            <textarea
              placeholder="Detalles del objetivo de la visita…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
            />
          </div>

          {/* Team */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Equipo asignado
            </label>
            <div className="space-y-2">
              {INITIAL_ATTENDEES.map((att) => (
                <label
                  key={att.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={attendeeIds.includes(att.id)}
                    onChange={(e) =>
                      setAttendeeIds((prev) =>
                        e.target.checked ? [...prev, att.id] : prev.filter((id) => id !== att.id)
                      )
                    }
                    className="rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                  />
                  <img src={att.avatarUrl} alt={att.name} className="w-7 h-7 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{att.name}</p>
                    <p className="text-[11px] text-slate-500">{att.role}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold transition-colors"
            >
              Programar Visita
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
