import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { mostrarAuditoria, mostrarConfiguracion, mostrarMapa, mostrarUsuarios } from '../lib/claims'
import { DEMO_MODE, supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'
import { useNotificaciones } from '../features/notificaciones/useNotificaciones'
import { Button } from '../components/ui/Button'
import { BrandMark } from '../components/ui/BrandMark'
import { Alert } from '../components/ui/Alert'
import { cn } from '../lib/cn'
import type { BrandingTenant } from '../lib/branding'
import { nombreComercial } from '../lib/branding'
import { etiquetaVocab } from '../lib/vocabulario'

type NavItem = { to: string; label: string; end?: boolean; codigo?: string }

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
  const [campanaAbierta, setCampanaAbierta] = useState(false)
  const live = !DEMO_MODE && fuente === 'supabase'
  const inbox = useNotificaciones(live)
  const email = session?.user?.email ?? (demo ? 'preview@demo' : '—')
  const marca = nombreComercial(branding, tenantNombre)
  const noLeidas = inbox.pendientes
  const coreNav: NavItem[] = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/visitas', label: etiquetaVocab(branding, 'visita', 'Visitas') },
    { to: '/personas', label: etiquetaVocab(branding, 'persona', 'Personas') },
    { to: '/crm', label: 'CRM' },
    { to: '/formularios', label: 'Formularios' },
    { to: '/notificaciones', label: 'Notificaciones' },
  ]
  const modulosNav: NavItem[] = [
    { to: '/solicitudes', label: etiquetaVocab(branding, 'solicitud', 'Solicitudes'), codigo: 'solicitudes' },
    { to: '/depositos', label: 'Depósitos', codigo: 'depositos' },
    { to: '/cuentas', label: 'Cuentas', codigo: 'creditos' },
    { to: '/kilometraje', label: 'Kilometraje', codigo: 'kilometraje' },
  ]
  const adminNav: NavItem[] = [
    ...(mostrarMapa(rol, DEMO_MODE) ? [{ to: '/mapa', label: 'Mapa' }] : []),
    ...(mostrarConfiguracion(rol, DEMO_MODE) ? [{ to: '/configuracion', label: 'Configuración' }] : []),
    ...(mostrarUsuarios(rol, DEMO_MODE) ? [{ to: '/usuarios', label: 'Usuarios' }] : []),
    ...(mostrarAuditoria(rol, DEMO_MODE) ? [{ to: '/auditoria', label: 'Auditoría' }] : []),
  ]
  const nav = [
    ...coreNav,
    ...adminNav,
    ...modulosNav.filter((item) => DEMO_MODE || (item.codigo != null && modulos.includes(item.codigo))),
  ]

  useEffect(() => {
    setMenuAbierto(false)
    setCampanaAbierta(false)
  }, [location.pathname])

  async function cerrarSesion() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
    )

  function abrirCampana() {
    setCampanaAbierta((v) => !v)
    if (live) void inbox.refetch()
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-ink text-canvas">
        <div className="px-5 pt-6 pb-5 border-b border-white/10 flex items-start gap-3">
          <BrandMark nombre={marca} logoUrl={branding.logo_url} variant="dark" />
          <div className="min-w-0">
            <h1 className="font-serif text-xl leading-tight truncate">Gestiones Comerciales</h1>
            <p className="mt-1 text-xs text-white/50 truncate">{marca}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Principal">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-white/50">
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
            <div className="relative">
              <button
                type="button"
                className="relative rounded-lg border border-white/20 px-2.5 py-1.5 text-white/80 hover:bg-white/10"
                aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
                aria-expanded={campanaAbierta}
                aria-haspopup="dialog"
                onClick={abrirCampana}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 9a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {noLeidas > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[1rem] rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {noLeidas}
                  </span>
                ) : null}
              </button>
              {campanaAbierta && (
                <div
                  role="dialog"
                  aria-label="Bandeja de notificaciones"
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-line bg-surface p-3 text-ink shadow-xl"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {noLeidas} sin leer
                  </p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {inbox.items.slice(0, 5).map((n) => (
                      <li key={n.id} className="rounded-lg border border-line px-2 py-1.5">
                        <p className="text-sm font-medium leading-tight">{n.titulo}</p>
                        <p className="text-[11px] text-muted line-clamp-2">{n.cuerpo}</p>
                      </li>
                    ))}
                    {inbox.items.length === 0 && (
                      <li className="text-sm text-muted">No hay avisos.</li>
                    )}
                  </ul>
                  <NavLink
                    to="/notificaciones"
                    className="mt-3 inline-block text-sm font-medium text-primary"
                    onClick={() => setCampanaAbierta(false)}
                  >
                    Ver todas
                  </NavLink>
                </div>
              )}
            </div>
            <Button size="sm" onClick={onNuevaVisita}>
              Nueva visita
            </Button>
            {!demo && (
              <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={() => void cerrarSesion()}>
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
