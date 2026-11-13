/**
 * Sesión sin conexión (sin dependencias de Expo, para poder probarla).
 * Con el access token vencido y sin señal, supabase-js conserva la sesión guardada pero la
 * emite como nula: aquí se lee, se valida su antigüedad y se arma el perfil desde la copia local.
 */
import type { CacheCampo } from './cacheCampo.ts'
import { claimsEmpresaDe } from './claims.ts'
import { claveParticionCola } from './colaParticion.ts'
import { esErrorTransitorio } from './errorRed.ts'
import type { Perfil } from './perfil.ts'
import { resolverPerfil } from './perfilRespaldo.ts'
import { MENSAJE_SESION_SIN_RENOVAR } from './sesionVigente.ts'

export const MAX_DIAS_SIN_CONEXION = 7

export interface SesionGuardada {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: {
    id: string
    email?: string | null
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
  }
}

type Advertir = (mensaje: string, detalle: unknown) => void

/** Misma clave que supabase-js usa por defecto: `sb-<primer segmento del host>-auth-token`. */
export function claveSesionSupabase(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
}

export async function leerSesionGuardada(
  storage: { getItem(k: string): Promise<string | null> },
  clave: string,
  advertir: Advertir = (m, d) => console.warn(m, d),
): Promise<SesionGuardada | null> {
  try {
    const crudo = await storage.getItem(clave)
    if (crudo == null || crudo === '') return null
    const s = JSON.parse(crudo) as Partial<SesionGuardada> | null
    if (
      !s ||
      typeof s.access_token !== 'string' || !s.access_token ||
      typeof s.refresh_token !== 'string' || !s.refresh_token ||
      !s.user || typeof s.user.id !== 'string' || !s.user.id
    ) {
      throw new Error('formato de sesión inválido')
    }
    return s as SesionGuardada
  } catch (err) {
    advertir('GC-AUTH-025: sesión guardada ilegible', err)
    return null
  }
}

export function puedeEntrarSinConexion(g: SesionGuardada, ahoraMs: number): boolean {
  // Sin vencimiento no se puede medir el plazo: a Login.
  if (g.expires_at == null) return false
  return ahoraMs - g.expires_at * 1000 <= MAX_DIAS_SIN_CONEXION * 24 * 60 * 60 * 1000
}

export async function perfilSinConexion(
  g: SesionGuardada,
  cache: CacheCampo,
  advertir?: Advertir,
): Promise<Perfil | null> {
  const claims = claimsEmpresaDe({ accessToken: g.access_token, appMetadata: g.user.app_metadata })
  if (!claims) return null
  return resolverPerfil({
    userId: g.user.id,
    email: g.user.email,
    userMetadata: g.user.user_metadata,
    claims,
    clave: claveParticionCola(claims.tenantId, g.user.id),
    cache,
    leerFuentes: async () => {
      throw new Error(MENSAJE_SESION_SIN_RENOVAR)
    },
    advertir,
  })
}

export type DecisionRenovar = 'normal' | 'seguir' | 'login'

function esErrorAuth(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { __isAuthError?: unknown; status?: unknown; name?: unknown }
  return o.__isAuthError === true || typeof o.status === 'number' || (typeof o.name === 'string' && o.name.startsWith('Auth'))
}

export function decidirTrasRenovar(
  r: { session: unknown | null; error: unknown | null },
  advertir: Advertir = (m, d) => console.warn(m, d),
): DecisionRenovar {
  if (r.session) return 'normal'
  if (!r.error) return 'login'
  const nombre = (r.error as { name?: unknown }).name
  if (nombre === 'AuthRetryableFetchError' || esErrorTransitorio(r.error)) return 'seguir'
  if (esErrorAuth(r.error)) return 'login'
  // Un fallo local (p. ej. SecureStore) no dice nada de la sesión: mandar a Login sin señal dejaría al asesor sin trabajar.
  advertir('GC-AUTH-033: error inesperado al renovar', r.error)
  return 'seguir'
}

/**
 * Intento de salir del modo sin conexión. Usa `getSession`: lee el token guardado en ese momento
 * (no una copia que auth-js ya pudo rotar), renueva solo si hace falta y, con el almacenamiento
 * vacío (tras salir), no llama a la red ni vuelve a guardar una sesión.
 */
export async function renovarSinConexion(
  auth: { getSession(): Promise<{ data: { session: unknown | null }; error: unknown | null }> },
  advertir: Advertir = (m, d) => console.warn(m, d),
): Promise<{ decision: DecisionRenovar; error: unknown | null }> {
  let r: { session: unknown | null; error: unknown | null }
  try {
    const { data, error } = await auth.getSession()
    r = { session: data.session, error }
  } catch (e) {
    r = { session: null, error: e }
  }
  return { decision: decidirTrasRenovar(r, advertir), error: r.error }
}
