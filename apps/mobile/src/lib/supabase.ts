/**
 * Cliente Supabase del asesor de campo (@gc/mobile).
 * Mismas reglas que @gc/web (spec seguridad §2.3):
 * solo la anon key pública; nunca service_role en el dispositivo.
 *
 * En Expo las variables públicas se exponen como EXPO_PUBLIC_*.
 * Sin URL/anon key reales el arranque falla con GC-CORE-001.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { claimsEmpresaDe, type Rol } from './claims'
import { requireMobileEnv } from './env'
import { fetchConLimite } from './fetchLimite'
import type { Perfil } from './perfil'
import type { CacheCampo } from './cacheCampo'
import { claveParticionCola } from './colaParticion.ts'
import { resolverPerfil } from './perfilRespaldo.ts'
import { exigirSesion } from './sesionVigente.ts'
import { claveSesionSupabase } from './sesionSinConexion.ts'
import { sesionStorage } from './sesionStorage'

export { claimsDe, type Rol } from './claims'
export type { Perfil } from './perfil'

const { url: supabaseUrl, key: supabaseAnonKey } = requireMobileEnv()

/** Clave explícita (igual a la que supabase-js deriva por defecto) para leer la sesión guardada sin conexión. */
export const CLAVE_SESION = claveSesionSupabase(supabaseUrl)

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: CLAVE_SESION,
    storage: sesionStorage, // No agregar auth.userStorage: guardaría el user aparte y rompería el modo sin conexión (leerSesionGuardada espera user.id en esta clave).
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchConLimite(15_000) },
})

/**
 * Hidrata tenant/rol como la web: JWT + app_metadata del user,
 * refresh de sesión si faltan, y RPC tenant_id_actual / rol_actual.
 */
export async function resolverClaims(session: Session): Promise<{ tenantId: string; rol: Rol } | null> {
  let actual = session
  let claims = claimsEmpresaDe({
    accessToken: actual.access_token,
    appMetadata: actual.user.app_metadata,
  })
  if (!claims) {
    const { data } = await supabase.auth.refreshSession()
    if (data.session) {
      actual = data.session
      claims = claimsEmpresaDe({
        accessToken: actual.access_token,
        appMetadata: actual.user.app_metadata,
      })
    }
  }
  if (!claims) {
    const [tenantRes, rolRes] = await Promise.all([
      supabase.rpc('tenant_id_actual'),
      supabase.rpc('rol_actual'),
    ])
    claims = claimsEmpresaDe({
      accessToken: actual.access_token,
      appMetadata: actual.user.app_metadata,
      tenantIdDb: tenantRes.data != null ? String(tenantRes.data) : null,
      rolDb: typeof rolRes.data === 'string' ? rolRes.data : null,
    })
  }
  return claims
}

/**
 * Hidrata el perfil: claims ya resueltos + usuario, tenant y módulos si RLS los deja ver.
 * Sin señal usa la última copia guardada; si una lectura falla por otro motivo (o no hay
 * copia), devuelve un perfil degradado desde los claims y avisa por consola, porque el
 * ingreso no depende de esas lecturas (GC-AUTH-022/023).
 */
export async function cargarPerfil(
  session: Session,
  claims: { tenantId: string; rol: Rol },
  cache: CacheCampo,
): Promise<Perfil> {
  const userId = session.user.id
  return resolverPerfil({
    userId,
    email: session.user.email,
    userMetadata: session.user.user_metadata,
    claims,
    clave: claveParticionCola(claims.tenantId, userId),
    cache,
    leerFuentes: async () => {
      // Sin sesión vigente las lecturas irían con la anon key y la RLS devolvería vacío:
      // GC-NET-004 es transitorio, así que se usa el perfil guardado.
      await exigirSesion(supabase)
      const [usuario, tenant, modulos] = await Promise.all([
        supabase.from('usuario').select('id, nombre').eq('id', userId).maybeSingle(),
        supabase.from('tenant').select('id, nombre, branding').eq('id', claims.tenantId).maybeSingle(),
        supabase.from('tenant_modulo').select('activo, modulo(codigo)').eq('activo', true),
      ])
      return { usuario, tenant, modulos }
    },
  })
}
