import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { DEMO_MODE, supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'

export function BackofficeShell() {
  const { session, demo } = useAuth()
  const navigate = useNavigate()
  const email = session?.user?.email ?? (demo ? 'preview@demo' : '—')

  async function cerrarSesion() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-slate-900 text-slate-100">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-teal-300">Plataforma</p>
          <h1 className="mt-1 text-lg font-bold">GC Backoffice</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-white/5'}`
            }
          >
            Empresas
          </NavLink>
          <NavLink
            to="/catalogos"
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-white/5'}`
            }
          >
            Catálogos
          </NavLink>
          <NavLink
            to="/salud"
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-white/5'}`
            }
          >
            Salud
          </NavLink>
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-slate-400">
          <p className="truncate">{email}</p>
          <button type="button" onClick={() => void cerrarSesion()} className="mt-2 text-teal-300 hover:text-white">
            Salir
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3">
          <span className="font-semibold shrink-0">GC Platform</span>
          <nav className="flex gap-3 text-xs">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'text-teal-300' : 'text-slate-300'}>Empresas</NavLink>
            <NavLink to="/catalogos" className={({ isActive }) => isActive ? 'text-teal-300' : 'text-slate-300'}>Catálogos</NavLink>
            <NavLink to="/salud" className={({ isActive }) => isActive ? 'text-teal-300' : 'text-slate-300'}>Salud</NavLink>
          </nav>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
