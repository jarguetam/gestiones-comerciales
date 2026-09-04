/** Catálogo de pantallas para el paseo QA de apps/web. */

export type ModoPaseo = 'public' | 'auth'

export type RutaPaseo = {
  path: string
  /**
   * data-spec(s) aceptados tras cargar (null = solo heading/contenido).
   * Varios ids: p.ej. dashboard admin usa W-02b (drill).
   */
  specs: string[] | null
  modo: ModoPaseo
  titulo: string
}

/** Compat: primer spec (tests/catálogo). */
export function specPrincipal(ruta: RutaPaseo): string | null {
  return ruta.specs?.[0] ?? null
}

export const RUTAS_PUBLICAS: RutaPaseo[] = [
  { path: '/login', specs: ['W-01'], modo: 'public', titulo: 'Login' },
  { path: '/recuperar', specs: null, modo: 'public', titulo: 'Recuperar contraseña' },
]

export const RUTAS_AUTH: RutaPaseo[] = [
  { path: '/', specs: ['W-02', 'W-02b'], modo: 'auth', titulo: 'Dashboard' },
  { path: '/visitas', specs: ['W-03'], modo: 'auth', titulo: 'Visitas' },
  { path: '/personas', specs: ['W-04'], modo: 'auth', titulo: 'Personas' },
  { path: '/crm', specs: ['W-15'], modo: 'auth', titulo: 'CRM' },
  { path: '/formularios', specs: ['W-05'], modo: 'auth', titulo: 'Formularios' },
  { path: '/mapa', specs: ['W-14'], modo: 'auth', titulo: 'Mapa' },
  { path: '/solicitudes', specs: ['W-06'], modo: 'auth', titulo: 'Solicitudes' },
  { path: '/depositos', specs: ['W-07'], modo: 'auth', titulo: 'Depósitos' },
  { path: '/cuentas', specs: ['W-08'], modo: 'auth', titulo: 'Cuentas' },
  { path: '/kilometraje', specs: ['W-09'], modo: 'auth', titulo: 'Kilometraje' },
  { path: '/notificaciones', specs: ['W-13'], modo: 'auth', titulo: 'Notificaciones' },
  { path: '/auditoria', specs: ['W-12'], modo: 'auth', titulo: 'Auditoría' },
  { path: '/configuracion', specs: ['W-10'], modo: 'auth', titulo: 'Configuración' },
  { path: '/usuarios', specs: ['W-11'], modo: 'auth', titulo: 'Usuarios' },
]

export function rutasParaModo(modo: ModoPaseo): RutaPaseo[] {
  return modo === 'public' ? [...RUTAS_PUBLICAS] : [...RUTAS_AUTH]
}

/** Hash relativo (sin `/` inicial) para no romper baseURL en subpath (GitHub Pages). */
export function hashUrl(path: string): string {
  if (path === '/') return '#/'
  return `#${path}`
}

export function selectorSpecs(specs: string[]): string {
  return specs.map((s) => `[data-spec="${s}"]`).join(', ')
}
