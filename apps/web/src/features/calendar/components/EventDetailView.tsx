import type { CalendarEvent } from '../types'
import { CATEGORY_STYLES } from '../types'
import { CATALOGO_ACTIVIDADES } from '../eventsData'
import { StatusBar } from './StatusBar'

interface EventDetailViewProps {
  event: CalendarEvent
  onClose: () => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (eventId: string) => void
  embedded?: boolean
}

function formatFullDate(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return `${days[date.getDay()]}, ${d} ${months[m - 1]}`
  } catch {
    return dateStr
  }
}

function format12h(timeStr: string) {
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr || '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

const ESTADO_LABEL: Record<string, string> = {
  programada: 'Programada',
  completada: 'Completada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
}

export function EventDetailView({
  event,
  onClose,
  onEdit,
  onDelete,
  embedded = false,
}: EventDetailViewProps) {
  const style = CATEGORY_STYLES[event.category] || CATEGORY_STYLES.lavender
  const actividad = CATALOGO_ACTIVIDADES.find((a) => a.id === event.actividadId)
  const subActividad = actividad?.sub_actividades.find((sa) => sa.id === event.subActividadId)

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden font-sans">
      {!embedded && <StatusBar theme="dark" />}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        {/* Close button (✕) */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Cerrar detalle"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Right actions: Edit Pencil & 3-dots */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onEdit?.(event)}
            className="p-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Editar evento"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('¿Deseas eliminar este evento?')) {
                onDelete?.(event.id)
                onClose()
              }
            }}
            className="p-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Opciones"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Event Title Banner with Vertical Accent Bar & Dot */}
      <div className="px-6 pt-3 pb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1">
          {/* Vertical accent bar */}
          <div className={`w-1.5 h-6 rounded-full shrink-0 mt-1 ${style.bar}`} />
          <h1 className="text-xl font-serif font-medium text-slate-900 tracking-tight leading-snug">
            {event.title}
          </h1>
        </div>
        {/* Estado de la visita (máquina de estados) */}
        <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-purple-50 text-brand-800 border border-purple-100">
          {ESTADO_LABEL[event.estado ?? 'programada']}
        </span>
      </div>

      {/* Details List */}
      <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-8 divide-y divide-slate-100">
        {/* Actividad / Sub Actividad (catálogo de visitas) */}
        {actividad && (
          <div className="flex items-start gap-4 pt-1">
            <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13.5px] font-medium text-slate-800">
                {actividad.nombre}
              </p>
              {subActividad && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {subActividad.nombre}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Persona / Cliente */}
        {event.personaName && (
          <div className="flex items-start gap-4 pt-4">
            <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13.5px] font-medium text-slate-800">
                {event.personaName}
              </p>
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="flex items-start gap-4 pt-1">
          <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[13.5px] font-medium text-slate-800">
              {formatFullDate(event.date)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {format12h(event.startTime)} - {format12h(event.endTime)}
            </p>
          </div>
        </div>

        {/* Location Map Pin */}
        {event.location && (
          <div className="flex items-start gap-4 pt-4">
            <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13.5px] font-medium text-slate-800">
                {event.location}
              </p>
            </div>
          </div>
        )}

        {/* Video Call (Zoom / Teams / Meet) */}
        {event.videoCall && (
          <div className="flex items-start gap-4 pt-4">
            <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-slate-600">
                {formatFullDate(event.date)}
              </p>
              <a
                href={`#call-${event.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  alert(`Conectando a videollamada: ${event.videoCall}`)
                }}
                className="text-[13px] font-semibold text-brand-700 hover:text-brand-900 underline underline-offset-2 block mt-0.5"
              >
                {event.videoCall}
              </a>
            </div>
          </div>
        )}

        {/* Notes / Description (Clipboard) */}
        {event.notes && (
          <div className="flex items-start gap-4 pt-4">
            <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-slate-700 leading-relaxed">
                {event.notes}
              </p>
            </div>
          </div>
        )}

        {/* Attendees / Team Avatar Row */}
        <div className="flex items-center gap-4 pt-4">
          <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="flex items-center space-x-1.5 flex-1">
            {(event.attendees && event.attendees.length > 0 ? event.attendees : [
              { id: '1', name: 'Luisa', initials: 'LR', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face' },
              { id: '2', name: 'Erick', initials: 'EB', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
              { id: '3', name: 'Ana Lucía', initials: 'AP', avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face' },
              { id: '4', name: 'Marco', initials: 'MM', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face' },
            ]).map((att) => (
              <div
                key={att.id}
                className="w-7 h-7 rounded-full overflow-hidden border border-white shadow-xs bg-purple-100 flex items-center justify-center shrink-0"
                title={att.name}
              >
                {att.avatarUrl ? (
                  <img src={att.avatarUrl} alt={att.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-purple-800">{att.initials}</span>
                )}
              </div>
            ))}
            {/* Plus button to invite */}
            <button
              type="button"
              onClick={() => alert('Invitar colaboradores o clientes')}
              className="w-7 h-7 rounded-full border border-slate-300 hover:border-slate-400 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm transition-colors"
              aria-label="Agregar participante"
            >
              +
            </button>
          </div>
        </div>

        {/* Reminder (Bell) */}
        {event.reminder && (
          <div className="flex items-center gap-4 pt-4">
            <div className="w-6 h-6 flex items-center justify-center text-slate-400 shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-slate-700">
                {event.reminder}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action for GC Platform */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
        <button
          type="button"
          onClick={() => {
            alert(`✓ Check-in GPS registrado con éxito para ${event.title}`)
          }}
          className="flex-1 py-2.5 px-3 bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="12 8 8 12 12 16 12 8" />
          </svg>
          Check-in GPS
        </button>
        <button
          type="button"
          onClick={() => {
            alert(`✓ Gestión completada: ${event.title}`)
            onClose()
          }}
          className="py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-all"
        >
          Completar
        </button>
      </div>
    </div>
  )
}
