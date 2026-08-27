import { useState, useMemo } from 'react'
import type { CalendarEvent } from '../types'
import { CATEGORY_STYLES } from '../types'
import { StatusBar } from './StatusBar'
import { BottomNav } from './BottomNav'

interface TimelineViewProps {
  events: CalendarEvent[]
  selectedDate: string
  onDateChange: (date: string) => void
  onSelectEvent: (event: CalendarEvent) => void
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications' | 'crm') => void
  embedded?: boolean
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const WEEK_DAYS = [
  { label: 'M', date: '2026-09-13', num: 13 },
  { label: 'T', date: '2026-09-14', num: 14 },
  { label: 'W', date: '2026-09-15', num: 15 },
  { label: 'T', date: '2026-09-16', num: 16 },
  { label: 'F', date: '2026-09-17', num: 17 },
  { label: 'S', date: '2026-09-18', num: 18 },
  { label: 'S', date: '2026-09-19', num: 19 },
]

const TIME_SLOTS = [
  { time: '08:00', label: '08:00', ampm: 'am', hour: 8 },
  { time: '09:00', label: '09:00', ampm: 'am', hour: 9 },
  { time: '10:00', label: '10:00', ampm: 'am', hour: 10 },
  { time: '11:00', label: '11:00', ampm: 'am', hour: 11 },
  { time: '12:00', label: '12:00', ampm: 'pm', hour: 12 },
  { time: '13:00', label: '01:00', ampm: 'pm', hour: 13 },
  { time: '14:00', label: '02:00', ampm: 'pm', hour: 14 },
  { time: '15:00', label: '03:00', ampm: 'pm', hour: 15 },
  { time: '16:00', label: '04:00', ampm: 'pm', hour: 16 },
  { time: '17:00', label: '05:00', ampm: 'pm', hour: 17 },
]

function formatTimeRange(start: string, end: string) {
  const format12 = (t: string) => {
    const [hStr, mStr] = t.split(':')
    let h = parseInt(hStr, 10)
    const m = mStr || '00'
    const ampm = h >= 12 ? 'PM' : 'AM'
    if (h > 12) h -= 12
    if (h === 0) h = 12
    const padH = h < 10 ? `0${h}` : `${h}`
    return `${padH}:${m} ${ampm}`
  }
  return `${format12(start)} - ${format12(end)}`
}

export function TimelineView({
  events,
  selectedDate = '2026-09-17',
  onDateChange,
  onSelectEvent,
  onOpenNewEvent,
  onNavigateTab,
  embedded = false,
}: TimelineViewProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Filter events for currently selected date
  const dayEvents = useMemo(() => {
    return events.filter((e) => e.date === selectedDate)
  }, [events, selectedDate])

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden font-sans">
      {/* Purple Top Header */}
      <div className="bg-brand-700 text-white shrink-0 pb-2.5 transition-all">
        {!embedded && <StatusBar theme="light" />}

        {/* App Bar / Navigation */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          {/* Hamburger Menu */}
          <button
            type="button"
            onClick={() => onNavigateTab('personas')}
            className="p-1.5 -ml-1.5 rounded-lg text-white/90 hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Menú principal"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>

          {/* Month Title — derivado de la fecha seleccionada */}
          <h2 className="text-2xl font-serif italic text-white tracking-wide font-normal">
            {MONTHS_ES[
              Math.max(0, Math.min(11, parseInt(selectedDate.split('-')[1] || '9', 10) - 1))
            ]}
          </h2>

          {/* Options Menu */}
          <button
            type="button"
            onClick={onOpenNewEvent}
            className="p-1.5 -mr-1.5 rounded-lg text-white/90 hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Opciones"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
        </div>

        {/* Week Day Selector Strip */}
        {!collapsed && (
          <div className="px-4 pt-1 pb-1">
            <div className="grid grid-cols-7 gap-1 text-center items-center">
              {WEEK_DAYS.map((day) => {
                const isSelected = day.date === selectedDate
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => onDateChange(day.date)}
                    className="flex flex-col items-center justify-center py-1 transition-all group focus:outline-none"
                  >
                    <span className="text-[11px] font-medium text-white/80 uppercase mb-1">
                      {day.label}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-white text-brand-800 shadow-md font-bold scale-105'
                          : 'text-white/90 group-hover:bg-white/10'
                      }`}
                    >
                      {day.num}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Collapse / Expand chevron pill */}
        <div className="flex justify-center -mb-2 mt-0.5">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/70 hover:text-white p-1 focus:outline-none"
            aria-label="Expandir o contraer calendario"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline Hour Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {TIME_SLOTS.map((slot) => {
          // Find event starting or active in this hour slot
          const slotEvent = dayEvents.find((e) => {
            const startHour = parseInt(e.startTime.split(':')[0], 10)
            return startHour === slot.hour
          })

          return (
            <div key={slot.time} className="flex items-start gap-3 min-h-[58px] relative group">
              {/* Time Gutter on the left */}
              <div className="w-12 pt-0.5 flex flex-col items-start shrink-0 text-slate-400 select-none">
                <span className="text-[12px] font-semibold tracking-tight text-slate-600">
                  {slot.label}
                </span>
                <span className="text-[10px] font-normal uppercase text-slate-400">
                  {slot.ampm}
                </span>
              </div>

              {/* Horizontal line & Event container */}
              <div className="flex-1 border-t border-slate-100/90 pt-0 relative min-h-[50px]">
                {slotEvent ? (
                  (() => {
                    const style = CATEGORY_STYLES[slotEvent.category]
                    return (
                      <button
                        type="button"
                        onClick={() => onSelectEvent(slotEvent)}
                        className={`w-full text-left rounded-xl p-3.5 transition-all transform active:scale-[0.98] shadow-xs hover:shadow-md cursor-pointer ${style.bg} relative flex items-center gap-3`}
                      >
                        {/* Colored vertical bar */}
                        <div className={`w-1.5 h-10 rounded-full shrink-0 ${style.bar}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13.5px] font-semibold leading-snug truncate ${style.text}`}>
                            {slotEvent.title}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {formatTimeRange(slotEvent.startTime, slotEvent.endTime)}
                          </p>
                        </div>
                      </button>
                    )
                  })()
                ) : (
                  /* Empty slot trigger */
                  <button
                    type="button"
                    onClick={onOpenNewEvent}
                    className="w-full h-8 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-purple-50/50 flex items-center px-3 text-[11px] text-brand-600 transition-opacity"
                  >
                    + Programar visita a las {slot.label} {slot.ampm}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="timeline"
        onTabChange={onNavigateTab}
        onOpenNewEvent={onOpenNewEvent}
      />
    </div>
  )
}
