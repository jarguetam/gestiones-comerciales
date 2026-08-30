import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { mostrarAuditoria, mostrarConfiguracion, mostrarMapa, mostrarUsuarios } from '../lib/claims'
import { BACKEND_CONFIGURADO, supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'
import { useNotificaciones } from '../features/notificaciones/useNotificaciones'
import { Button } from '../components/ui/Button'
import { BrandMark } from '../components/ui/BrandMark'
import { Alert } from '../components/ui/Alert'
import { Icon, type IconName } from '../components/ui/Icon'
import { cn } from '../lib/cn'
import type { BrandingTenant } from '../lib/branding'
import { nombreComercial } from '../lib/branding'
import { etiquetaVocab } from '../lib/vocabulario'

type NavItem = { to: string; label: string; end?: boolean; codigo?: string; icon?: IconName }

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
  const { session, rol } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [masAbierto, setMasAbierto] = useState(false)
  const [campanaAbierta, setCampanaAbierta] = useState(false)
  const live = fuente === 'supabase'
  const inbox = useNotificaciones(live)
  const email = session?.user?.email ?? '—'
  const marca = nombreComercial(branding, tenantNombre)
  const noLeidas = inbox.pendientes

  const campoNav: NavItem[] = [
    { to: '/', label: 'Hoy', end: true, icon: 'hoy' },
    { to: '/visitas', label: etiquetaVocab(branding, 'visita', 'Jornada'), icon: 'jornada' },
    { to: '/personas', label: etiquetaVocab(branding, 'persona', 'Cartera'), icon: 'cartera' },
    { to: '/crm', label: 'CRM', icon: 'crm' },
  ]
  const masNav: NavItem[] = [
    { to: '/formularios', label: 'Formularios' },
    { to: '/notificaciones', label: 'Notificaciones' },
    { to: '/solicitudes', label: etiquetaVocab(branding, 'solicitud', 'Solicitudes'), codigo: 'solicitudes' },
    { to: '/depositos', label: 'Depósitos', codigo: 'depositos' },
    { to: '/cuentas', label: 'Cuentas', codigo: 'creditos' },
    { to: '/kilometraje', label: 'Kilometraje', codigo: 'kilometraje' },
    ...(mostrarMapa(rol) ? [{ to: '/mapa', label: 'Mapa' }] : []),
    ...(mostrarConfiguracion(rol) ? [{ to: '/configuracion', label: 'Configuración' }] : []),
    ...(mostrarUsuarios(rol) ? [{ to: '/usuarios', label: 'Usuarios' }] : []),
    ...(mostrarAuditoria(rol) ? [{ to: '/auditoria', label: 'Auditoría' }] : []),
  ].filter((item) => !item.codigo || modulos.includes(item.codigo))

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
    if (BACKEND_CONFIGURADO) await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-campo',
      isActive ? 'bg-primary text-white' : 'text-ink hover:bg-canvas',
    )

  const campoLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1 text-[11px] font-medium transition-colors duration-campo',
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
            <h1 className="truncate text-sm font-semibold leading-tight">Gestiones</h1>
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
          <p className="mt-1">{fuente === 'demo' ? 'Modo demo' : 'Supabase'}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[5.5rem] md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <BrandMark nombre={marca} logoUrl={branding.logo_url} compact />
            <p className="truncate text-sm font-semibold">{marca}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line text-ink hover:bg-canvas"
                aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
                aria-expanded={campanaAbierta}
                aria-haspopup="dialog"
                onClick={abrirCampana}
              >
                <Icon name="campana" size={16} />
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
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-lg border border-line bg-surface p-3 text-ink shadow-sm"
                >
                  <p className="text-xs font-medium text-muted">{noLeidas} sin leer</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {inbox.items.slice(0, 5).map((n) => (
                      <li key={n.id} className="rounded-md border border-line px-2 py-1.5">
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
              <Icon name="plus" size={14} />
              Nueva visita
            </Button>
            <Button variant="ghost" size="sm" className="min-h-11" onClick={() => void cerrarSesion()}>
              <Icon name="salir" size={16} />
              Salir
            </Button>
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
        className="fixed bottom-0 left-0 right-0 z-40 flex min-h-14 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_6px_rgba(17,17,17,0.04)] md:hidden"
        aria-label="Campo"
      >
        {campoNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={campoLink}>
            {({ isActive }) => (
              <>
                <span
                  className={cn('absolute inset-x-5 top-0 h-0.5 rounded-full', isActive ? 'bg-primary' : 'bg-transparent')}
                  aria-hidden
                />
                {item.icon ? <Icon name={item.icon} size={22} /> : null}
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          className={cn(
            'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1 text-[11px] font-medium',
            masActivo || masAbierto ? 'text-primary' : 'text-muted',
          )}
          aria-expanded={masAbierto}
          aria-controls="nav-mas"
          onClick={() => setMasAbierto((v) => !v)}
        >
          <span
            className={cn(
              'absolute inset-x-5 top-0 h-0.5 rounded-full',
              masActivo || masAbierto ? 'bg-primary' : 'bg-transparent',
            )}
            aria-hidden
          />
          <Icon name="mas" size={22} />
          Más
        </button>
      </nav>

      {masAbierto && (
        <div className="fixed inset-0 z-50 md:hidden" id="nav-mas">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Cerrar menú" onClick={() => setMasAbierto(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-xl border border-line bg-surface p-4 pb-8">
            <p className="mb-2 text-sm font-semibold text-ink">Más</p>
            <div className="grid gap-1">
              {masNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink hover:bg-canvas"
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-ink hover:bg-canvas"
                onClick={() => void cerrarSesion()}
              >
                <Icon name="salir" size={16} />
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onNuevaVisita}
        className="fixed bottom-[4.75rem] right-3 z-40 inline-flex min-h-14 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm md:hidden"
        aria-label="Nueva visita"
      >
        <Icon name="plus" size={18} />
        Nueva visita
      </button>
    </div>
  )
}
