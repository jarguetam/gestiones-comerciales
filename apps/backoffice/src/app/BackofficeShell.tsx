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
      'block rounded-lg px-3 py-2 text-sm font-medium',
      isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/5',
    )

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-ink text-slate-100">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-2">
          <BrandMark nombre="GC Backoffice" variant="dark" compact />
          <div>
            <p className="text-lg font-bold leading-tight">GC Backoffice</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Plataforma</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Principal">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-slate-400">
          <p className="truncate">{email}</p>
          <button type="button" onClick={() => void cerrarSesion()} className="mt-2 text-slate-200 hover:text-white">
            Salir
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="md:hidden bg-ink text-white px-4 py-3 flex items-center justify-between gap-3">
          <button type="button" className="rounded border border-white/20 px-2 py-1 text-sm" onClick={() => setMenu((v) => !v)}>
            Menú
          </button>
          <span className="font-semibold shrink-0">GC Backoffice</span>
        </header>
        {menu && (
          <nav className="md:hidden bg-ink px-3 pb-3 space-y-1" aria-label="Móvil">
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
