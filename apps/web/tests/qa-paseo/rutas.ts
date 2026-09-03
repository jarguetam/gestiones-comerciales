/** Catálogo de pantallas para el paseo QA de apps/web. */

export type ModoPaseo = 'public' | 'auth'

export type RutaPaseo = {
  path: string
  /** data-spec esperado tras cargar (null = solo heading/contenido). */
  spec: string | null
  modo: ModoPaseo
  titulo: string
}

export const RUTAS_PUBLICAS: RutaPaseo[] = [
  { path: '/login', spec: 'W-01', modo: 'public', titulo: 'Login' },
  { path: '/recuperar', spec: null, modo: 'public', titulo: 'Recuperar contraseña' },
]

export const RUTAS_AUTH: RutaPaseo[] = [
  { path: '/', spec: 'W-02', modo: 'auth', titulo: 'Dashboard' },
  { path: '/visitas', spec: 'W-03', modo: 'auth', titulo: 'Visitas' },
  { path: '/personas', spec: 'W-04', modo: 'auth', titulo: 'Personas' },
  { path: '/crm', spec: 'W-15', modo: 'auth', titulo: 'CRM' },
  { path: '/formularios', spec: 'W-05', modo: 'auth', titulo: 'Formularios' },
  { path: '/mapa', spec: 'W-14', modo: 'auth', titulo: 'Mapa' },
  { path: '/solicitudes', spec: 'W-06', modo: 'auth', titulo: 'Solicitudes' },
  { path: '/depositos', spec: 'W-07', modo: 'auth', titulo: 'Depósitos' },
  { path: '/cuentas', spec: 'W-08', modo: 'auth', titulo: 'Cuentas' },
  { path: '/kilometraje', spec: 'W-09', modo: 'auth', titulo: 'Kilometraje' },
  { path: '/notificaciones', spec: 'W-13', modo: 'auth', titulo: 'Notificaciones' },
  { path: '/auditoria', spec: 'W-12', modo: 'auth', titulo: 'Auditoría' },
  { path: '/configuracion', spec: 'W-10', modo: 'auth', titulo: 'Configuración' },
  { path: '/usuarios', spec: 'W-11', modo: 'auth', titulo: 'Usuarios' },
]

export function rutasParaModo(modo: ModoPaseo): RutaPaseo[] {
  return modo === 'public' ? [...RUTAS_PUBLICAS] : [...RUTAS_AUTH]
}

/** Hash relativo (sin `/` inicial) para no romper baseURL en subpath (GitHub Pages). */
export function hashUrl(path: string): string {
  if (path === '/') return '#/'
  return `#${path}`
}
