interface StatusBarProps {
  theme?: 'dark' | 'light'
}

export function StatusBar({ theme = 'dark' }: StatusBarProps) {
  const isLight = theme === 'light'
  const textColor = isLight ? 'text-white' : 'text-slate-900'
  const iconColor = isLight ? 'fill-white text-white' : 'fill-slate-900 text-slate-900'

  return (
    <div className={`flex items-center justify-between px-6 pt-3 pb-1 text-xs font-semibold select-none ${textColor}`}>
      <span className="tracking-tight text-[13px]">10:24</span>
      <div className="flex items-center space-x-1.5">
        {/* Signal bars */}
        <svg className={`w-3.5 h-3 ${iconColor}`} viewBox="0 0 16 14" fill="currentColor">
          <rect x="0" y="10" width="2.5" height="4" rx="0.5" />
          <rect x="4.5" y="7" width="2.5" height="7" rx="0.5" />
          <rect x="9" y="3.5" width="2.5" height="10.5" rx="0.5" />
          <rect x="13.5" y="0" width="2.5" height="14" rx="0.5" />
        </svg>
        {/* WiFi */}
        <svg className={`w-3.5 h-3.5 ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
        </svg>
        {/* Battery */}
        <div className="flex items-center">
          <div className={`w-5 h-2.5 rounded-sm border-[1.2px] ${isLight ? 'border-white' : 'border-slate-800'} p-0.5 flex items-center`}>
            <div className={`h-full w-3.5 rounded-[1px] ${isLight ? 'bg-white' : 'bg-slate-900'}`}></div>
          </div>
          <div className={`w-0.5 h-1 rounded-r-xs ${isLight ? 'bg-white' : 'bg-slate-800'}`}></div>
        </div>
      </div>
    </div>
  )
}