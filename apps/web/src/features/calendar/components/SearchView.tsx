import { useState } from 'react'
import type { CalendarEvent } from '../types'
import { CATEGORY_STYLES } from '../types'
import { StatusBar } from './StatusBar'
import { BottomNav } from './BottomNav'

interface SearchViewProps {
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications') => void
  embedded?: boolean
}

export function SearchView({
  events,
  onSelectEvent,
  onOpenNewEvent,
  onNavigateTab,
  embedded = false,
}: SearchViewProps) {
  const [query, setQuery] = useState('')

  const results = events.filter((e) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      e.title.toLowerCase().includes(q) ||
      (e.location && e.location.toLowerCase().includes(q)) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      (e.personaName && e.personaName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden font-sans">
      {!embedded && <StatusBar theme="dark" />}

      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="relative">
          <input
            type="text"
            autoFocus
            placeholder="Buscar visitas, reuniones o lugares..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-9 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
          Resultados ({results.length})
        </p>
        {results.map((item) => {
          const style = CATEGORY_STYLES[item.category]
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectEvent(item)}
              className={`w-full text-left rounded-xl p-3 flex items-center gap-3 transition-all ${style.bg} hover:shadow-xs`}
            >
              <div className={`w-1.5 h-6 rounded-full shrink-0 ${style.bar}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${style.text}`}>{item.title}</p>
                <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                  📅 {item.date} · {item.startTime} {item.location ? `· ${item.location}` : ''}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <BottomNav
        activeTab="search"
        onTabChange={onNavigateTab}
        onOpenNewEvent={onOpenNewEvent}
      />
    </div>
  )
}