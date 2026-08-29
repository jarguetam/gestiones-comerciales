import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { DEMO_MODE, supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'
import { BrandMark } from '../components/ui/BrandMark'
import { cn } from '../lib/cn'

const NAV = [
  { to: '/', label: 'Empresas', end: true },
  { to: '/catalogos', label: 'Catálogos' },
  { to: '/salud', label: 'Salud' },
  { to: '/seguridad', label: 'MFA' },
]

export function BackofficeShell() {
  const { session, demo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menu, setMenu] = useState(false)
  const email = session?.user?.email ?? (demo ? 'preview@demo' : '—')

  useEffect(() => {
    setMenu(false)
  }, [location.pathname])

  async function cerrarSesion() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-campo',
      isActive ? 'bg-primary text-white' : 'text-ink hover:bg-canvas',
    )

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2 border-b border-line px-4 py-5">
          <BrandMark nombre="GC Platform" compact />
          <div>
            <p className="font-display text-base leading-tight tracking-tight">GC Platform</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">Backoffice</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Principal">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-4 text-[11px] text-muted">
          <p className="truncate">{email}</p>
          <button type="button" onClick={() => void cerrarSesion()} className="mt-2 min-h-11 text-ink hover:text-primary">
            Salir
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:hidden">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-line px-3 text-sm"
            onClick={() => setMenu((v) => !v)}
          >
            Menú
          </button>
          <span className="font-display shrink-0 tracking-tight">GC Platform</span>
        </header>
        {menu && (
          <nav className="space-y-1 border-b border-line bg-surface px-3 pb-3 md:hidden" aria-label="Móvil">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
        <Outlet />
      </div>
    </div>
  )
}
