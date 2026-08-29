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
  const [masAbierto, setMasAbierto] = useState(false)
  const [campanaAbierta, setCampanaAbierta] = useState(false)
  const live = !DEMO_MODE && fuente === 'supabase'
  const inbox = useNotificaciones(live)
  const email = session?.user?.email ?? (demo ? 'preview@demo' : '—')
  const marca = nombreComercial(branding, tenantNombre)
  const noLeidas = inbox.pendientes

  const campoNav: NavItem[] = [
    { to: '/', label: 'Hoy', end: true },
    { to: '/visitas', label: etiquetaVocab(branding, 'visita', 'Jornada') },
    { to: '/personas', label: etiquetaVocab(branding, 'persona', 'Cartera') },
    { to: '/crm', label: 'CRM' },
  ]
  const masNav: NavItem[] = [
    { to: '/formularios', label: 'Formularios' },
    { to: '/notificaciones', label: 'Notificaciones' },
    { to: '/solicitudes', label: etiquetaVocab(branding, 'solicitud', 'Solicitudes'), codigo: 'solicitudes' },
    { to: '/depositos', label: 'Depósitos', codigo: 'depositos' },
    { to: '/cuentas', label: 'Cuentas', codigo: 'creditos' },
    { to: '/kilometraje', label: 'Kilometraje', codigo: 'kilometraje' },
    ...(mostrarMapa(rol, DEMO_MODE) ? [{ to: '/mapa', label: 'Mapa' }] : []),
    ...(mostrarConfiguracion(rol, DEMO_MODE) ? [{ to: '/configuracion', label: 'Configuración' }] : []),
    ...(mostrarUsuarios(rol, DEMO_MODE) ? [{ to: '/usuarios', label: 'Usuarios' }] : []),
    ...(mostrarAuditoria(rol, DEMO_MODE) ? [{ to: '/auditoria', label: 'Auditoría' }] : []),
  ].filter((item) => !item.codigo || DEMO_MODE || modulos.includes(item.codigo))

  const desktopNav: NavItem[] = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/visitas', label: etiquetaVocab(branding, 'visita', 'Visitas') },
    { to: '/personas', label: etiquetaVocab(branding, 'persona', 'Personas') },
    { to: '/crm', label: 'CRM' },
    ...masNav,
  ]

  const masActivo = masNav.some((item) =>
    item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  )

  useEffect(() => {
    setMasAbierto(false)
    setCampanaAbierta(false)
  }, [location.pathname])

  async function cerrarSesion() {
    if (!DEMO_MODE) await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-campo',
      isActive ? 'bg-primary text-white' : 'text-ink hover:bg-canvas',
    )

  const campoLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition-colors duration-campo',
      isActive ? 'text-primary' : 'text-muted',
    )

  function abrirCampana() {
    setCampanaAbierta((v) => !v)
    if (live) void inbox.refetch()
  }

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-start gap-2.5 border-b border-line px-4 pb-4 pt-5">
          <BrandMark nombre={marca} logoUrl={branding.logo_url} />
          <div className="min-w-0">
            <h1 className="font-display truncate text-base leading-tight tracking-tight">Gestiones</h1>
            <p className="mt-0.5 truncate text-xs text-muted">{marca}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Principal">
          {desktopNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={desktopLink}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-4 text-[11px] text-muted">
          <p className="truncate">{email}</p>
          <p className="mt-1 uppercase tracking-wide">{fuente === 'demo' ? 'Modo demo' : 'Supabase'}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[4.5rem] md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <BrandMark nombre={marca} logoUrl={branding.logo_url} compact />
            <p className="truncate text-sm font-semibold">{marca}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line text-ink hover:bg-canvas"
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
                  <span className="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-primary px-1 text-[10px] font-bold text-white">
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{noLeidas} sin leer</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {inbox.items.slice(0, 5).map((n) => (
                      <li key={n.id} className="rounded-lg border border-line px-2 py-1.5">
                        <p className="text-sm font-medium leading-tight">{n.titulo}</p>
                        <p className="line-clamp-2 text-[11px] text-muted">{n.cuerpo}</p>
                      </li>
                    ))}
                    {inbox.items.length === 0 && <li className="text-sm text-muted">No hay avisos.</li>}
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
            <Button size="sm" className="hidden min-h-11 sm:inline-flex" onClick={onNuevaVisita}>
              Nueva visita
            </Button>
            {!demo && (
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => void cerrarSesion()}>
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

        <main className="relative min-h-0 flex-1 p-4 md:p-6">{children}</main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-surface md:hidden"
        aria-label="Campo"
      >
        {campoNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={campoLink}>
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className={cn(
            'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold',
            masActivo || masAbierto ? 'text-primary' : 'text-muted',
          )}
          aria-expanded={masAbierto}
          aria-controls="nav-mas"
          onClick={() => setMasAbierto((v) => !v)}
        >
          Más
        </button>
      </nav>

      {masAbierto && (
        <div className="fixed inset-0 z-50 md:hidden" id="nav-mas">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Cerrar menú" onClick={() => setMasAbierto(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-line bg-surface p-4 pb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Más</p>
            <div className="grid gap-1">
              {masNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-canvas"
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onNuevaVisita}
        className="fixed bottom-16 right-4 z-40 inline-flex min-h-14 min-w-14 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-white shadow-fab md:hidden"
        aria-label="Nueva visita"
      >
        +
      </button>
    </div>
  )
}
