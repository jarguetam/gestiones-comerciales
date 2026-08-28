import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { mostrarConfiguracion, mostrarMapa, mostrarUsuarios } from '../lib/claims'
import { DEMO_MODE, supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'

type NavItem = { to: string; label: string; end?: boolean; codigo?: string }

const CORE_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/visitas', label: 'Visitas' },
  { to: '/personas', label: 'Personas' },
  { to: '/crm', label: 'CRM' },
  { to: '/formularios', label: 'Formularios' },
  { to: '/notificaciones', label: 'Notificaciones' },
]

const MODULOS_NAV: NavItem[] = [
  { to: '/solicitudes', label: 'Solicitudes', codigo: 'solicitudes' },
  { to: '/depositos', label: 'Depósitos', codigo: 'depositos' },
  { to: '/cuentas', label: 'Cuentas', codigo: 'creditos' },
  { to: '/kilometraje', label: 'Kilometraje', codigo: 'kilometraje' },
]

interface AppShellProps {
  tenantNombre: string
  fuente: 'demo' | 'supabase'
  aviso?: string
  modulos?: string[]
  onNuevaVisita: () => void
  children: ReactNode
}

export function AppShell({ tenantNombre, fuente, aviso, modulos = [], onNuevaVisita, children }: AppShellProps) {
  const { session, demo, rol } = useAuth()
  const navigate = useNavigate()
  const email = session?.user?.email ?? (demo ? 'preview@demo' : '—')
  const adminNav: NavItem[] = [
    ...(mostrarMapa(rol, DEMO_MODE) ? [{ to: '/mapa', label: 'Mapa' }] : []),
    ...(mostrarConfiguracion(rol, DEMO_MODE) ? [{ to: '/configuracion', label: 'Configuración' }] : []),
    ...(mostrarUsuarios(rol, DEMO_MODE) ? [{ to: '/usuarios', label: 'Usuarios' }] : []),
  ]
  const nav = [
    ...CORE_NAV,
    ...adminNav,
    ...MODULOS_NAV.filter((item) => DEMO_MODE || (item.codigo != null && modulos.includes(item.codigo))),
  ]

  async function cerrarSesion() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F3EEE4] text-slate-900 flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-[#1B2430] text-[#F3EEE4]">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-brand-300">Ruta de campo</p>
          <h1 className="mt-1 font-serif text-xl leading-tight">Gestiones Comerciales</h1>
          <p className="mt-2 text-xs text-slate-400 truncate">{tenantNombre}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Principal">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-slate-400">
          <p className="truncate">{email}</p>
          <p className="mt-1 uppercase tracking-wide">{fuente === 'demo' ? 'Modo demo' : 'Supabase'}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[#1B2430] text-white px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="md:hidden">
            <p className="text-[10px] uppercase tracking-[0.18em] text-brand-300">GC</p>
            <p className="text-sm font-semibold truncate max-w-[12rem]">{tenantNombre}</p>
          </div>
          <nav className="flex md:hidden gap-1 overflow-x-auto" aria-label="Móvil">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    isActive ? 'bg-brand-700 text-white' : 'text-slate-300'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onNuevaVisita}
              className="rounded-lg bg-brand-700 hover:bg-brand-800 px-3 py-1.5 text-sm font-semibold"
            >
              Nueva visita
            </button>
            {!demo && (
              <button
                type="button"
                onClick={() => void cerrarSesion()}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              >
                Salir
              </button>
            )}
          </div>
        </header>

        {aviso && (
          <p className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {aviso}
          </p>
        )}

        <main className="flex-1 p-4 md:p-6 relative min-h-0">{children}</main>
      </div>
    </div>
  )
}
