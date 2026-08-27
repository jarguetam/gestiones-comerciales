import type { ReactNode } from 'react'

interface PhoneMockupProps {
  children: ReactNode
  title?: string
  className?: string
}

export function PhoneMockup({ children, title, className = '' }: PhoneMockupProps) {
  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {title && (
        <span className="mb-2 text-xs font-semibold text-purple-900/70 uppercase tracking-wider">
          {title}
        </span>
      )}
      {/* Outer Phone Shell */}
      <div className="relative w-[340px] h-[680px] sm:w-[360px] sm:h-[720px] bg-slate-950 rounded-[44px] p-3 shadow-2xl ring-1 ring-white/20 transition-all hover:shadow-[0_30px_70px_-15px_rgba(76,29,149,0.35)]">
        {/* Camera / Speaker Notch Pill */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full z-40 flex items-center justify-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-1 ring-slate-800" />
          <div className="w-10 h-1 rounded-full bg-slate-900" />
        </div>

        {/* Inner Screen Canvas */}
        <div className="w-full h-full bg-white rounded-[36px] overflow-hidden flex flex-col relative">
          {children}
        </div>

        {/* Home Indicator Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-800 rounded-full opacity-60 pointer-events-none" />
      </div>
    </div>
  )
}