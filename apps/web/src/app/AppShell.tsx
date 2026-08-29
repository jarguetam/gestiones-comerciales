import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { mostrarAuditoria, mostrarConfiguracion, mostrarMapa, mostrarUsuarios } from '../lib/claims'
import { DEMO_MODE, supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'
import { contarNoLeidas, demoNotificaciones } from '../features/notificaciones/notificaciones'
import { Button } from '../components/ui/Button'
import { BrandMark } from '../components/ui/BrandMark'
import { Alert } from '../components/ui/Alert'
import { cn } from '../lib/cn'
import type { BrandingTenant } from '../lib/branding'
import { nombreComercial } from '../lib/branding'

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
  branding: BrandingTenant
  fuente: 'demo' | 'supabase'
  aviso?: string
  modulos?: string[]
  onNuevaVisita: () => void
  children: ReactNode
}

export function AppShell({
  tenantNombre,
  branding,
  fuente,
  aviso,
  modulos = [],
  onNuevaVisita,
  children,
}: AppShellProps) {
  const { session, demo, rol } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const email = session?.user?.email ?? (demo ? 'preview@demo' : '—')
  const marca = nombreComercial(branding, tenantNombre)
  const noLeidas = contarNoLeidas(demoNotificaciones())
  const adminNav: NavItem[] = [
    ...(mostrarMapa(rol, DEMO_MODE) ? [{ to: '/mapa', label: 'Mapa' }] : []),
    ...(mostrarConfiguracion(rol, DEMO_MODE) ? [{ to: '/configuracion', label: 'Configuración' }] : []),
    ...(mostrarUsuarios(rol, DEMO_MODE) ? [{ to: '/usuarios', label: 'Usuarios' }] : []),
    ...(mostrarAuditoria(rol, DEMO_MODE) ? [{ to: '/auditoria', label: 'Auditoría' }] : []),
  ]
  const nav = [
    ...CORE_NAV,
    ...adminNav,
    ...MODULOS_NAV.filter((item) => DEMO_MODE || (item.codigo != null && modulos.includes(item.codigo))),
  ]

  useEffect(() => {
    setMenuAbierto(false)
  }, [location.pathname])

  async function cerrarSesion() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
    )

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-ink text-canvas">
        <div className="px-5 pt-6 pb-5 border-b border-white/10 flex items-start gap-3">
          <BrandMark nombre={marca} logoUrl={branding.logo_url} variant="dark" />
          <div className="min-w-0">
            <h1 className="font-serif text-xl leading-tight truncate">Gestiones Comerciales</h1>
            <p className="mt-1 text-xs text-slate-400 truncate">{marca}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Principal">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
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
        <header className="sticky top-0 z-30 bg-ink text-white px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              className="rounded-lg border border-white/20 px-2.5 py-1.5 text-sm"
              aria-expanded={menuAbierto}
              aria-controls="nav-movil"
              onClick={() => setMenuAbierto((v) => !v)}
            >
              Menú
            </button>
            <BrandMark nombre={marca} logoUrl={branding.logo_url} variant="dark" compact />
            <p className="text-sm font-semibold truncate max-w-[10rem]">{marca}</p>
          </div>
          {menuAbierto && (
            <nav id="nav-movil" className="w-full md:hidden flex flex-col gap-1 pb-2" aria-label="Móvil">
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <NavLink
              to="/notificaciones"
              className="relative rounded-lg border border-white/20 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
            >
              Campana
              {noLeidas > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[1rem] rounded-full bg-amber-400 px-1 text-[10px] font-bold text-ink">
                  {noLeidas}
                </span>
              ) : null}
            </NavLink>
            <Button size="sm" onClick={onNuevaVisita}>
              Nueva visita
            </Button>
            {!demo && (
              <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10" onClick={() => void cerrarSesion()}>
                Salir
              </Button>
            )}
          </div>
        </header>

        {aviso && (
          <div className="mx-4 mt-4">
            <Alert tone="warning">{aviso}</Alert>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 relative min-h-0">{children}</main>
      </div>
    </div>
  )
}
