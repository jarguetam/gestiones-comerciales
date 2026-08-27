import { useMemo } from 'react'
import type { CalendarEvent } from '../types'
import { CATEGORY_STYLES } from '../types'
import { StatusBar } from './StatusBar'
import { BottomNav } from './BottomNav'

interface AgendaViewProps {
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications') => void
  embedded?: boolean
}

interface GroupedEvents {
  monthBadge: string
  dayBadge: string
  dateKey: string
  items: CalendarEvent[]
}

export function AgendaView({
  events,
  onSelectEvent,
  onOpenNewEvent,
  onNavigateTab,
  embedded = false,
}: AgendaViewProps) {
  const rangoMeses = useMemo(() => {
    if (events.length === 0) return ''
    const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const sorted = [...events].map((e) => e.date).sort()
    const a = new Date(sorted[0])
    const b = new Date(sorted[sorted.length - 1])
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return meses[a.getMonth()]
    }
    return `${meses[a.getMonth()]}- ${meses[b.getMonth()]}`
  }, [events])

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    for (const ev of sorted) {
      const list = map.get(ev.date) || []
      list.push(ev)
      map.set(ev.date, list)
    }

    const result: GroupedEvents[] = []
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    for (const [dateStr, items] of map.entries()) {
      const parts = dateStr.split('-')
      const mIdx = parseInt(parts[1], 10) - 1
      const dayNum = parseInt(parts[2], 10).toString()
      result.push({
        monthBadge: months[mIdx] || 'SEP',
        dayBadge: dayNum,
        dateKey: dateStr,
        items,
      })
    }
    return result
  }, [events])

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden font-sans">
      {!embedded && <StatusBar theme="dark" />}

      {/* Header with Title */}
      <div className="px-6 pt-5 pb-3">
        <h1 className="text-2xl font-serif text-slate-900 tracking-tight flex items-baseline gap-2">
          <span className="font-normal font-sans text-xl text-slate-800">2026</span>
          <span className="italic font-serif text-[26px] font-normal text-slate-900">
            {rangoMeses}
          </span>
        </h1>
      </div>

      {/* Event list grouped by dates */}
      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-6 space-y-6">
        {grouped.map((group) => (
          <div key={group.dateKey} className="flex items-start gap-4">
            {/* Date badge column on the left */}
            <div className="w-10 pt-1 flex flex-col items-center shrink-0">
              <span className="text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                {group.monthBadge}
              </span>
              <span className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                {group.dayBadge}
              </span>
            </div>

            {/* Cards column on the right */}
            <div className="flex-1 space-y-2.5">
              {group.items.map((item) => {
                const style = CATEGORY_STYLES[item.category]
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectEvent(item)}
                    className={`w-full text-left rounded-xl p-3.5 flex items-center gap-3 transition-all transform active:scale-[0.98] shadow-xs hover:shadow-md cursor-pointer ${style.bg}`}
                  >
                    {/* Colored vertical indicator pill */}
                    <div className={`w-1.5 h-7 rounded-full shrink-0 ${style.bar}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13.5px] font-medium leading-snug truncate ${style.text}`}>
                        {item.title}
                      </p>
                      {item.location && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 opacity-80">
                          {item.location}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab="agenda"
        onTabChange={onNavigateTab}
        onOpenNewEvent={onOpenNewEvent}
      />
    </div>
  )
}
