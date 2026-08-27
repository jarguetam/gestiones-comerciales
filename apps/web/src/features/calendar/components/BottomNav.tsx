interface BottomNavProps {
  activeTab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications'
  onTabChange: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications') => void
  onOpenNewEvent: () => void
}

export function BottomNav({ activeTab, onTabChange, onOpenNewEvent }: BottomNavProps) {
  return (
    <div className="relative z-20 flex items-center justify-around bg-white/95 backdrop-blur-sm border-t border-slate-100 px-3 py-2 select-none">
      {/* Bell / Notifications */}
      <button
        type="button"
        onClick={() => onTabChange('notifications')}
        className={`p-2.5 rounded-full transition-colors ${
          activeTab === 'notifications' ? 'text-brand-700 bg-purple-50' : 'text-slate-400 hover:text-slate-700'
        }`}
        aria-label="Notificaciones"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>

      {/* Calendar (Agenda / Timeline) */}
      <button
        type="button"
        onClick={() => onTabChange(activeTab === 'agenda' ? 'timeline' : 'agenda')}
        className={`p-2.5 rounded-full transition-colors relative ${
          activeTab === 'agenda' || activeTab === 'timeline' ? 'text-brand-700 font-semibold' : 'text-slate-400 hover:text-slate-700'
        }`}
        aria-label="Calendario"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="8.5" cy="14.5" r="1" fill="currentColor" />
          <circle cx="12" cy="14.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="14.5" r="1" fill="currentColor" />
        </svg>
        {(activeTab === 'agenda' || activeTab === 'timeline') && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-700 rounded-full"></span>
        )}
      </button>

      {/* Floating Center Purple Plus Button */}
      <div className="relative -top-3">
        <button
          type="button"
          onClick={onOpenNewEvent}
          className="w-12 h-12 rounded-full bg-brand-700 hover:bg-brand-800 text-white shadow-fab flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none"
          aria-label="Nuevo evento o visita"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Notebook / Gestiones / Personas */}
      <button
        type="button"
        onClick={() => onTabChange('personas')}
        className={`p-2.5 rounded-full transition-colors ${
          activeTab === 'personas' ? 'text-brand-700 bg-purple-50' : 'text-slate-400 hover:text-slate-700'
        }`}
        aria-label="Personas y clientes"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="9" y1="7" x2="15" y2="7" />
          <line x1="9" y1="11" x2="13" y2="11" />
        </svg>
      </button>

      {/* Search */}
      <button
        type="button"
        onClick={() => onTabChange('search')}
        className={`p-2.5 rounded-full transition-colors ${
          activeTab === 'search' ? 'text-brand-700 bg-purple-50' : 'text-slate-400 hover:text-slate-700'
        }`}
        aria-label="Buscar"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </div>
  )
}